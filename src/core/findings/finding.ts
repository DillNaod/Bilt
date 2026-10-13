// ─── L8: Finding Shape & Evidence Types ───────────────────────────────────────
// A finding is a structured, evidence-carrying object with machine-checkable facts.
// ─────────────────────────────────────────────────────────────────────────────

import type { SearchScope } from "../facts/fact.js";
import { createHash } from "node:crypto";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "high" | "medium" | "low";

export interface EvidenceItem {
  claim: string;
  file?: string;
  line?: number;
  snippet?: string;
  factKind?: string;
}

export interface Location {
  file: string;
  line?: number;
  endLine?: number;
  column?: number;
  description?: string;
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  check: string;
}

export interface AgentAction {
  objective: string; // from rule templates only, never untrusted repo text
  acceptance: AcceptanceCriterion[];
  doNot: string[]; // e.g. "do not suppress", "do not delete route"
  safeToAutoFix: boolean;
}

export interface PriorityBreakdown {
  exposure: number;
  exploitability: number;
  blastRadius: number;
  fixCost: number;
  score: number;
}

export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  precision: Confidence;
  maturity: "stable" | "experimental";
  confidence: Confidence;
  status: "open" | "needs-review";
  evidence: EvidenceItem[];
  locations: Location[];
  whyItMatters: string;
  mightBeFalsePositive: string[];
  searched: SearchScope[];
  fingerprint: string;
  clusterId?: string;
  priority?: PriorityBreakdown;
  agentAction: AgentAction;
  introduced_by_change?: boolean;
}

export interface SubjectKey {
  kind: "endpoint" | "component" | "route" | "flow" | "token-scale" | "entity" | "generic";
  stableKey: string;
  shapeKey?: string;
}

export function computeSha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
