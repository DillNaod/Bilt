// ─── Pipeline Types ───────────────────────────────────────────────────────────
// Type definitions for the analysis pipeline orchestrator.
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelinePhase {
  name: string;
  description: string;
}

export const PIPELINE_PHASES: PipelinePhase[] = [
  { name: 'discovery', description: 'Repository file discovery' },
  { name: 'extraction', description: 'AST / CSS / HTML / Config analysis' },
  { name: 'model', description: 'Normalized ProjectModel construction' },
  { name: 'relationships', description: 'Cross-component relationship analysis' },
  { name: 'rules', description: 'Rule engine evaluation' },
  { name: 'findings', description: 'Finding generation and fingerprinting' },
  { name: 'baseline', description: 'Baseline / regression analysis' },
];

export interface PipelineOptions {
  rootDir: string;
  files?: Array<{path: string; content: string}>;
  changed?: boolean;
  base?: string;
  includeCategories?: string[];  // filter to specific categories
  debug?: boolean;
  maxIterations?: number;
  cache?: boolean;
  sarif?: boolean;
  suppressions?: boolean;
}

export interface PipelineResult {
  phases: Record<string, {durationMs: number; status: 'ok' | 'skipped' | 'error'; error?: string}>;
  findings: import('../rule-registry/types.js').RuleFinding[];
  totalFilesScanned: number;
  buildTimeMs: number;
  sarifReport?: any;
  cached?: boolean;
}
