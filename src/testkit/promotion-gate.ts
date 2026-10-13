// ─── Testkit: Rule Promotion Gate ─────────────────────────────────────────────
// Validates whether an experimental rule meets the bar for promotion to stable.
// A stable rule requires positive, near-miss, and adversarial fixtures, dual verify tests,
// and must stay within its false-positive budget.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../core/rules/registry.js";

export interface RuleStats {
  fixtures: {
    truePositive: number;
    nearMiss: number;
    adversarial: number;
  };
  verify: {
    correctFix: number;
    wrongFix: number;
  };
  corpus: {
    falsePositiveRate: number;
  };
}

export const FP_BUDGET = {
  high: 0.02,
  medium: 0.1,
  low: 0.25,
} as const;

export function canBeStable(rule: RuleDef, stats: RuleStats): string[] {
  const problems: string[] = [];

  if (stats.fixtures.truePositive < 1) {
    problems.push("needs a true-positive fixture");
  }
  if (stats.fixtures.nearMiss < 1) {
    problems.push("needs a near-miss negative fixture");
  }
  if (stats.fixtures.adversarial < 1) {
    problems.push("needs an adversarial fixture (alias, re-export, wrapper)");
  }
  if (stats.verify.correctFix < 1 || stats.verify.wrongFix < 1) {
    problems.push("needs verify tests: one correct fix and one plausible wrong fix");
  }
  if (stats.corpus.falsePositiveRate > FP_BUDGET[rule.precision]) {
    problems.push(
      `false-positive rate ${stats.corpus.falsePositiveRate} exceeds budget of ${FP_BUDGET[rule.precision]} for ${rule.precision} precision`
    );
  }

  return problems;
}
