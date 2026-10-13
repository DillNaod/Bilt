// ─── L7: Rule Registry & Gates ────────────────────────────────────────────────
// Enforces quality and maturity gates at registration time:
// 1. Only stable, high-precision security rules may block CI.
// 2. Subjective design rules are advisory and severity-capped at low.
// 3. Duplicate rule IDs throw.
// ─────────────────────────────────────────────────────────────────────────────

import type { QueryFacade } from "../model/query-facade.js";
import type { Finding } from "../findings/finding.js";
import type { Fact } from "../facts/fact.js";

export type Category =
  | "security"
  | "design"
  | "architecture"
  | "performance"
  | "integrity"
  | "privacy"
  | "supply-chain"
  | "ux";

export interface Explanation {
  summary: string;
  remediation: string[];
}

import type { VerifyResult } from "../findings/verify.js";
export type { VerifyResult } from "../findings/verify.js";

export interface RuleDef {
  id: string; // CATEGORY-AREA-NNN, immutable once released
  category: Category;
  mode: "automated" | "advisory" | "review-required";
  severity: "critical" | "high" | "medium" | "low" | "info";
  precision: "high" | "medium" | "low";
  maturity: "stable" | "experimental";
  needs: "static" | "rendered";
  consumes: readonly string[]; // declared facts; lint compares to what detect() queried
  blocking?: boolean; // allowed only if precision high + maturity stable + security
  detect(Q: QueryFacade): Finding[];
  explain?(f: Finding): Explanation;
  verify?(Q: QueryFacade, before: Finding): VerifyResult;
  requiredFacts?(Q: QueryFacade): Fact<unknown>[];
}

const REGISTRY = new Map<string, RuleDef>();

export function registerRule(r: RuleDef): void {
  if (REGISTRY.has(r.id)) {
    throw new Error(`duplicate rule ${r.id}`);
  }
  if (r.blocking && !(r.category === "security" && r.precision === "high" && r.maturity === "stable")) {
    throw new Error(`${r.id}: only stable, high-precision security rules may block`);
  }
  if (r.category === "design" && r.mode === "automated" && r.severity !== "low" && r.severity !== "info") {
    throw new Error(`${r.id}: subjective design rules are advisory, capped at low severity`);
  }
  REGISTRY.set(r.id, Object.freeze({ ...r }));
}

export function getRule(id: string): RuleDef | undefined {
  return REGISTRY.get(id);
}

export function allRules(): RuleDef[] {
  return [...REGISTRY.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function clearRegistryForTesting(): void {
  REGISTRY.clear();
}
