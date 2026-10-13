// ─── Testkit: Architecture Lint ───────────────────────────────────────────────
// Rules may never read raw files or run child processes directly.
// Rules may only query the frozen ProjectModel via QueryFacade.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { RuleDef } from "../core/rules/registry.js";
import type { QueryFacade } from "../core/model/query-facade.js";
import { guarded } from "../core/model/query-facade.js";

export const FORBIDDEN_IMPORT_PATTERNS = [
  /^node:fs/,
  /^fs$/,
  /^fs\/promises$/,
  /core\/ingest/,
  /core\/facts\/extractors/,
  /^child_process$/,
  /^node:child_process$/,
];

export interface ArchLintViolation {
  file: string;
  imported: string;
  reason: string;
}

export async function lintRuleImports(rulesDir: string): Promise<ArchLintViolation[]> {
  const violations: ArchLintViolation[] = [];
  const files = await fg(["**/*.ts"], {
    cwd: rulesDir,
    absolute: true,
    ignore: ["**/providers.ts"],
  });

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    // Extract import statements
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const specifier = match[1];
      if (!specifier) continue;
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(specifier)) {
          violations.push({
            file: path.relative(rulesDir, file),
            imported: specifier,
            reason: `Rules may only use QueryFacade; direct access via '${specifier}' is forbidden.`,
          });
          break;
        }
      }
    }
  }

  return violations;
}

export function checkRuleDeclaredFacts(
  rule: RuleDef,
  Q: QueryFacade,
): { ok: boolean; declared: readonly string[]; consumed: readonly string[]; undeclared: string[] } {
  const guardedQ = guarded(Q, rule);
  rule.detect(guardedQ);

  const declared = new Set(rule.consumes);
  const consumed = guardedQ.consumed();
  const undeclared: string[] = [];

  for (const fact of consumed) {
    if (!declared.has(fact)) {
      undeclared.push(fact);
    }
  }

  return {
    ok: undeclared.length === 0,
    declared: rule.consumes,
    consumed,
    undeclared,
  };
}
