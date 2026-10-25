// ─── Design Snapshot: Route Extractor ─────────────────────────────────────────

import type { RouteSnapshot } from "../types.js";

/**
 * Detect framework from package.json contents.
 */
export function detectFramework(content: string): string | undefined {
  try {
    const pkg = JSON.parse(content);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.next) return "nextjs";
    if (deps["@remix-run/react"]) return "remix";
    if (deps.nuxt) return "nuxt";
    if (deps.svelte || deps["@sveltejs/kit"]) return "sveltekit";
    if (deps.astro) return "astro";
    if (deps.vite) return "vite";
    if (deps.react) return "react";
  } catch {
    // Skip malformed package.json
  }
  return undefined;
}

/**
 * Check if path represents legal or 404 route pages.
 */
export function checkLegalAnd404(lowerRel: string): {
  isTos: boolean;
  isPrivacy: boolean;
  is404: boolean;
} {
  return {
    isTos: lowerRel.includes("terms") || lowerRel.includes("tos"),
    isPrivacy: lowerRel.includes("privacy"),
    is404:
      lowerRel.includes("404") ||
      lowerRel.includes("not-found") ||
      lowerRel.endsWith("notfound.tsx"),
  };
}

/**
 * Check if a relative path belongs to a known routing directory.
 */
export function isRoutePath(lowerRel: string): boolean {
  return (
    lowerRel.includes("/app/") ||
    lowerRel.includes("/pages/") ||
    lowerRel.includes("/routes/")
  );
}

/**
 * Extract RouteSnapshot from file path and content.
 */
export function extractRouteSnapshot(
  relPath: string,
  lowerRel: string,
  content: string,
): RouteSnapshot | null {
  if (!isRoutePath(lowerRel)) {
    return null;
  }

  const isLegal = lowerRel.includes("terms") || lowerRel.includes("privacy");
  const isAuth =
    lowerRel.includes("auth") ||
    lowerRel.includes("login") ||
    lowerRel.includes("signup");
  const isApi = lowerRel.includes("/api/");
  const isMarketing =
    lowerRel.endsWith("page.tsx") ||
    lowerRel.endsWith("index.tsx") ||
    lowerRel.endsWith("index.html") ||
    lowerRel.includes("landing");

  return {
    path: relPath,
    file: relPath,
    type: isLegal
      ? "legal"
      : isAuth
        ? "auth"
        : isApi
          ? "api"
          : isMarketing
            ? "marketing"
            : "app",
    hasLoadingState:
      content.includes("loading") ||
      content.includes("Skeleton") ||
      content.includes("Spinner"),
    hasErrorState:
      content.includes("error") ||
      content.includes("catch") ||
      content.includes("ErrorBoundary"),
    hasEmptyState:
      content.includes("empty") ||
      content.includes("no results") ||
      content.includes("No items"),
  };
}
