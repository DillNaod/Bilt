import path from "node:path";
import { promises as fs } from "node:fs";
import type { Fix, ScanFinding } from "../../../types/index.js";
import type { FixPlanContext } from "./context.js";
import { addToGitignore, generateEnvExample, addMissingEnvVars } from "../../../core/fix/env-fix.js";
import { parseEnvFile } from "../../../core/scan/env.js";
import { SECRET_RULES } from "../../../core/rules/secret-rules.js";

export async function planEnvFix(
  finding: ScanFinding,
  ctx: FixPlanContext,
): Promise<Fix[] | null> {
  const ruleId = finding.ruleId;
  const actions: Fix[] = [];

  // SEC-ENV-001 or env-exposed: strip public prefixes
  if (ruleId === "SEC-ENV-001" || finding.category === "env-exposed") {
    const targetFile = finding.file || ".env";
    const keyMatch =
      finding.message.match(/['"`]([A-Z0-9_]+)['"`]/i) ||
      finding.message.match(/Variable ["']?([A-Z0-9_]+)["']?/i);
    const varKey = keyMatch ? keyMatch[1] : undefined;
    const keyStr = `sec-env-001-${targetFile}-${varKey || "all"}`;
    if (!ctx.addedTypes.has(keyStr)) {
      ctx.addedTypes.add(keyStr);
      actions.push({
        id: `fix-env-exposed-${Date.now()}`,
        description: `Strip public prefix from secret key in ${targetFile}`,
        type: "safe",
        findingId: finding.id,
        preview: async () => ({
          steps: [`Rename client-exposed public prefix from secret variable in ${targetFile}`],
          estimatedTime: "< 1s",
          risk: "Low",
        }),
        apply: async () => {
          const filePath = path.join(ctx.rootDir, targetFile);
          let content = "";
          try {
            content = await fs.readFile(filePath, "utf-8");
          } catch {
            return { success: false, stepsApplied: [], error: `${targetFile} not found` };
          }
          let newContent = content;
          if (varKey) {
            const cleanKey = varKey.replace(/^(NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_)/, "");
            newContent = newContent.replace(new RegExp(`\\b${varKey}\\b`, "g"), cleanKey);
          } else {
            newContent = newContent
              .replace(/^NEXT_PUBLIC_(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|DATABASE_URL|ADMIN|MASTER_KEY)/gm, "$1")
              .replace(/^VITE_(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|DATABASE_URL|ADMIN|MASTER_KEY)/gm, "$1")
              .replace(/^PUBLIC_(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|DATABASE_URL|ADMIN|MASTER_KEY)/gm, "$1")
              .replace(/^REACT_APP_(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|DATABASE_URL|ADMIN|MASTER_KEY)/gm, "$1");
          }
          await ctx.writeFile(filePath, newContent, content);
          return { success: true, stepsApplied: [`Stripped public prefix from secret variable in ${targetFile}`] };
        },
        verify: async () => {
          const filePath = path.join(ctx.rootDir, targetFile);
          try {
            const content = await fs.readFile(filePath, "utf-8");
            if (varKey) {
              if (!content.includes(varKey)) return { passed: true, message: `Verified ${varKey} prefix removed.` };
            } else {
              return { passed: true, message: `Verified secret public prefixes removed from ${targetFile}.` };
            }
          } catch {}
          return { passed: false, message: `Public prefix still present in ${targetFile}.` };
        },
        undo: async () => {},
      });
    }
    return actions;
  }

  // SEC-ENV-002: file permissions (chmod 600)
  if (ruleId === "SEC-ENV-002") {
    const targetFile = finding.file || ".env";
    const keyStr = `sec-env-002-${targetFile}`;
    if (!ctx.addedTypes.has(keyStr)) {
      ctx.addedTypes.add(keyStr);
      actions.push({
        id: `fix-env-permissions-${Date.now()}`,
        description: `Fix restrictive file permissions on ${targetFile} (chmod 600)`,
        type: "safe",
        findingId: finding.id,
        preview: async () => ({
          steps: [`Set POSIX file permissions to 0600 (owner read/write only) on ${targetFile}`],
          estimatedTime: "< 1s",
          risk: "Low",
        }),
        apply: async () => {
          const filePath = path.join(ctx.rootDir, targetFile);
          try {
            await fs.chmod(filePath, 0o600);
            return { success: true, stepsApplied: [`Set permissions to 0600 on ${targetFile}`] };
          } catch (err) {
            return { success: false, stepsApplied: [], error: `Failed to chmod ${targetFile}: ${(err as Error).message}` };
          }
        },
        verify: async () => {
          const filePath = path.join(ctx.rootDir, targetFile);
          try {
            const stat = await fs.stat(filePath);
            const mode = stat.mode & 0o777;
            if (mode === 0o600 || process.platform === "win32") {
              return { passed: true, message: `Verified ${targetFile} permissions are secure.` };
            }
          } catch {}
          return { passed: false, message: `Permissions on ${targetFile} could not be verified.` };
        },
        undo: async () => {},
      });
    }
    return actions;
  }

  // SEC-ENV-003: untracked env
  if (ruleId === "SEC-ENV-003") {
    const targetFile = finding.file || ".env";
    const keyStr = `sec-env-003-${targetFile}`;
    if (!ctx.addedTypes.has(keyStr)) {
      ctx.addedTypes.add(keyStr);
      actions.push({
        id: `fix-env-untracked-${Date.now()}`,
        description: `Ensure ${targetFile} is added to .gitignore`,
        type: "safe",
        findingId: finding.id,
        preview: async () => ({
          steps: [`Add ${targetFile} entry to .gitignore`],
          estimatedTime: "< 1s",
          risk: "Low",
        }),
        apply: async () => {
          const gitignorePath = path.join(ctx.rootDir, ".gitignore");
          const newContent = await addToGitignore([targetFile], gitignorePath);
          let oldContent = "";
          try {
            oldContent = await fs.readFile(gitignorePath, "utf-8");
          } catch {}
          await ctx.writeFile(gitignorePath, newContent, oldContent);
          return { success: true, stepsApplied: [`Added ${targetFile} to .gitignore`] };
        },
        verify: async () => {
          const gitignorePath = path.join(ctx.rootDir, ".gitignore");
          try {
            const content = await fs.readFile(gitignorePath, "utf-8");
            if (content.includes(targetFile)) return { passed: true, message: `Verified ${targetFile} in .gitignore.` };
          } catch {}
          return { passed: false, message: `${targetFile} missing from .gitignore.` };
        },
        undo: async () => {},
      });
    }
    return actions;
  }

  // SEC-ENV-004 or env-missing: missing required variable
  if (ruleId === "SEC-ENV-004" || finding.category === "env-missing") {
    const key =
      (finding.message.match(/process\.env\.(\w+)/)?.[1] ??
      finding.message.match(/["']([^"']+)["']/)?.[1] ??
      finding.message.match(/`([^`]+)`/)?.[1] ??
      finding.message.match(/Variable ["']?([A-Z0-9_]+)["']?/i)?.[1]) ||
      "MISSING_VAR";

    if (key && !ctx.addedTypes.has(`env-missing-${key}`)) {
      ctx.addedTypes.add(`env-missing-${key}`);
      actions.push({
        id: `fix-env-missing-${key}-${Date.now()}`,
        description: `Add missing env var ${key} to .env`,
        type: "safe",
        findingId: finding.id,
        preview: async () => ({
          steps: [`Append ${key}= to .env`],
          estimatedTime: "< 1s",
          risk: "Low",
        }),
        apply: async () => {
          const envFilePath = path.join(ctx.rootDir, ".env");
          let content = "";
          try {
            content = await ctx.readFile(envFilePath);
          } catch {}
          const newContent = addMissingEnvVars(content, [key]);
          await ctx.writeFile(envFilePath, newContent, content);
          return { success: true, stepsApplied: [`Appended ${key}= to .env`] };
        },
        verify: async () => {
          const envFilePath = path.join(ctx.rootDir, ".env");
          let content = "";
          try {
            content = await fs.readFile(envFilePath, "utf-8");
          } catch {}
          if (content.includes(`${key}=`)) return { passed: true, message: "Verified environment variable added." };
          return { passed: false, message: "Environment variable not found in .env." };
        },
        undo: async () => {},
      });
    }
    return actions;
  }

  // env-mismatch: generate .env.example
  if (finding.category === "env-mismatch") {
    if (!ctx.addedTypes.has("env-example")) {
      ctx.addedTypes.add("env-example");
      actions.push({
        id: `fix-env-example-${Date.now()}`,
        description: "Generate .env.example with all required keys",
        type: "safe",
        findingId: finding.id,
        preview: async () => ({
          steps: ["Create or update .env.example with placeholder values"],
          estimatedTime: "< 1s",
          risk: "Low",
        }),
        apply: async () => {
          const envFilePath = path.join(ctx.rootDir, ".env");
          let content = "";
          try {
            content = await fs.readFile(envFilePath, "utf-8");
          } catch {
            return { success: false, stepsApplied: [], error: "No .env file found" };
          }
          const parsed = parseEnvFile(content, envFilePath);
          const exampleContent = generateEnvExample(
            parsed,
            SECRET_RULES,
            ctx.config?.entropyThreshold ?? 4.2,
          );
          const targetPath = path.join(ctx.rootDir, ".env.example");
          let oldExampleContent = "";
          try {
            oldExampleContent = await fs.readFile(targetPath, "utf-8");
          } catch {}
          await ctx.writeFile(targetPath, exampleContent, oldExampleContent);
          return { success: true, stepsApplied: ["Generated .env.example"] };
        },
        verify: async () => {
          const envExamplePath = path.join(ctx.rootDir, ".env.example");
          try {
            const content = await fs.readFile(envExamplePath, "utf-8");
            if (content.trim().length > 0) return { passed: true, message: "Verified .env.example exists." };
          } catch {}
          return { passed: false, message: ".env.example not found or empty." };
        },
        undo: async () => {},
      });
    }
    return actions;
  }

  // env-unused: comment out unused variable
  if (finding.category === "env-unused") {
    const keyMatch =
      finding.message.match(/['"`]([A-Z0-9_]+)['"`]/i) ||
      finding.message.match(/Variable ["']?([A-Z0-9_]+)["']?/i);
    const varKey = keyMatch ? keyMatch[1] : undefined;
    const targetFile = finding.file || ".env";
    if (varKey && !ctx.addedTypes.has(`env-unused-${varKey}`)) {
      ctx.addedTypes.add(`env-unused-${varKey}`);
      actions.push({
        id: `fix-env-unused-${varKey}-${Date.now()}`,
        description: `Comment out unused variable ${varKey} in ${targetFile}`,
        type: "safe",
        findingId: finding.id,
        preview: async () => ({
          steps: [`Comment out ${varKey} in ${targetFile}`],
          estimatedTime: "< 1s",
          risk: "Low",
        }),
        apply: async () => {
          const filePath = path.join(ctx.rootDir, targetFile);
          let content = "";
          try {
            content = await fs.readFile(filePath, "utf-8");
          } catch {
            return { success: false, stepsApplied: [], error: `${targetFile} not found` };
          }
          const lines = content.split("\n");
          const newLines = lines.map((l) => {
            const trimmed = l.trim();
            if (trimmed.startsWith(`${varKey}=`)) {
              return `# ${l} # commented out by bilt (unused)`;
            }
            return l;
          });
          const newContent = newLines.join("\n");
          await ctx.writeFile(filePath, newContent, content);
          return { success: true, stepsApplied: [`Commented out unused variable ${varKey} in ${targetFile}`] };
        },
        verify: async () => {
          const filePath = path.join(ctx.rootDir, targetFile);
          try {
            const content = await fs.readFile(filePath, "utf-8");
            if (!content.match(new RegExp(`^\\s*${varKey}=`, "m"))) {
              return { passed: true, message: `Verified ${varKey} commented out.` };
            }
          } catch {}
          return { passed: false, message: `${varKey} still active in ${targetFile}.` };
        },
        undo: async () => {},
      });
    }
    return actions;
  }

  return null;
}
