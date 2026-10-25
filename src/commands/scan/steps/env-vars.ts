// ─── Scan Step: Environment Variable Usage ───────────────────────────────────

import type { ScanFinding } from "../../../types/index.js";
import { performEnvScan } from "../../../core/scan/env.js";
import type { ScanStepContext } from "./context.js";

export async function runEnvVariablesStep(
  ctx: ScanStepContext,
): Promise<ScanFinding[]> {
  return await performEnvScan(ctx.rootDir, ctx.config, {
    severity: ctx.options.severity,
    debug: ctx.options.debug,
  });
}
