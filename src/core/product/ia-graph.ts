// ─── L5: Information Architecture Graph ──────────────────────────────────────
// Builds a directed reachability graph of pages, layouts, and links to detect
// orphan pages and dead navigation links.
// ─────────────────────────────────────────────────────────────────────────────

import type { RouteModel } from "../model/project-model.js";
import type { Provenance } from "../facts/fact.js";

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

export function buildIAGraph(
  routes: readonly RouteModel[],
  files: readonly { path: string; content: string }[]
): IAGraph {
  const nodes = new Map<string, IANode>();
  const edges: IAEdge[] = [];
  const roots: string[] = [];

  for (const r of routes) {
    if (r.kind === "page" || r.kind === "layout") {
      nodes.set(r.path, {
        route: r,
        primaryActions: [],
      });
      // Root routes: /, /dashboard, or layouts
      if (r.path === "/" || r.path === "/dashboard" || r.kind === "layout") {
        roots.push(r.path);
      }
    }
  }

  // Scan files for link references (<Link href=...>, <a href=...>, router.push(...))
  for (const file of files) {
    const content = file.content;
    const isNav = /navbar|sidebar|navigation|header/i.test(file.path);

    const linkRegex = /(?:href|to)\s*=\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(content)) !== null) {
      const target = match[1]!;
      if (!target || target.startsWith("http") || target.startsWith("#") || target.startsWith("mailto:")) {
        continue;
      }

      // Determine source route path
      const sourceRoute = routes.find((r) => r.source.file === file.path)?.path || (isNav ? "/" : "/");

      edges.push({
        from: sourceRoute,
        to: target,
        via: isNav ? "nav" : "link",
        at: {
          file: file.path,
          startLine: content.slice(0, match.index).split("\n").length,
          endLine: content.slice(0, match.index).split("\n").length,
        },
      });

      if (isNav && !roots.includes(target)) {
        roots.push(target);
      }
    }
  }

  // If roots is empty but we have routes, default root to "/" or first page
  if (roots.length === 0 && routes.length > 0) {
    roots.push(routes[0]!.path);
  }

  return { nodes, edges, roots };
}

export function computeReachable(graph: IAGraph): Set<string> {
  const seen = new Set<string>(graph.roots);
  const queue = [...graph.roots];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.from === curr && !seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
    }
  }

  return seen;
}
