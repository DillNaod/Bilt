// ─── Analysis Pipeline Orchestrator ──────────────────────────────────────────
// Runs the multi-phase analysis pipeline: discover → extract → model → rules → findings.
// Designed to degrade gracefully when upstream modules (e.g. project-model builder)
// are not yet available.
// ─────────────────────────────────────────────────────────────────────────────

import fg from 'fast-glob';
import type { PipelineOptions, PipelineResult } from './types.js';
import type { RuleFinding, ProjectModel } from '../rule-registry/types.js';
import { ruleRegistry } from '../rule-registry/index.js';

type PhaseStatus = 'ok' | 'skipped' | 'error';

interface PhaseRecord {
  durationMs: number;
  status: PhaseStatus;
  error?: string;
}

function phase(name: string, durationMs: number, status: PhaseStatus, error?: string): [string, PhaseRecord] {
  return [name, { durationMs, status, error }];
}

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}

/**
 * Attempt to load the ProjectModel builder. Returns null if module is unavailable.
 */
async function tryLoadBuilder(): Promise<
  | { buildProjectModel: (rootDir: string, opts?: { files?: Array<{path: string; content: string}> }) => Promise<ProjectModel> }
  | null
> {
  try {
    // Dynamic import so a missing module causes graceful degradation, not a build error.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('../project-model/builder.js') as any;
    if (typeof mod.buildProjectModel === 'function') {
      return mod as { buildProjectModel: (rootDir: string, opts?: { files?: Array<{path: string; content: string}> }) => Promise<ProjectModel> };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Run the full analysis pipeline against a repository root.
 */
export async function runAnalysisPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const pipelineStart = performance.now();
  const phases: Record<string, PhaseRecord> = {};

  // ── Phase 1: Discovery ────────────────────────────────────────────────────
  const discoveryStart = performance.now();
  let discoveredFiles: string[] = [];
  try {
    if (options.files && options.files.length > 0) {
      discoveredFiles = options.files.map((f) => f.path);
    } else {
      discoveredFiles = await fg(
        ['**/*.{ts,tsx,js,jsx,css,scss,json,prisma}'],
        {
          cwd: options.rootDir,
          ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/.git/**',
            '**/coverage/**',
          ],
          absolute: false,
        },
      );
    }
    const [k, v] = phase('discovery', elapsed(discoveryStart), 'ok');
    phases[k] = v;
  } catch (err) {
    const [k, v] = phase('discovery', elapsed(discoveryStart), 'error', String(err));
    phases[k] = v;
    return {
      phases,
      findings: [],
      totalFilesScanned: 0,
      buildTimeMs: elapsed(pipelineStart),
    };
  }

  // ── Phase 2: Extraction ───────────────────────────────────────────────────
  // Stubbed — actual AST/CSS extraction happens inside the builder.
  const [extK, extV] = phase('extraction', 0, 'skipped');
  phases[extK] = extV;

  // ── Phase 3: Model ────────────────────────────────────────────────────────
  const modelStart = performance.now();
  let model: ProjectModel | null = null;
  try {
    const builder = await tryLoadBuilder();
    if (builder) {
      model = await builder.buildProjectModel(options.rootDir, { files: options.files });
      const [k, v] = phase('model', elapsed(modelStart), 'ok');
      phases[k] = v;
    } else {
      // ProjectModel builder not yet implemented — skip model + dependent phases.
      const [k, v] = phase('model', elapsed(modelStart), 'skipped', 'project-model/builder not available');
      phases[k] = v;

      for (const name of ['relationships', 'rules', 'findings', 'baseline']) {
        phases[name] = { durationMs: 0, status: 'skipped' };
      }

      return {
        phases,
        findings: [],
        totalFilesScanned: discoveredFiles.length,
        buildTimeMs: elapsed(pipelineStart),
      };
    }
  } catch (err) {
    const [k, v] = phase('model', elapsed(modelStart), 'error', String(err));
    phases[k] = v;
    if (options.debug) {
      console.error('[pipeline] ProjectModel build failed:', err);
    }
    for (const name of ['relationships', 'rules', 'findings', 'baseline']) {
      phases[name] = { durationMs: 0, status: 'skipped' };
    }
    return {
      phases,
      findings: [],
      totalFilesScanned: discoveredFiles.length,
      buildTimeMs: elapsed(pipelineStart),
    };
  }

  // ── Phase 4: Relationships ────────────────────────────────────────────────
  // Relationship analysis is performed inside the builder; this phase is a hook.
  phases['relationships'] = { durationMs: 0, status: 'skipped' };

  // ── Phase 5: Rules ────────────────────────────────────────────────────────
  const rulesStart = performance.now();
  let findings: RuleFinding[] = [];
  try {
    const ruleIds = options.includeCategories
      ? ruleRegistry.list()
          .filter((r) => options.includeCategories!.includes(r.category))
          .map((r) => r.id)
      : undefined;

    findings = ruleRegistry.run(model, ruleIds);
    const [k, v] = phase('rules', elapsed(rulesStart), 'ok');
    phases[k] = v;
  } catch (err) {
    const [k, v] = phase('rules', elapsed(rulesStart), 'error', String(err));
    phases[k] = v;
    if (options.debug) {
      console.error('[pipeline] Rule evaluation failed:', err);
    }
  }

  // ── Phase 6: Findings ─────────────────────────────────────────────────────
  phases['findings'] = { durationMs: 0, status: 'ok' };

  // ── Phase 7: Baseline ─────────────────────────────────────────────────────
  phases['baseline'] = { durationMs: 0, status: 'skipped' };

  return {
    phases,
    findings,
    totalFilesScanned: discoveredFiles.length,
    buildTimeMs: elapsed(pipelineStart),
  };
}
