// ─── Information Architecture Rules ──────────────────────────────────────────
// Detects structural navigation problems: unreachable routes, dead links, and
// important actions buried too deep in the navigation hierarchy.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { Finding, PrecisionTier } from "../../finding/types.js";
import type { RegisteredRule, RuleFinding } from "../../rule-registry/types.js";

// ---------------------------------------------------------------------------
// Model types (populated by the analysis pipeline)
// ---------------------------------------------------------------------------

interface RouteModel {
  path: string;
  file: string;
  type?: string;
  isApiRoute?: boolean;
  isAuthRoute?: boolean;
  isAuthCallbackRoute?: boolean;
  isLoadingPage?: boolean;
  isErrorPage?: boolean;
  reachableFromNav?: boolean;
  /** Other routes this route links to */
  linkedRoutes?: string[];
  requiresAuth?: boolean;
}

interface NavigationItemModel {
  label: string;
  href: string;
  file: string;
  line: number;
  isDeadLink?: boolean;
}

interface NavigationModel {
  items?: NavigationItemModel[];
  /** Set of paths that are directly linked from nav items */
  linkedPaths?: Set<string>;
}

interface IAAnalysisModel {
  routes?: RouteModel[];
  navigation?: NavigationModel;
  apiEndpoints?: unknown[];
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function fingerprint(ruleId: string, ...parts: Array<string | number>): string {
  const hash = crypto.createHash("sha256");
  hash.update(ruleId);
  for (const part of parts) {
    hash.update(`:${part}`);
  }
  return hash.digest("hex");
}

/** Count path segments: '/settings/security/tokens' → 3 */
function pathDepth(routePath: string): number {
  return routePath.split("/").filter(Boolean).length;
}

/**
 * Determine if a route is a system/infrastructure route that should never
 * be flagged as unreachable (API routes, auth callbacks, error pages, etc.)
 */
function isInfrastructureRoute(route: RouteModel): boolean {
  if (route.type === "api" || route.type === "auth" || route.type === "error" || route.type === "loading" || route.type === "layout") return true;
  if (route.isApiRoute) return true;
  if (route.isAuthRoute) return true;
  if (route.isAuthCallbackRoute) return true;
  if (route.isLoadingPage) return true;
  if (route.isErrorPage) return true;
  if (route.file && /not-found|error\.|loading\.|layout\./i.test(route.file)) return true;

  // Heuristic path-based checks
  const p = route.path.toLowerCase();
  if (p.startsWith("/api/")) return true;
  if (p.startsWith("/_")) return true; // Next.js internals
  if (p.includes("/callback") || p.includes("/oauth") || p.includes("/sso")) return true;
  if (p === "/404" || p === "/500" || p === "/error" || p === "/loading" || p === "/not-found") return true;
  if (p.startsWith("/auth/")) return true;

  return false;
}

// ---------------------------------------------------------------------------
// RULE UX-IA-001: Route Unreachable from Navigation
// ---------------------------------------------------------------------------

/**
 * Build a set of all paths reachable via any navigation link, then expand it
 * transitively through `linkedRoutes` from already-reachable routes.
 */
function buildReachablePaths(
  routes: RouteModel[],
  navItems: NavigationItemModel[]
): Set<string> {
  const reachable = new Set<string>();

  // Seed from direct nav links
  for (const item of navItems) {
    reachable.add(item.href);
    // Also handle trailing-slash variants
    reachable.add(item.href.replace(/\/$/, "") || "/");
  }

  // Home is always reachable
  reachable.add("/");

  // Expand via linkedRoutes until stable
  const routeMap = new Map(routes.map((r) => [r.path, r]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const path of [...reachable]) {
      const route = routeMap.get(path);
      if (!route?.linkedRoutes) continue;
      for (const linked of route.linkedRoutes) {
        if (!reachable.has(linked)) {
          reachable.add(linked);
          changed = true;
        }
      }
    }
  }

  return reachable;
}

/**
 * RULE UX-IA-001: Route Unreachable from Navigation
 *
 * Flags application routes that cannot be reached from any navigation item
 * or from any transitively reachable page. Infrastructure routes are excluded.
 *
 * Precision: medium
 */
export function detectUnreachableRoutes(model: IAAnalysisModel): Finding[] {
  const findings: Finding[] = [];

  const routes = model.routes ?? [];
  const navItems = model.navigation?.items ?? [];
  if (routes.length === 0) return findings;

  const reachable = buildReachablePaths(routes, navItems);

  // Collect navigation labels for the evidence message
  const navLabels = navItems
    .slice(0, 5)
    .map((i) => `"${i.label}" → ${i.href}`)
    .join(", ");

  for (const route of routes) {
    if (isInfrastructureRoute(route)) continue;

    const isReachable =
      route.reachableFromNav === true ||
      reachable.has(route.path) ||
      reachable.has(route.path.replace(/\/$/, "") || "/");

    if (isReachable) continue;

    findings.push({
      rule_id: "UX-IA-001",
      fingerprint: fingerprint("UX-IA-001", route.path, route.file),
      severity: "warning",
      precision: "medium" as PrecisionTier,
      maturity: "experimental",
      category: "ux-completeness",
      file: route.file,
      line: 1,
      end_line: 1,
      title: `Route "${route.path}" is unreachable from navigation`,
      explanation: [
        `Route "${route.path}" (${route.file}) cannot be reached from any navigation item or from any transitively linked page.`,
        `Current navigation items: ${navLabels || "(none detected)"}.`,
        `Users will have no way to discover or navigate to this page unless they know the direct URL.`,
      ].join(" "),
      agent_action: `Add a navigation link to "${route.path}", or verify that it is intentionally hidden (auth callback, error page, etc.) and mark it appropriately in the route model.`,
      fixable: false,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// RULE UX-IA-002: Navigation Dead Links
// ---------------------------------------------------------------------------

/**
 * RULE UX-IA-002: Navigation Dead Links
 *
 * Reports navigation items that are known dead links (href="#" with no
 * onClick, broken hrefs to non-existent routes, etc.)
 *
 * Precision: high (structured model flag)
 */
export function detectNavigationDeadLinks(model: IAAnalysisModel): Finding[] {
  const findings: Finding[] = [];

  const navItems = model.navigation?.items ?? [];

  for (const item of navItems) {
    if (!item.isDeadLink) continue;

    findings.push({
      rule_id: "UX-IA-002",
      fingerprint: fingerprint("UX-IA-002", item.file, String(item.line), item.href),
      severity: "warning",
      precision: "high" as PrecisionTier,
      maturity: "stable",
      category: "ux-completeness",
      file: item.file,
      line: item.line,
      end_line: item.line,
      title: `Navigation item "${item.label}" is a dead link`,
      explanation: [
        `Navigation item "${item.label}" at ${item.file}:${item.line} has href="${item.href}" which is a dead link.`,
        `Dead links in navigation damage credibility and confuse users who click them and go nowhere.`,
      ].join(" "),
      agent_action: `Update the href for navigation item "${item.label}" to point to a real route, or remove it if the page does not yet exist.`,
      fixable: false,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// RULE UX-IA-003: Important Action Buried Deep
// ---------------------------------------------------------------------------

/**
 * RULE UX-IA-003: Important Action Buried Deep
 *
 * Routes at path depth >= 3 that have no forward navigation link from
 * the main navigation AND no contextual link from any shallow page.
 *
 * This is an experimental, low-precision rule.
 * Precision: low
 */
export function detectActionBuriedDeep(model: IAAnalysisModel): Finding[] {
  const findings: Finding[] = [];

  const routes = model.routes ?? [];
  const navItems = model.navigation?.items ?? [];

  // Build set of paths directly in nav
  const navPaths = new Set(navItems.map((i) => i.href));

  // Build set of paths reachable from shallow pages (depth < 3)
  const shallowRoutes = routes.filter((r) => pathDepth(r.path) < 3 && !isInfrastructureRoute(r));
  const shallowLinked = new Set<string>();
  for (const shallow of shallowRoutes) {
    for (const linked of shallow.linkedRoutes ?? []) {
      shallowLinked.add(linked);
    }
  }

  for (const route of routes) {
    if (isInfrastructureRoute(route)) continue;
    if (pathDepth(route.path) < 3) continue;

    // Skip if reachable from nav or from a shallow page
    if (navPaths.has(route.path)) continue;
    if (shallowLinked.has(route.path)) continue;

    findings.push({
      rule_id: "UX-IA-003",
      fingerprint: fingerprint("UX-IA-003", route.path, route.file),
      severity: "info",
      precision: "low" as PrecisionTier,
      maturity: "experimental",
      category: "ux-completeness",
      file: route.file,
      line: 1,
      end_line: 1,
      title: `Deep route "${route.path}" has no direct navigation entry`,
      explanation: [
        `Route "${route.path}" is at path depth ${pathDepth(route.path)} (>= 3) but has no direct link from the main navigation`,
        `and no contextual link from any shallow-depth page.`,
        `Deep routes without entry points create discoverability problems for users.`,
        `Note: This is a low-precision heuristic — verify whether the route is intentionally accessed via breadcrumbs or contextual links.`,
      ].join(" "),
      agent_action: `Consider adding a contextual navigation path to "${route.path}" from a shallower page, or add a direct entry in a settings/secondary navigation menu.`,
      fixable: false,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Aggregated export
// ---------------------------------------------------------------------------

export const uxIARules = {
  "UX-IA-001": detectUnreachableRoutes,
  "UX-IA-002": detectNavigationDeadLinks,
  "UX-IA-003": detectActionBuriedDeep,
} as const;

export function runUXIARules(model: IAAnalysisModel): Finding[] {
  return [
    ...detectUnreachableRoutes(model),
    ...detectNavigationDeadLinks(model),
    ...detectActionBuriedDeep(model),
  ];
}

function findingToRuleFinding(f: Finding): RuleFinding {
  return {
    ruleId: f.rule_id,
    title: f.title,
    severity: f.severity === "critical" ? "critical" : f.severity === "warning" ? "medium" : "low",
    precision: f.precision,
    maturity: f.maturity,
    category: "ux-ia",
    evidence: [f.explanation],
    locations: [{ file: f.file, line: f.line, endLine: f.end_line }],
    agentObjective: f.agent_action,
    description: f.explanation,
    recommendation: f.agent_action,
    file: f.file,
    line: f.line,
    endLine: f.end_line,
    fingerprint: f.fingerprint,
    fixable: f.fixable,
  };
}

export const uxIa001: RegisteredRule = {
  id: "UX-IA-001",
  category: "ux-ia",
  title: "Route Unreachable from Navigation",
  severity: "medium",
  precision: "medium",
  maturity: "stable",
  detect(model: any) {
    return detectUnreachableRoutes(model).map(findingToRuleFinding);
  },
};

export const uxIa002: RegisteredRule = {
  id: "UX-IA-002",
  category: "ux-ia",
  title: "Navigation Dead Link",
  severity: "medium",
  precision: "high",
  maturity: "stable",
  detect(model: any) {
    return detectNavigationDeadLinks(model).map(findingToRuleFinding);
  },
};

export const uxIa003: RegisteredRule = {
  id: "UX-IA-003",
  category: "ux-ia",
  title: "Important Action Buried Deep",
  severity: "low",
  precision: "low",
  maturity: "experimental",
  detect(model: any) {
    return detectActionBuriedDeep(model).map(findingToRuleFinding);
  },
};

