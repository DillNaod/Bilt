// ─── L2 Adapter: NestJS ──────────────────────────────────────────────────────
// Normalizes NestJS Controllers (@Controller, @Get, @UseGuards) into RouteModel facts.
// ─────────────────────────────────────────────────────────────────────────────

import type { FrameworkAdapter, DatabaseOperation } from "./adapter.js";
import type { RepoIndex } from "../model/builder.js";
import type { ExtractCtx } from "../facts/extractor.js";
import type { RouteModel, MiddlewareRef } from "../model/project-model.js";
import type { Fact, Provenance } from "../facts/fact.js";
import { confirmed } from "../facts/fact.js";

function extractParams(routePath: string): string[] {
  const matches = routePath.match(/:([a-zA-Z0-9_]+)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

export const nestAdapter: FrameworkAdapter = {
  id: "nest",

  detect(repo: RepoIndex) {
    const pkg = repo.file("package.json");
    if (pkg) {
      const text = pkg.bytes.toString("utf8");
      if (text.includes('"@nestjs/common"') || text.includes('"@nestjs/core"')) {
        return { matches: true, version: "10.x" };
      }
    }
    return {
      matches: repo.files.some((f) => {
        const text = f.bytes.toString("utf8");
        return text.includes("@Controller") || text.includes("@Injectable");
      }),
    };
  },

  extractRoutes(repo: RepoIndex, _ctx: ExtractCtx): RouteModel[] {
    const routes: RouteModel[] = [];

    for (const file of repo.files) {
      if (file.skipped) continue;
      const content = file.bytes.toString("utf8");
      if (!content.includes("@Controller")) continue;

      // Extract class-level @Controller('users') or @Controller('api/users')
      const controllerMatch = /@Controller\(\s*['"`]?([^'"`]*)['"`]?\s*\)/.exec(content);
      const controllerPrefix = controllerMatch ? controllerMatch[1]!.replace(/^\/+|\/+$/g, "") : "";

      // Extract class-level guards: @UseGuards(AuthGuard)
      const classGuardsMatch = /@UseGuards\(\s*([a-zA-Z0-9_,\s]+)\s*\)/.exec(content);
      const classGuards: string[] = classGuardsMatch
        ? classGuardsMatch[1]!.split(",").map((g) => g.trim()).filter(Boolean)
        : [];

      // Extract method routes: @Get(':id') or @Get()
      const methodRegex = /(?:@UseGuards\(\s*([a-zA-Z0-9_,\s]+)\s*\)\s*)?@(Get|Post|Put|Patch|Delete)\(\s*['"`]?([^'"`]*)['"`]?\s*\)\s*(?:async\s+)?([a-zA-Z0-9_]+)\s*\(/g;
      let match: RegExpExecArray | null;

      while ((match = methodRegex.exec(content)) !== null) {
        const methodGuards = match[1] ? match[1].split(",").map((g) => g.trim()).filter(Boolean) : [];
        const httpMethod = match[2]!.toUpperCase();
        const subPath = match[3] ? match[3].replace(/^\/+|\/+$/g, "") : "";
        const methodName = match[4]!;

        const line = content.slice(0, match.index).split("\n").length;
        const source: Provenance = { file: file.path, startLine: line, endLine: line };

        const fullPath = "/" + [controllerPrefix, subPath].filter(Boolean).join("/");
        const allGuards = [...classGuards, ...methodGuards];

        const middlewares: MiddlewareRef[] = allGuards.map((g) => ({
          name: g,
          dominatesEffects: true,
          ref: { name: g, file: file.path, line },
        }));

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
          id: `${httpMethod}:${fullPath}`,
          path: fullPath,
          kind: fullPath.startsWith("/api") || fullPath.startsWith("/users") ? "api" : "page",
          methods: [httpMethod],
          handler: { name: methodName, file: file.path, line },
          middlewareChain: confirmed(middlewares, [source]),
          params: extractParams(fullPath),
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
      const repoRegex = /(?:this\.[a-zA-Z0-9_]+Repository)\.(findOne|find|save|delete)\s*\(/g;
      let match: RegExpExecArray | null;
      while ((match = repoRegex.exec(content)) !== null) {
        const opName = match[1]!;
        const line = content.slice(0, match.index).split("\n").length;
        const type = opName.startsWith("find") ? "read" : opName.startsWith("delete") ? "delete" : "write";
        ops.push({
          type,
          at: { file: f.path, startLine: line, endLine: line },
        });
      }
    }
    return ops;
  },
};
