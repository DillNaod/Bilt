// ─── Scan Step: Tool & Deployment Configurations ─────────────────────────────

import type { ScanFinding, Severity } from "../../../types/index.js";
import { scanConfigurations } from "../../../core/scan/config.js";
import { applyOverridesAndFilter } from "../filter.js";
import type { ScanStepContext } from "./context.js";

export async function runConfigStep(
  ctx: ScanStepContext,
): Promise<ScanFinding[]> {
  const stepFindings = await scanConfigurations(ctx.rootDir);
  return applyOverridesAndFilter(
    stepFindings,
    ctx.config,
    ctx.options.severity as Severity,
  );
}
