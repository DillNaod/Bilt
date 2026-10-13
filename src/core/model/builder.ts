// ─── L2: Model Builder ─────────────────────────────────────────────────────────
// Builds the frozen ProjectModel from ingested files and extracted facts.
// ─────────────────────────────────────────────────────────────────────────────

import type { IngestedFile } from "../ingest/limits.js";
import type { ExtractCtx } from "../facts/extractor.js";
import type {
  ProjectModel,
  RouteModel,
  ComponentModel,
  ApiEndpointModel,
  ProductArchetype,
} from "./project-model.js";
import { confirmed, absent } from "../facts/fact.js";

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

import { nextAdapter } from "../adapters/next.js";
import { expressAdapter } from "../adapters/express.js";
import { nestAdapter } from "../adapters/nest.js";
import type { FrameworkAdapter } from "../adapters/adapter.js";
import { solveTaint } from "../flow/taint.js";
import { buildApiSecurityModel } from "../flow/api-security.js";
import { buildStyleModel } from "../style/resolver.js";

export const ADAPTERS: FrameworkAdapter[] = [nextAdapter, expressAdapter, nestAdapter];

export async function buildModel(repo: RepoIndex, ctx: ExtractCtx): Promise<ProjectModel> {
  const routes: RouteModel[] = [];
  const apiEndpoints: ApiEndpointModel[] = [];
  const components: ComponentModel[] = [];

  for (const file of repo.files) {
    if (file.skipped) continue;
    ctx.coverage.fileParsed();
  }

  // Run framework adapters
  const active = ADAPTERS.filter((a) => a.detect(repo).matches);
  for (const adapter of active) {
    ctx.coverage.frameworkDetected(adapter.id, true);
    const extracted = adapter.extractRoutes(repo, ctx);
    for (const r of extracted) {
      routes.push(r);
      if (r.kind === "api") {
        apiEndpoints.push({
          id: r.id,
          method: r.methods[0] || "GET",
          path: r.path,
          file: r.source.file,
          line: r.source.startLine || 1,
          handler: r.handler,
          isPublic: r.isPublic,
          middlewareChain: r.middlewareChain,
        });
        ctx.coverage.routeResolved();
      }
    }
  }

  // Fallback heuristic if no adapter matched
  if (routes.length === 0) {
    for (const file of repo.files) {
      if (file.skipped) continue;
      const isApi = file.path.includes("api/") || file.path.includes("routes/") || file.path.includes("controllers/");
      if (isApi) {
        const match = file.path.match(/(?:api|routes)\/(.+?)(?:\.[^.]+)?$/);
        const subpath = match ? match[1] : "index";
        const routePath = `/api/${subpath}`;
        const routeId = `GET:${routePath}`;
        const source = { file: file.path, startLine: 1, endLine: 1 };

        const r: RouteModel = {
          id: routeId,
          path: routePath,
          kind: "api",
          methods: ["GET"],
          handler: { name: "handler", file: file.path, line: 1 },
          middlewareChain: confirmed([], [source]),
          params: [],
          isPublic: confirmed(true, [source]),
          source,
        };
        routes.push(r);
        apiEndpoints.push({
          id: routeId,
          method: "GET",
          path: routePath,
          file: file.path,
          line: 1,
          handler: r.handler,
          isPublic: r.isPublic,
          middlewareChain: r.middlewareChain,
        });
        ctx.coverage.routeResolved();
      }
    }
  }

  // Compute dataflow and taint paths
  const taintPaths = solveTaint(repo);

  // Synthesize security model for each API endpoint
  for (const ep of apiEndpoints) {
    const matchingRoute = routes.find((r) => r.id === ep.id);
    if (matchingRoute) {
      ep.securityModel = buildApiSecurityModel(ep, matchingRoute, taintPaths);
    }
  }

  // Resolve design-system styles
  const styles = await buildStyleModel(repo);

  const archetype = confirmed<ProductArchetype>(
    routes.length > 0 ? "saas-dashboard" : "landing-only",
    [{ file: "package.json" }]
  );

  const model: ProjectModel = {
    rootDir: repo.rootDir,
    files: repo.files.map((f) => ({
      path: f.path,
      absolutePath: `${repo.rootDir}/${f.path}`,
      size: f.bytes.length,
      content: f.bytes.toString("utf8"),
    })),
    dependencies: [],
    routes,
    components,
    componentGraph: [],
    apiEndpoints,
    entities: [],
    claims: [],
    styles,
    auth: {
      detected: false,
      providers: [],
      hasMiddleware: false,
    },
    authorization: {
      detected: false,
      hasRoleChecks: false,
      unprotectedRoutesCount: routes.length,
    },
    database: {
      detected: false,
      hasDirectQueries: false,
    },
    environment: {
      envFiles: [],
      missingVarsCount: 0,
    },
    requirements: [],
    archetype,
    coverage: ctx.coverage.snapshot(),
    timestamp: new Date().toISOString(),
  };

  return Object.freeze(model);
}
