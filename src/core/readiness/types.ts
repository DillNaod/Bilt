import type {
  ReadinessCategory,
  CheckMode,
  EnforcementLevel,
  CategoryStatus,
} from "./taxonomy.js";
import type { BiltCheckFinding } from "./finding.js";
import type { GateResult } from "./readiness-gate.js";

export interface CheckRunnerOptions {
  dir: string;
  changed?: boolean;
  base?: string;
  format?: "human" | "agent";
  categories?: ReadinessCategory[];
}

export interface RouteMapEntry {
  method: string;
  path: string;
  file: string;
  line: number;
  resourceIdParam?: string;
}

export interface CheckContext {
  rootDir: string;
  files: Array<{ path: string; content: string }>;
  routeMap: RouteMapEntry[];
  ecosystem: any;
  changedFiles?: string[];
  dependencies?: any[];
  routes?: any[];
  components?: any[];
  packageJson?: any;
}

export interface CategoryCheckResult {
  category: ReadinessCategory;
  status: CategoryStatus;
  findings: BiltCheckFinding[];
  mode: CheckMode;
  enforcement: EnforcementLevel;
  unsupportedStack?: boolean;
}

export interface CategoryChecker {
  category: ReadinessCategory;
  mode: CheckMode;
  run(context: CheckContext): Promise<BiltCheckFinding[]>;
}

export interface CheckResult {
  gate: GateResult;
  findings: BiltCheckFinding[];
  categoryResults: Map<ReadinessCategory, CategoryCheckResult>;
  routeMap: RouteMapEntry[];
  unsupportedStackCategories: ReadinessCategory[];
  duration: number;
}
