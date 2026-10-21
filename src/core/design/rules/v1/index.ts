// ─── Design Quality & Anti-Vibecoding Rule Catalog (v1) ───────────────────────
// Versioned rules evaluating normalized DesignSnapshot intermediate representations.
// Deterministic static analysis; no external LLM execution.
// Pure functions only.
// ─────────────────────────────────────────────────────────────────────────────

import type { DesignRule } from "../../types.js";
import { COMBINATION_RULES } from "./combinations.js";
import { VISUAL_RULES } from "./visual.js";
import { LAYOUT_RULES } from "./layout.js";
import { INTERACTION_RULES } from "./interaction.js";
import { CONTENT_RULES } from "./content.js";
import { AUTHENTICITY_RULES } from "./authenticity.js";
import { A11Y_RULES } from "./a11y.js";
import { UX_STATE_RULES } from "./ux-states.js";

export const RULE_CATALOG_VERSION = "v1";

export const DESIGN_RULES_V1: DesignRule[] = [
  ...COMBINATION_RULES,
  ...VISUAL_RULES,
  ...LAYOUT_RULES,
  ...INTERACTION_RULES,
  ...CONTENT_RULES,
  ...AUTHENTICITY_RULES,
  ...A11Y_RULES,
  ...UX_STATE_RULES,
];

export * from "./combinations.js";
export * from "./visual.js";
export * from "./layout.js";
export * from "./interaction.js";
export * from "./content.js";
export * from "./authenticity.js";
export * from "./a11y.js";
export * from "./ux-states.js";
