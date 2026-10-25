// ─── Scan Step: API Security & Routes ─────────────────────────────────────────

import type { ScanFinding, Severity } from "../../../types/index.js";
import { performApiScan } from "../../../core/api-scan/index.js";
import { applyOverridesAndFilter } from "../filter.js";
import type { ScanStepContext } from "./context.js";

export async function runApiSecurityStep(
  ctx: ScanStepContext,
): Promise<ScanFinding[]> {
  const { findings: apiFindings } = await performApiScan(ctx.rootDir);
  return applyOverridesAndFilter(
    apiFindings,
    ctx.config,
    ctx.options.severity as Severity,
  );
}
