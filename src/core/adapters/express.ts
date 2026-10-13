// ─── L2 Adapter: Express ──────────────────────────────────────────────────────
// Normalizes Express routes (app.get, router.post, etc.) into RouteModel facts.
// ─────────────────────────────────────────────────────────────────────────────

import type { FrameworkAdapter, DatabaseOperation } from "./adapter.js";
import type { RepoIndex } from "../model/builder.js";
import type { ExtractCtx } from "../facts/extractor.js";
import type { RouteModel, MiddlewareRef } from "../model/project-model.js";
import type { Fact, Provenance } from "../facts/fact.js";
import { confirmed, absent } from "../facts/fact.js";

function extractParams(routePath: string): string[] {
  const matches = routePath.match(/:([a-zA-Z0-9_]+)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

export const expressAdapter: FrameworkAdapter = {
  id: "express",

  detect(repo: RepoIndex) {
    const pkg = repo.file("package.json");
    if (pkg) {
      const text = pkg.bytes.toString("utf8");
      if (text.includes('"express"')) return { matches: true, version: "4.x" };
    }
    for (const f of repo.files) {
      if (f.path.endsWith(".ts") || f.path.endsWith(".js")) {
        const text = f.bytes.toString("utf8");
        if (text.includes("express()") || text.includes('from "express"') || text.includes("from 'express'")) {
          return { matches: true };
        }
      }
    }
    return { matches: false };
  },

  extractRoutes(repo: RepoIndex, _ctx: ExtractCtx): RouteModel[] {
    const routes: RouteModel[] = [];

    for (const file of repo.files) {
      if (file.skipped) continue;
      const content = file.bytes.toString("utf8");
      const lines = content.split("\n");

      // Regex matching router.get('/users/:id', [middleware,] handler)
      const routeRegex = /(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([\s\S]*?)\)/g;
      let match: RegExpExecArray | null;

      while ((match = routeRegex.exec(content)) !== null) {
        const method = match[1]!.toUpperCase();
        const routePath = match[2]!;
        const argsStr = match[3]!;

        // Estimate line number
        const matchIndex = match.index;
        const line = content.slice(0, matchIndex).split("\n").length;
        const source: Provenance = { file: file.path, startLine: line, endLine: line };

        // Parse arguments passed after path
        const argParts = argsStr
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);

        const middlewares: MiddlewareRef[] = [];
        let handlerName = "handler";

        if (argParts.length > 1) {
          // All arguments except the last are middlewares
          for (let i = 0; i < argParts.length - 1; i++) {
            const mwName = argParts[i]!.replace(/\(.*?\)/, "").trim();
            middlewares.push({
              name: mwName,
              dominatesEffects: true,
              ref: { name: mwName, file: file.path, line },
            });
          }
          handlerName = argParts[argParts.length - 1]!.trim();
        } else if (argParts.length === 1) {
          handlerName = argParts[0]!;
        }

        const isPublic = confirmed(
          !middlewares.some(
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
          kind: routePath.startsWith("/api") || routePath.startsWith("/users") ? "api" : "page",
          methods: [method],
          handler: { name: handlerName, file: file.path, line },
          middlewareChain: confirmed(middlewares, [source]),
          params: extractParams(routePath),
          isPublic,
          source,
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
      // Find db.find, prisma.find, etc.
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
