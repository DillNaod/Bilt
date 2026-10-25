// ─── Scan Step Execution Context ─────────────────────────────────────────────

import type { ScanOptions, FrameworkInfo } from "../../../types/index.js";

export interface ScanStepContext {
  rootDir: string;
  config: any;
  options: ScanOptions;
  detectedFramework?: FrameworkInfo;
}
