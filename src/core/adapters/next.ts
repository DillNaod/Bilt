// ─── L2 Adapter: Next.js ──────────────────────────────────────────────────────
// Normalizes Next.js app & pages router route handlers into RouteModel facts.
// ─────────────────────────────────────────────────────────────────────────────

import type { FrameworkAdapter, DatabaseOperation } from "./adapter.js";
import type { RepoIndex } from "../model/builder.js";
import type { ExtractCtx } from "../facts/extractor.js";
import type { RouteModel, MiddlewareRef } from "../model/project-model.js";
import type { Fact, Provenance } from "../facts/fact.js";
import { confirmed } from "../facts/fact.js";

function appPathToRoute(filePath: string): { routePath: string; params: string[] } {
  // Strip app/ and /route.ts (or src/app/ ...)
  let clean = filePath
    .replace(/^(?:src\/)?app\//, "")
    .replace(/\/(?:route|page)\.[^.]+$/, "");

  const params: string[] = [];
  // Convert [param] -> :param
  clean = clean.replace(/\[([^\]]+)\]/g, (_, paramName) => {
    params.push(paramName);
    return `:${paramName}`;
  });

  return {
    routePath: `/${clean}`,
    params,
  };
}

export const nextAdapter: FrameworkAdapter = {
  id: "next",

  detect(repo: RepoIndex) {
    const pkg = repo.file("package.json");
    if (pkg) {
      const text = pkg.bytes.toString("utf8");
      if (text.includes('"next"')) return { matches: true, version: "14.x" };
    }
    return {
      matches: repo.files.some(
        (f) =>
          f.path.startsWith("app/") ||
          f.path.startsWith("src/app/") ||
          f.path.startsWith("pages/") ||
          f.path.startsWith("src/pages/") ||
          f.path.includes("next.config.")
      ),
    };
  },

  extractRoutes(repo: RepoIndex, _ctx: ExtractCtx): RouteModel[] {
    const routes: RouteModel[] = [];

    // Global middleware if present
    const mwFile = repo.file("middleware.ts") ?? repo.file("src/middleware.ts");
    const globalMw: MiddlewareRef[] = mwFile
      ? [{ name: "next:middleware", ref: { name: "middleware", file: mwFile.path, line: 1 } }]
      : [];

    for (const file of repo.files) {
      if (file.skipped) continue;
      const isRouteHandler =
        (file.path.includes("app/") || file.path.includes("src/app/")) &&
        (file.path.endsWith("/route.ts") || file.path.endsWith("/route.js"));

      if (!isRouteHandler) continue;

      const { routePath, params } = appPathToRoute(file.path);
      const content = file.bytes.toString("utf8");
      const source: Provenance = { file: file.path, startLine: 1, endLine: 1 };

      // Find exported methods: export async function GET or export const GET = ...
      const methodRegex = /export\s+(?:async\s+function|(?:const|let|var))\s+(GET|POST|PUT|PATCH|DELETE)\s*(?:=\s*([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)|\()/g;
      let match: RegExpExecArray | null;

      while ((match = methodRegex.exec(content)) !== null) {
        const method = match[1]!.toUpperCase();
        const wrapperName = match[2]; // e.g. withAuth or requireAuth
        const line = content.slice(0, match.index).split("\n").length;

        const chain: MiddlewareRef[] = [...globalMw];
        if (wrapperName) {
          chain.push({
            name: wrapperName,
            dominatesEffects: true,
            ref: { name: wrapperName, file: file.path, line },
          });
        }

        const isPublic = confirmed(
          !chain.some(
            (m) =>
              m.name.toLowerCase().includes("auth") ||
              m.name.toLowerCase().includes("guard") ||
              m.name.toLowerCase().includes("protect")
          ),
          [source]
        );

        routes.push({
          id: `${method}:${routePath}`,
          path: routePath,
          kind: "api",
          methods: [method],
          handler: { name: method.toLowerCase(), file: file.path, line },
          middlewareChain: confirmed(chain, [source]),
          params,
          isPublic,
          source: { file: file.path, startLine: line, endLine: line },
        });
      }
    }

    return routes;
  },

  extractMiddlewareChain(route: RouteModel, _repo: RepoIndex): Fact<MiddlewareRef[]> {
    return route.middlewareChain;
  },

  extractDataAccess(repo: RepoIndex): DatabaseOperation[] {
    const ops: DatabaseOperation[] = [];
    for (const f of repo.files) {
      const content = f.bytes.toString("utf8");
      const dbRegex = /(?:db|prisma)\.([a-zA-Z0-9_]+)\.(findUnique|findFirst|findMany|create|update|delete)\s*\(\s*(\{[\s\S]*?\})\s*\)/g;
      let match: RegExpExecArray | null;
      while ((match = dbRegex.exec(content)) !== null) {
        const entity = match[1]!;
        const opName = match[2]!;
        const line = content.slice(0, match.index).split("\n").length;
        const type = opName.startsWith("find") ? "read" : opName.startsWith("delete") ? "delete" : "write";
        ops.push({
          type,
          entity,
          at: { file: f.path, startLine: line, endLine: line },
        });
      }
    }
    return ops;
  },
};
