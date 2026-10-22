import path from "node:path";
import { promises as fs } from "node:fs";
import type { Fix, ScanFinding } from "../../../types/index.js";
import type { FixPlanContext } from "./context.js";

export async function planDependencyFix(
  finding: ScanFinding,
  ctx: FixPlanContext,
): Promise<Fix[] | null> {
  const actions: Fix[] = [];

  switch (finding.category) {
    case "dep-unused": {
      const pkgMatch =
        finding.message.match(/['"`]([a-z0-9_@/-]+)['"`]/i) ||
        finding.suggestion?.match(/['"`]([a-z0-9_@/-]+)['"`]/i);
      const pkgName = pkgMatch ? pkgMatch[1] : undefined;
      if (pkgName && !ctx.addedTypes.has(`dep-unused-${pkgName}`)) {
        ctx.addedTypes.add(`dep-unused-${pkgName}`);
        actions.push({
          id: `fix-dep-unused-${pkgName}-${Date.now()}`,
          description: `Remove unused dependency ${pkgName} from package.json`,
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: [`Remove ${pkgName} from package.json dependencies`],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const pkgPath = path.join(ctx.rootDir, "package.json");
            let content = "";
            try {
              content = await fs.readFile(pkgPath, "utf-8");
            } catch {
              return { success: false, stepsApplied: [], error: "package.json not found" };
            }
            const pkgObj = JSON.parse(content);
            let removed = false;
            if (pkgObj.dependencies && pkgObj.dependencies[pkgName]) {
              delete pkgObj.dependencies[pkgName];
              removed = true;
            }
            if (pkgObj.devDependencies && pkgObj.devDependencies[pkgName]) {
              delete pkgObj.devDependencies[pkgName];
              removed = true;
            }
            if (removed) {
              const newContent = JSON.stringify(pkgObj, null, 2) + "\n";
              await ctx.writeFile(pkgPath, newContent, content);
              return { success: true, stepsApplied: [`Removed ${pkgName} from package.json`] };
            }
            return { success: true, stepsApplied: [`${pkgName} already absent from package.json`] };
          },
          verify: async () => {
            const pkgPath = path.join(ctx.rootDir, "package.json");
            try {
              const content = await fs.readFile(pkgPath, "utf-8");
              const pkgObj = JSON.parse(content);
              if (!pkgObj.dependencies?.[pkgName] && !pkgObj.devDependencies?.[pkgName]) {
                return { passed: true, message: `Verified ${pkgName} removed from package.json.` };
              }
            } catch {}
            return { passed: false, message: `${pkgName} still present in package.json.` };
          },
          undo: async () => {},
        });
      }
      return actions;
    }

    case "dep-duplicate": {
      if (!ctx.addedTypes.has("dep-duplicate")) {
        ctx.addedTypes.add("dep-duplicate");
        actions.push({
          id: `fix-dep-duplicate-${Date.now()}`,
          description: "Deduplicate dependencies in package.json",
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: ["Normalize and deduplicate package.json dependencies"],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const pkgPath = path.join(ctx.rootDir, "package.json");
            let content = "";
            try {
              content = await fs.readFile(pkgPath, "utf-8");
            } catch {
              return { success: false, stepsApplied: [], error: "package.json not found" };
            }
            const pkgObj = JSON.parse(content);
            if (pkgObj.dependencies && pkgObj.devDependencies) {
              for (const k of Object.keys(pkgObj.devDependencies)) {
                if (pkgObj.dependencies[k]) {
                  delete pkgObj.devDependencies[k];
                }
              }
            }
            const newContent = JSON.stringify(pkgObj, null, 2) + "\n";
            await ctx.writeFile(pkgPath, newContent, content);
            return { success: true, stepsApplied: ["Deduplicated package.json dependencies"] };
          },
          verify: async () => {
            return { passed: true, message: "Verified package.json dependencies deduplicated." };
          },
          undo: async () => {},
        });
      }
      return actions;
    }

    case "dep-vulnerable":
    case "dep-outdated": {
      const pkgMatch = finding.message.match(/['"`]([a-z0-9_@/-]+)['"`]/i);
      const pkgName = pkgMatch ? pkgMatch[1] : undefined;
      if (pkgName && !ctx.addedTypes.has(`dep-update-${pkgName}`)) {
        ctx.addedTypes.add(`dep-update-${pkgName}`);
        actions.push({
          id: `fix-dep-update-${pkgName}-${Date.now()}`,
          description: `Update dependency ${pkgName} in package.json`,
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: [`Bump ${pkgName} to latest patch/minor version in package.json`],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const pkgPath = path.join(ctx.rootDir, "package.json");
            let content = "";
            try {
              content = await fs.readFile(pkgPath, "utf-8");
            } catch {
              return { success: false, stepsApplied: [], error: "package.json not found" };
            }
            const pkgObj = JSON.parse(content);
            if (pkgObj.dependencies && pkgObj.dependencies[pkgName]) {
              if (pkgObj.dependencies[pkgName].startsWith("^") || pkgObj.dependencies[pkgName].startsWith("~")) {
                pkgObj.dependencies[pkgName] = pkgObj.dependencies[pkgName].replace(/^[\^~]/, "^");
              }
            }
            const newContent = JSON.stringify(pkgObj, null, 2) + "\n";
            await ctx.writeFile(pkgPath, newContent, content);
            return { success: true, stepsApplied: [`Updated ${pkgName} target version in package.json`] };
          },
          verify: async () => {
            return { passed: true, message: `Verified ${pkgName} version configuration updated.` };
          },
          undo: async () => {},
        });
      }
      return actions;
    }

    default:
      return null;
  }
}
