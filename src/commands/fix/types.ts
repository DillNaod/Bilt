import type { FixOptions, ScanFinding, Fix } from "../../types/index.js";

export type { FixOptions, ScanFinding, Fix };

export interface FixExecutionResult {
  applied: number;
  skipped: number;
}
