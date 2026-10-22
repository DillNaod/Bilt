import path from "node:path";
import { promises as fs } from "node:fs";
import { ALL_SECURITY_RULES } from "../../../core/security-engine/rules/index.js";
import type { Fix, ScanFinding } from "../../../types/index.js";
import type { FixPlanContext } from "./context.js";

export async function planSecurityRuleFix(
  finding: ScanFinding,
  ctx: FixPlanContext,
): Promise<Fix[] | null> {
  const secRule = ALL_SECURITY_RULES.find(
    (r) => r.id === finding.ruleId || finding.message.includes(`[${r.id}]`),
  );

  if (!secRule || typeof secRule.safeAutoFix !== "function") {
    return null;
  }

  const targetFile = finding.file;
  const keyStr = `sec-rule-${finding.ruleId || secRule.id}-${targetFile}-${finding.line || 0}`;
  if (ctx.addedTypes.has(keyStr)) {
    return [];
  }
  ctx.addedTypes.add(keyStr);

  const fix: Fix = {
    id: `fix-rule-${finding.ruleId || secRule.id}-${Date.now()}`,
    description: `Fix [${secRule.id}] ${secRule.title}`,
    type: "safe",
    findingId: finding.id,
    preview: async () => ({
      steps: [secRule.suggestedFix || `Apply automated fix for ${secRule.id}`],
      estimatedTime: "< 1s",
      risk: "Low",
    }),
    apply: async () => {
      const filePath = path.join(ctx.rootDir, targetFile);
      let content = "";
      try {
        content = await fs.readFile(filePath, "utf-8");
      } catch {
        return { success: false, stepsApplied: [], error: `File ${targetFile} not found` };
      }
      const astCtx = {
        filePath: targetFile,
        fileContent: content,
        isFrontend: false,
        isBackend: true,
        isConfigFile: false,
        isTestFile: false,
        isDocFile: false,
        frameworksDetected: [],
        imports: [],
      };
      const res = secRule.safeAutoFix!(content, finding as any, astCtx as any);
      if (res) {
        await ctx.writeFile(filePath, res.modifiedContent, content);
        return { success: true, stepsApplied: [res.description] };
      }
      return { success: false, stepsApplied: [], error: "Fix could not be automatically applied." };
    },
    verify: async () => {
      const filePath = path.join(ctx.rootDir, targetFile);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const astCtx = {
          filePath: targetFile,
          fileContent: content,
          isFrontend: false,
          isBackend: true,
          isConfigFile: false,
          isTestFile: false,
          isDocFile: false,
          frameworksDetected: [],
          imports: [],
        };
        const res = secRule.safeAutoFix!(content, finding as any, astCtx as any);
        if (!res) return { passed: true, message: `Verified ${secRule.id} issue fixed.` };
      } catch {}
      return { passed: false, message: `Issue ${secRule.id} still present in ${targetFile}.` };
    },
    undo: async () => {},
  };

  return [fix];
}
