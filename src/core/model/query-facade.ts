// ─── L2: Query Facade ─────────────────────────────────────────────────────────
// Rules see only this read-only facade. It provides indexed queries over frozen data,
// offers zero file system access, and tracks fact access for architecture linting.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ProjectModel,
  RouteModel,
  ApiEndpointModel,
  ApiSecurityModel,
  ComponentModel,
  ComponentId,
  NormalizedTree,
  SymbolRef,
  FlowPath,
  SourceKind,
  SinkKind,
  EntityModel,
  ProductClaim,
  ProductArchetype,
  AuthModel,
  AuthorizationModel,
  DatabaseModel,
} from "./project-model.js";
import type { Fact } from "../facts/fact.js";
import { absent } from "../facts/fact.js";
import type { CoverageReport } from "../facts/coverage.js";
import type { Requirement } from "../contract/requirements.js";
import type { DesignBrief } from "../design/brief/types.js";

export type ModelFact =
  | "routes"
  | "endpoints"
  | "securityModel"
  | "components"
  | "componentTree"
  | "callers"
  | "dataflow"
  | "entities"
  | "claims"
  | "archetype"
  | "coverage"
  | "auth"
  | "authorization"
  | "database"
  | "requirements"
  | "designBrief"
  | "styles";

export interface QueryFacade {
  routes(filter?: { kind?: RouteModel["kind"]; public?: boolean }): readonly RouteModel[];
  endpoint(method: string, path: string): ApiEndpointModel | undefined;
  securityModel(endpoint: ApiEndpointModel): Fact<ApiSecurityModel>;
  components(filter?: { name?: RegExp; usesHook?: string }): readonly ComponentModel[];
  componentTree(id: ComponentId): NormalizedTree;
  callers(sym: SymbolRef): readonly SymbolRef[];
  dataflow(from: SourceKind, to: SinkKind): readonly FlowPath[];
  entity(name: string): EntityModel | undefined;
  claims(): readonly ProductClaim[];
  archetype(): ProductArchetype | "unknown";
  coverage(): CoverageReport;
  hasRenderedFacts(): boolean;
  auth(): AuthModel;
  authorization(): AuthorizationModel;
  database(): DatabaseModel;
  requirements(): readonly Requirement[];
  designBrief(): DesignBrief | undefined;
  styles(): import("../style/model.js").StyleModel | undefined;
  consumed(): readonly string[];
}

export function createQueryFacade(model: ProjectModel): QueryFacade {
  const consumedSet = new Set<string>();

  // Indexes
  const endpointIndex = new Map<string, ApiEndpointModel>();
  for (const ep of model.apiEndpoints || []) {
    const key = `${ep.method.toUpperCase()} ${ep.path}`;
    endpointIndex.set(key, ep);
  }

  const entityIndex = new Map<string, EntityModel>();
  for (const ent of model.entities || []) {
    entityIndex.set(ent.name, ent);
  }

  const componentIndex = new Map<string, ComponentModel>();
  for (const comp of model.components || []) {
    componentIndex.set(comp.id, comp);
  }

  const frozenModel = Object.freeze(model);

  const facade: QueryFacade = {
    routes(filter) {
      consumedSet.add("routes");
      let list = frozenModel.routes || [];
      if (filter) {
        if (filter.kind) list = list.filter((r) => r.kind === filter.kind);
        if (filter.public !== undefined) {
          list = list.filter((r) => r.isPublic.state === "confirmed" && r.isPublic.value === filter.public);
        }
      }
      return Object.freeze([...list]);
    },

    endpoint(method, path) {
      consumedSet.add("endpoints");
      return endpointIndex.get(`${method.toUpperCase()} ${path}`);
    },

    securityModel(endpoint) {
      consumedSet.add("securityModel");
      if (endpoint.securityModel) return endpoint.securityModel;
      return absent([{ file: endpoint.file, line: endpoint.line }]);
    },

    components(filter) {
      consumedSet.add("components");
      let list = frozenModel.components || [];
      if (filter?.name) {
        list = list.filter((c) => filter.name!.test(c.name));
      }
      return Object.freeze([...list]);
    },

    componentTree(id) {
      consumedSet.add("componentTree");
      const comp = componentIndex.get(id);
      return (
        comp?.tree || {
          signature: comp?.name || id,
          depth: 1,
          nodes: 1,
        }
      );
    },

    callers(_sym) {
      consumedSet.add("callers");
      return Object.freeze([]);
    },

    dataflow(_from, _to) {
      consumedSet.add("dataflow");
      return Object.freeze([]);
    },

    entity(name) {
      consumedSet.add("entities");
      return entityIndex.get(name);
    },

    claims() {
      consumedSet.add("claims");
      return Object.freeze([...(frozenModel.claims || [])]);
    },

    archetype() {
      consumedSet.add("archetype");
      if (frozenModel.archetype && frozenModel.archetype.state === "confirmed") {
        return frozenModel.archetype.value;
      }
      return "unknown";
    },

    coverage() {
      consumedSet.add("coverage");
      return frozenModel.coverage;
    },

    hasRenderedFacts() {
      return false;
    },

    auth() {
      consumedSet.add("auth");
      return frozenModel.auth;
    },

    authorization() {
      consumedSet.add("authorization");
      return frozenModel.authorization;
    },

    database() {
      consumedSet.add("database");
      return frozenModel.database;
    },

    requirements() {
      consumedSet.add("requirements");
      return Object.freeze([...(frozenModel.requirements || [])]);
    },

    designBrief() {
      consumedSet.add("designBrief");
      return frozenModel.designBrief;
    },

    styles() {
      consumedSet.add("styles");
      return frozenModel.styles;
    },

    consumed() {
      return Object.freeze(Array.from(consumedSet).sort());
    },
  };

  return facade;
}

const METHOD_TO_FACT: Record<string, string> = {
  endpoint: "endpoints",
  entity: "entities",
};

/**
 * Wraps QueryFacade for a specific rule run to track exactly which facts that rule consumed.
 */
export function guarded(Q: QueryFacade, _rule: { id: string; consumes: readonly string[] }): QueryFacade {
  const localConsumed = new Set<string>();

  return new Proxy(Q, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && prop in target) {
        if (prop !== "consumed" && prop !== "hasRenderedFacts") {
          const factName = METHOD_TO_FACT[prop] || prop;
          localConsumed.add(factName);
        }
      }
      if (prop === "consumed") {
        return () => Object.freeze(Array.from(localConsumed).sort());
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
