import type { Fix, FixOptions, ScanFinding } from "../../../types/index.js";

export interface FixPlanContext {
  rootDir: string;
  options: FixOptions;
  addedTypes: Set<string>;
  config?: any;
  readFile: (p: string) => Promise<string>;
  writeFile: (p: string, n: string, o?: string) => Promise<void>;
}

export type FixStrategyHandler = (
  finding: ScanFinding,
  ctx: FixPlanContext,
) => Promise<Fix[] | null>;
