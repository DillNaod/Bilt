// ─── Scan Step: Performance & Bundle Health ───────────────────────────────────

import type { ScanFinding, Severity } from "../../../types/index.js";
import { scanPerformance } from "../../../core/scan/performance.js";
import { applyOverridesAndFilter } from "../filter.js";
import type { ScanStepContext } from "./context.js";

export async function runPerformanceStep(
  ctx: ScanStepContext,
): Promise<ScanFinding[]> {
  const stepFindings = await scanPerformance(ctx.rootDir);
  return applyOverridesAndFilter(
    stepFindings,
    ctx.config,
    ctx.options.severity as Severity,
  );
}
