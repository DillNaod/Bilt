import path from "node:path";
import { promises as fs } from "node:fs";
import { colors, glyphs } from "../../../ui/theme.js";
import { logger } from "../../../core/logging/index.js";
import {
  executeSecretRemediation,
  previewSecretRemediation,
  restoreGitSnapshot,
} from "../../../core/fix/git.js";
import { addToGitignore } from "../../../core/fix/env-fix.js";
import type { Fix, ScanFinding } from "../../../types/index.js";
import type { FixPlanContext } from "./context.js";

export async function planGitFix(
  finding: ScanFinding,
  ctx: FixPlanContext,
): Promise<Fix[] | null> {
  const actions: Fix[] = [];

  switch (finding.category) {
    case "gitignore-missing": {
      if (!ctx.addedTypes.has("gitignore")) {
        ctx.addedTypes.add("gitignore");
        actions.push({
          id: `fix-gitignore-${Date.now()}`,
          description: "Add .env patterns to .gitignore",
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: ["Append .env patterns to .gitignore"],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const gitignorePath = path.join(ctx.rootDir, ".gitignore");
            const newContent = await addToGitignore(
              [".env", ".env.*", ".env.local", ".env.*.local", ".bilt/"],
              gitignorePath,
            );
            let oldContent = "";
            try {
              oldContent = await fs.readFile(gitignorePath, "utf-8");
            } catch {}
            await ctx.writeFile(gitignorePath, newContent, oldContent);
            return { success: true, stepsApplied: ["Appended .env patterns to .gitignore"] };
          },
          verify: async () => {
            const gitignorePath = path.join(ctx.rootDir, ".gitignore");
            let content = "";
            try {
              content = await fs.readFile(gitignorePath, "utf-8");
            } catch {}
            if (content.includes(".env")) return { passed: true, message: "Verified .gitignore updated." };
            return { passed: false, message: ".gitignore not properly updated." };
          },
          undo: async () => {},
        });
      }
      return actions;
    }

    case "git-committed-env": {
      const targetFile = finding.file;
      const basename = path.basename(targetFile);
      if (!ctx.addedTypes.has(`git-committed-env-${targetFile}`)) {
        ctx.addedTypes.add(`git-committed-env-${targetFile}`);
        actions.push({
          id: `fix-git-committed-env-${Date.now()}`,
          description: `Untrack ${targetFile} from Git index & update .gitignore`,
          type: "destructive",
          findingId: finding.id,
          preview: async () => ({
            steps: [
              `Run "git rm --cached ${targetFile}" (untrack file without deleting from disk)`,
              `Add ${basename} to .gitignore`,
            ],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const stepsApplied: string[] = [];
            try {
              const { execFileSync } = await import("node:child_process");
              execFileSync("git", ["rm", "--cached", "--", targetFile], { cwd: ctx.rootDir, stdio: "ignore" });
              stepsApplied.push(`Untracked ${targetFile} from Git index`);
            } catch {
              // Ignore if untracked or git error
            }

            const gitignorePath = path.join(ctx.rootDir, ".gitignore");
            const newContent = await addToGitignore(
              [basename, ".env", ".env.*", ".env.local"],
              gitignorePath,
            );
            let oldContent = "";
            try {
              oldContent = await fs.readFile(gitignorePath, "utf-8");
            } catch {}
            await ctx.writeFile(gitignorePath, newContent, oldContent);
            stepsApplied.push(`Added ${basename} to .gitignore`);

            return { success: true, stepsApplied };
          },
          verify: async () => {
            try {
              const { execFileSync } = await import("node:child_process");
              const out = execFileSync("git", ["ls-files", "--", targetFile], {
                cwd: ctx.rootDir,
                encoding: "utf-8",
              }).trim();
              if (!out) {
                return { passed: true, message: `Verified ${targetFile} is untracked from Git.` };
              }
            } catch {}
            return { passed: false, message: `${targetFile} is still tracked in Git.` };
          },
          undo: async () => {},
        });
      }
      return actions;
    }

    case "secret-detected":
    case "git-history-secret": {
      let remediationVerification = { passed: false, message: "Remediation did not run." };
      let snapshotRef: string | undefined;

      actions.push({
        id: `fix-secret-${finding.id}`,
        description: `Remove secret from ${finding.file}${finding.line ? `:${finding.line}` : ""}`,
        type: "destructive",
        findingId: finding.id,
        preview: async () => {
          if (!finding.secret) {
            return {
              steps: ["Manual remediation required"],
              estimatedTime: "< 1m",
              risk: "High",
              instructions: "Secret value not retained in memory. Re-run with secret retention for automated remediation.",
            };
          }

          try {
            const plan = await previewSecretRemediation(ctx.rootDir, finding.secret);
            const intro = plan.introducingCommit
              ? `First introduced in ${plan.introducingCommit.slice(0, 8)}`
              : "Introducing commit could not be determined";
            const affected = `${plan.affectedCommits.length} affected commit(s)`;
            return {
              steps: [intro, affected, ...plan.estimatedSteps],
              estimatedTime: "2-8 mins",
              risk: "Critical",
              requiresConfirmation: "PURGE_HISTORY",
              instructions:
                "Rotate the exposed credential first. Bilt will create a safety snapshot before rewriting history. " +
                (plan.forcePushRequired
                  ? "Remote force-push will be required after local cleanup."
                  : "No remote force-push detected."),
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              steps: ["Unable to build remediation preview"],
              estimatedTime: "unknown",
              risk: "Critical",
              requiresConfirmation: "PURGE_HISTORY",
              instructions: `Preview error: ${msg}`,
            };
          }
        },
        apply: async () => {
          if (!finding.secret) {
            remediationVerification = {
              passed: false,
              message: "Secret value was unavailable, remediation could not execute.",
            };
            return {
              success: false,
              stepsApplied: [],
              error: remediationVerification.message,
            };
          }

          logger.info("Executing Git history remediation...");
          try {
            const execution = await executeSecretRemediation(ctx.rootDir, finding.secret);
            snapshotRef = execution.snapshot?.tag;
            remediationVerification = {
              passed: execution.verification.verified,
              message: execution.verification.message,
            };

            const stepsApplied = [
              "Created Git safety snapshot",
              "Rewrote local history to redact the secret",
              execution.verification.message,
            ];

            for (const warning of execution.warnings) {
              logger.warn(`Remediation warning: ${warning}`);
            }

            return {
              success: execution.success,
              stepsApplied,
              error: execution.success ? undefined : execution.verification.message,
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            remediationVerification = { passed: false, message: msg };
            return { success: false, stepsApplied: [], error: msg };
          }
        },
        verify: async () => {
          return remediationVerification;
        },
        undo: async () => {
          if (snapshotRef) {
            await restoreGitSnapshot(ctx.rootDir, snapshotRef);
          }
        },
      });
      return actions;
    }

    default:
      return null;
  }
}
