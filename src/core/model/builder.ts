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

export async function buildModel(repo: RepoIndex, ctx: ExtractCtx): Promise<ProjectModel> {
  const routes: RouteModel[] = [];
  const apiEndpoints: ApiEndpointModel[] = [];
  const components: ComponentModel[] = [];

  for (const file of repo.files) {
    if (file.skipped) continue;
    ctx.coverage.fileParsed();

    const isApi = file.path.includes("api/") || file.path.includes("routes/") || file.path.includes("controllers/");
    if (isApi) {
      const match = file.path.match(/(?:api|routes)\/(.+?)(?:\.[^.]+)?$/);
      const subpath = match ? match[1] : "index";
      const routePath = `/api/${subpath}`;
      const routeId = `GET:${routePath}`;
      const source = { file: file.path, line: 1 };

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
