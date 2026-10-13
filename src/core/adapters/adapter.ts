// ─── L2: Framework Adapter Interface ──────────────────────────────────────────
// Framework adapters normalize Next.js, Express, NestJS, etc. into identical
// RouteModel, ApiEndpointModel, and Middleware facts.
// ─────────────────────────────────────────────────────────────────────────────

import type { RepoIndex } from "../model/builder.js";
import type { ExtractCtx } from "../facts/extractor.js";
import type { RouteModel, MiddlewareRef } from "../model/project-model.js";
import type { Fact, Provenance } from "../facts/fact.js";

export interface DatabaseOperation {
  type: "read" | "write" | "delete" | "query";
  entity?: string;
  fields?: string[];
  where?: { field: string; from: string }[];
  at: Provenance;
}

export interface FrameworkAdapter {
  id: string; // e.g. "next", "express", "nest"
  detect(repo: RepoIndex): { matches: boolean; version?: string };
  extractRoutes(repo: RepoIndex, ctx: ExtractCtx): RouteModel[];
  extractMiddlewareChain(route: RouteModel, repo: RepoIndex): Fact<MiddlewareRef[]>;
  extractDataAccess(repo: RepoIndex): DatabaseOperation[];
}
