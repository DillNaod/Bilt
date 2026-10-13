// ─── Rule Registry Types ─────────────────────────────────────────────────────
// Typed definitions for the unified rule registry layer.
// Rules registered here run against the normalized ProjectModel.
// ─────────────────────────────────────────────────────────────────────────────

import type { DesignBrief } from '../design/brief/types.js';
import type { ProjectModel } from '../project-model/types.js';

export type RuleCategory =
  | 'design'
  | 'design-composition'
  | 'design-structure'
  | 'design-hierarchy'
  | 'design-repetition'
  | 'design-system'
  | 'design-brief'
  | 'cross-page'
  | 'ux'
  | 'ux-states'
  | 'ux-state'
  | 'ux-flows'
  | 'ux-ia'
  | 'ux-fake-data'
  | 'accessibility'
  | 'security'
  | 'security-api'
  | 'security-flow'
  | 'security-privilege'
  | 'product-authenticity'
  | 'requirements';

export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RulePrecision = 'high' | 'medium' | 'low';
export type RuleMaturity = 'stable' | 'experimental';

export interface RuleFindingLocation {
  file: string;
  line?: number;
  endLine?: number;
  description?: string;
}

export interface RuleFinding {
  ruleId: string;
  title: string;
  severity: RuleSeverity;
  precision: RulePrecision;
  maturity: RuleMaturity;
  category: RuleCategory;
  evidence: string[];      // Structural evidence strings
  locations: RuleFindingLocation[];
  agentObjective?: string;  // What the agent should do about it
  description?: string;
  recommendation?: string;
  file?: string;
  line?: number;
  endLine?: number;
  fingerprint?: string;
  fixable?: boolean;
  introduced?: boolean;    // Was this introduced by recent change?
}

export interface RegisteredRule {
  id: string;
  category: RuleCategory;
  title: string;
  severity: RuleSeverity;
  precision: RulePrecision;
  maturity: RuleMaturity;
  description?: string;
  recommendation?: string;
  agentObjective?: string;
  detect?(model: ProjectModel): RuleFinding[];
  evaluate?(model: ProjectModel): RuleFinding[];
  verify?(model: ProjectModel, finding: RuleFinding): boolean;
  explain?(finding: RuleFinding): string;
}

export type Rule = RegisteredRule;

// Re-export ProjectModel and DesignBrief
export type { ProjectModel, DesignBrief };
