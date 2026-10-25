// ─── Scan Step: Deterministic Security Anti-Patterns ─────────────────────────

import path from "node:path";
import { promises as fs } from "node:fs";
import fg from "fast-glob";
import type { ScanFinding, Severity } from "../../../types/index.js";
import { SecurityRuleEngine } from "../../../core/security-engine/rule-engine.js";
import type { SecurityFindingDetails } from "../../../core/security-engine/types.js";
import { applyOverridesAndFilter } from "../filter.js";
import type { ScanStepContext } from "./context.js";

export async function runSecurityRulesStep(
  ctx: ScanStepContext,
): Promise<ScanFinding[]> {
  const stepFindings: ScanFinding[] = [];
  const ruleEngine = new SecurityRuleEngine();
  const scanTargets = await fg(
    ["**/*.{ts,js,tsx,jsx,json,yml,yaml,md,env*,Dockerfile}"],
    {
      cwd: ctx.rootDir,
      ignore: ctx.config.ignore,
      onlyFiles: true,
    },
  );

  const filePayloads: Array<{ path: string; content: string }> = [];
  for (const relPath of scanTargets) {
    const fullPath = path.join(ctx.rootDir, relPath);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.size > 1_048_576) continue;
      const content = await fs.readFile(fullPath, "utf-8");
      filePayloads.push({ path: relPath, content });
    } catch {
      // Skip unreadable files
    }
  }

  const engineFindings = ruleEngine.analyzeProject(
    filePayloads,
    ctx.detectedFramework ? [ctx.detectedFramework.name] : [],
  );

  engineFindings.forEach((ef: SecurityFindingDetails) => {
    stepFindings.push({
      id: `sec-rule-${ef.ruleId.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      severity: ef.severity,
      category: "framework-warning",
      message: `[${ef.ruleId}] ${ef.title}: ${ef.message}`,
      file: ef.evidence.file,
      line: ef.evidence.line,
      column: ef.evidence.column,
      suggestion: ef.suggestedFix,
      ruleId: ef.ruleId,
      confidence: ef.confidence,
      aiExplanation: {
        whatIsIt: `${ef.title}. ${ef.whyThisIsDangerous}`,
        whyIsItAProblem: ef.whyThisIsDangerous,
        howSerious: `${ef.severity.toUpperCase()} (${ef.confidence} confidence evidence)`,
        canItBeExploited: ef.howAttackersAbuseIt,
        howToFix: ef.suggestedFix,
        canBiltFix: ef.automaticFixAvailability.available,
      },
    });
  });

  return applyOverridesAndFilter(
    stepFindings,
    ctx.config,
    ctx.options.severity as Severity,
  );
}
