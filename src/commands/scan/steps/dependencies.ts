// ─── Scan Step: Dependencies & Lockfiles ──────────────────────────────────────

import type { ScanFinding, Severity } from "../../../types/index.js";
import { scanDependencies } from "../../../core/scan/dependencies.js";
import { applyOverridesAndFilter } from "../filter.js";
import type { ScanStepContext } from "./context.js";

export async function runDependenciesStep(
  ctx: ScanStepContext,
): Promise<ScanFinding[]> {
  const stepFindings = await scanDependencies(ctx.rootDir, ctx.config);
  return applyOverridesAndFilter(
    stepFindings,
    ctx.config,
    ctx.options.severity as Severity,
  );
}
