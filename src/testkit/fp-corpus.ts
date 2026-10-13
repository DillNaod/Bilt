// ─── Testkit: False-Positive Corpus Runner ─────────────────────────────────────
// Measures false-positive rate across benchmark clean projects and asserts that
// every rule remains strictly within its precision-tier false-positive budget.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../core/rules/registry.js";
import { FP_BUDGET } from "./promotion-gate.js";
import type { QueryFacade } from "../core/model/query-facade.js";

export interface CorpusProject {
  name: string;
  facade: QueryFacade;
  expectedFindings: string[]; // Rule IDs expected to trigger on this project (if any)
}

export interface CorpusMeasurement {
  ruleId: string;
  totalCleanProjects: number;
  falsePositives: number;
  falsePositiveRate: number;
  budget: number;
  withinBudget: boolean;
}

export function measureFpRate(rule: RuleDef, corpus: CorpusProject[]): CorpusMeasurement {
  let falsePositives = 0;
  let cleanProjects = 0;

  for (const project of corpus) {
    const isExpected = project.expectedFindings.includes(rule.id);
    if (!isExpected) {
      cleanProjects++;
      const findings = rule.detect(project.facade);
      if (findings.length > 0) {
        falsePositives += findings.length;
      }
    }
  }

  const rate = cleanProjects > 0 ? falsePositives / cleanProjects : 0;
  const budget = FP_BUDGET[rule.precision as keyof typeof FP_BUDGET] ?? 0.02;

  return {
    ruleId: rule.id,
    totalCleanProjects: cleanProjects,
    falsePositives,
    falsePositiveRate: rate,
    budget,
    withinBudget: rate <= budget,
  };
}
