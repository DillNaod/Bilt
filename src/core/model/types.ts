import type { FrameworkInfo } from "../../types/index.js";
import type { RouteMapEntry } from "../readiness/types.js";
import type { DesignBrief } from "../design/brief/types.js";
import type { Requirement } from "../contract/requirements.js";
import type { Fact, Provenance } from "../facts/fact.js";
import type { CoverageReport } from "../facts/coverage.js";
import type { IngestedFile } from "../ingest/limits.js";

export interface RepoIndex {
  rootDir: string;
  files: IngestedFile[];
  file(relPath: string): IngestedFile | undefined;
}

export function createRepoIndex(rootDir: string, files: IngestedFile[]): RepoIndex {
  const map = new Map<string, IngestedFile>();
  for (const f of files) {
    map.set(f.path, f);
  }
  return {
    rootDir,
    files,
    file(p: string) {
      return map.get(p);
    },
  };
}

export type RouteId = string;
export type ComponentId = string;

export interface SymbolRef {
  name: string;
  file: string;
  line?: number;
  exported?: boolean;
}

export interface MiddlewareRef {
  name: string;
  ref?: SymbolRef;
  dominatesEffects?: boolean;
}

export interface Edge<T> {
  from: T;
  to: T;
  kind?: string;
}

export interface NormalizedTree {
  signature: string;
  depth: number;
  nodes: number;
}

export interface ApiSecurityModel {
  endpoint: ApiEndpointModel;
  hasAuth: Fact<boolean>;
  hasOwnershipCheck: Fact<boolean>;
  hasInputValidation: Fact<boolean>;
  passesBodyToDb: boolean;
  sensitiveFieldsReturned: string[];
}

export interface ApiEndpointModel {
  id: string;
  method: string;
  path: string;
  file: string;
  line: number;
  framework?: string;
  handler: SymbolRef;
  isPublic: Fact<boolean>;
  middlewareChain: Fact<MiddlewareRef[]>;
  securityModel?: Fact<ApiSecurityModel>;
}

export interface ComponentModel {
  id: ComponentId;
  name: string;
  file: string;
  line: number;
  isSection?: boolean;
  isCard?: boolean;
  isModal?: boolean;
  isHero?: boolean;
  isDataDisplay?: boolean;
  hasLoadingState?: boolean;
  hasErrorState?: boolean;
  hasEmptyState?: boolean;
  tree?: NormalizedTree;
  decorativeSignals?: any[];
  ctaTexts?: string[];
  rawText?: string;
}

export interface EntityModel {
  name: string;
  file: string;
  fields: { name: string; type: string; isSensitive?: boolean }[];
  operations: { kind: "create" | "read" | "update" | "delete"; at: Provenance }[];
}

export interface ProductClaim {
  text: string;
  provenance: Provenance;
  category: "metric" | "security" | "feature" | "social-proof";
}

export interface FileInfo {
  path: string;
  absolutePath: string;
  size: number;
  content: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  isDev: boolean;
}

export interface AuthModel {
  detected: boolean;
  providers: string[];
  hasMiddleware: boolean;
  protectedRoutes?: string[];
  publicRoutes?: string[];
}

export interface AuthorizationModel {
  detected: boolean;
  hasRoleChecks: boolean;
  unprotectedRoutesCount: number;
}

export interface DatabaseModel {
  detected: boolean;
  orm?: string;
  hasDirectQueries: boolean;
}

export interface EnvironmentModel {
  envFiles: string[];
  missingVarsCount: number;
}

export type ProductArchetype =
  | "marketplace"
  | "saas-dashboard"
  | "editorial"
  | "ecommerce"
  | "internal-tool"
  | "docs-site"
  | "landing-only"
  | "unclassified";

export interface RouteModel {
  id: RouteId;
  path: string;
  kind: "page" | "api" | "action" | "layout";
  methods: string[];
  handler: SymbolRef;
  middlewareChain: Fact<MiddlewareRef[]>;
  params: string[];
  isPublic: Fact<boolean>;
  source: Provenance;
}

export type SourceKind =
  | "req.body"
  | "req.query"
  | "req.params"
  | "headers"
  | "cookies"
  | "upload"
  | "webhook"
  | "url-fetch-response"
  | "form-data";

export type SinkKind =
  | "orm-write"
  | "orm-where"
  | "raw-sql"
  | "exec"
  | "fs-path"
  | "redirect"
  | "fetch-url"
  | "html-inject"
  | "eval"
  | "response-body"
  | "log";

export type SanitizerKind =
  | "schema-validate"
  | "field-pick"
  | "parameterized-query"
  | "html-escape";

export interface Hop {
  at: Provenance;
  via: "assign" | "arg" | "return" | "spread" | "property" | "destructure";
}

export interface SanitizerInstance {
  kind: SanitizerKind;
  at: Provenance;
  library?: string;
  coversFields?: string[];
}

export interface FlowPath {
  source: { kind: SourceKind; at: Provenance };
  sink: { kind: SinkKind; at: Provenance; callee: string };
  hops: Hop[];
  sanitizers: SanitizerInstance[];
  complete: boolean;
}

export interface IAEdge {
  from: string;
  to: string;
  via: "nav" | "link" | "redirect" | "router.push";
  at: Provenance;
}

export interface IANode {
  route: RouteModel;
  primaryActions: string[];
}

export interface IAGraph {
  nodes: Map<string, IANode>;
  edges: IAEdge[];
  roots: string[];
}

export interface ProjectModel {
  rootDir: string;
  framework?: FrameworkInfo;
  frameworks?: Fact<FrameworkInfo>[];
  files: FileInfo[];
  dependencies: DependencyInfo[];
  routes: RouteModel[];
  routeEntries?: RouteMapEntry[];
  components: ComponentModel[];
  componentGraph: Edge<ComponentId>[];
  apiEndpoints: ApiEndpointModel[];
  entities: EntityModel[];
  claims: ProductClaim[];
  auth: AuthModel;
  authorization: AuthorizationModel;
  database: DatabaseModel;
  environment: EnvironmentModel;
  requirements: Requirement[];
  designBrief?: DesignBrief;
  archetype: Fact<ProductArchetype>;
  styles?: import("../style/model.js").StyleModel;
  taintPaths?: FlowPath[];
  uxStates?: import("../product/ux-states.js").UXStateModel[];
  flows?: import("../product/flows.js").FlowInstance[];
  iaGraph?: IAGraph;
  dialogs?: import("../product/a11y.js").DialogA11yModel[];
  clickableDivs?: import("../product/a11y.js").ClickableDivModel[];
  metricDisplays?: import("../product/claims.js").MetricDisplay[];
  coverage: CoverageReport;
  timestamp: string;
}
