import path from 'node:path';
import type { RouteModel } from '../types.js';
import type { FilePayload } from './types.js';

export function extractLinkedRoutes(content: string): string[] {
  const hrefs = new Set<string>();
  // Match href="..." or href={...} patterns
  const hrefRe = /href=["']([/][^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(content)) !== null) {
    const href = m[1];
    if (href) hrefs.add(href);
  }
  return Array.from(hrefs).slice(0, 30);
}

export function extractPrimaryAction(content: string): string | undefined {
  // Find first CTA button text in content — typically the main action
  const ctaRe = /<button[^>]*>([^<]{2,50})<\/button>/i;
  const m = ctaRe.exec(content);
  if (m?.[1]) return m[1].trim();

  // Also check Link/a elements near "get started", "sign up", etc.
  const ctaLinkRe = /<(?:Link|a)[^>]*>([^<]{2,50})<\/(?:Link|a)>/i;
  const m2 = ctaLinkRe.exec(content);
  if (m2?.[1] && /get started|sign up|try|start|begin/i.test(m2[1])) {
    return m2[1].trim();
  }

  return undefined;
}

export function extractReactRouterRoutes(file: string, content: string): RouteModel[] {
  const routes: RouteModel[] = [];
  // <Route path="/dashboard" element={...} />
  const routeRe = /<Route[^>]+path=["']([^"']+)["'][^>]*/g;
  let m: RegExpExecArray | null;
  while ((m = routeRe.exec(content)) !== null) {
    const routePath = m[1];
    if (!routePath) continue;
    const isAuth = /login|signup|register|auth/i.test(routePath);
    routes.push({
      path: routePath,
      file,
      type: isAuth ? 'auth' : 'page',
      isDynamic: /:[a-zA-Z]/.test(routePath),
      hasLoadingState: false,
      hasErrorState: false,
      hasEmptyState: false,
      reachableFromNav: false,
      linkedRoutes: [],
    });
  }
  // createBrowserRouter path: "..."
  const pathRe = /path:\s*["']([/][^"']+)["']/g;
  while ((m = pathRe.exec(content)) !== null) {
    const routePath = m[1];
    if (!routePath) continue;
    const isAuth = /login|signup|register|auth/i.test(routePath);
    routes.push({
      path: routePath,
      file,
      type: isAuth ? 'auth' : 'page',
      isDynamic: /:[a-zA-Z]/.test(routePath),
      hasLoadingState: false,
      hasErrorState: false,
      hasEmptyState: false,
      reachableFromNav: false,
      linkedRoutes: [],
    });
  }
  return routes;
}

export function extractRoutes(payloads: FilePayload[], framework?: string): RouteModel[] {
  const routes: RouteModel[] = [];

  for (const f of payloads) {
    const rel = f.relPath;
    const ext = path.extname(rel).toLowerCase();
    if (!['.tsx', '.ts', '.jsx', '.js'].includes(ext)) continue;

    // Next.js App Router: app/**/page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx
    const appRouteMatch = rel.match(/(?:^|[/\\])(?:src[/\\])?app[/\\](.+)\.(tsx|jsx|ts|js)$/i);
    if (appRouteMatch) {
      const innerPath = (appRouteMatch[1] ?? '').replace(/\\/g, '/');
      const fileName = path.basename(rel, path.extname(rel)).toLowerCase();

      // Determine route type from filename
      let routeType: RouteModel['type'] = 'page';
      if (fileName === 'layout') routeType = 'layout';
      else if (fileName === 'loading') routeType = 'loading';
      else if (fileName === 'error' || fileName === 'not-found') routeType = 'error';
      else if (fileName === 'route') routeType = 'api';
      else if (fileName !== 'page') continue; // only capture known Next.js special files

      // Compute URL path from directory structure
      let cleanInner = innerPath
        .replace(/(?:^|\/)(?:page|layout|loading|error|not-found|route)$/, '')
        .replace(/\(.*?\)\//g, '')   // remove route groups like (auth)/
        .replace(/\(.*?\)$/, '')      // trailing route group
        .replace(/\\/g, '/');
      if (cleanInner.startsWith('/')) cleanInner = cleanInner.slice(1);
      const urlPath = cleanInner ? `/${cleanInner}` : '/';

      const isAuth = /login|signup|register|sign-in|sign-up|auth|oauth/i.test(urlPath);
      const hasLoadingState = fileName === 'loading'
        || f.content.includes('loading')
        || f.content.includes('Skeleton')
        || f.content.includes('Spinner')
        || /animate-pulse/.test(f.content);
      const hasErrorState = fileName === 'error'
        || f.content.includes('ErrorBoundary')
        || f.content.includes('error.tsx');
      const hasEmptyState = f.content.includes('empty')
        || f.content.includes('no results')
        || f.content.includes('No items')
        || /\.length\s*===?\s*0/.test(f.content)
        || /!\w+\.length\b/.test(f.content)
        || /no\s+\w+\s+(?:found|connected|available|configured|results|records|items)/i.test(f.content);

      routes.push({
        path: urlPath,
        file: rel,
        type: isAuth ? 'auth' : routeType === 'api' ? 'api' : routeType,
        isDynamic: /\[.*?\]/.test(rel),
        hasLoadingState,
        hasErrorState,
        hasEmptyState,
        reachableFromNav: false,
        linkedRoutes: extractLinkedRoutes(f.content),
        primaryAction: extractPrimaryAction(f.content),
      });
      continue;
    }

    // Next.js Pages Router: pages/**/*.tsx (not pages/api/*)
    const pagesRouteMatch = rel.match(/(?:^|[/\\])(?:src[/\\])?pages[/\\](.+)\.(tsx|jsx|ts|js)$/i);
    if (pagesRouteMatch) {
      const innerPath = (pagesRouteMatch[1] ?? '').replace(/\\/g, '/');
      if (innerPath.startsWith('api/')) continue; // handled by API extractor
      if (innerPath.startsWith('_')) continue;    // _app, _document

      const urlPath = '/' + innerPath.replace(/\/index$/, '').replace(/^index$/, '');
      const isAuth = /login|signup|register|sign-in|sign-up|auth/i.test(urlPath);

      routes.push({
        path: urlPath || '/',
        file: rel,
        type: isAuth ? 'auth' : 'page',
        isDynamic: /\[.*?\]/.test(rel),
        hasLoadingState: f.content.includes('loading') || f.content.includes('Skeleton'),
        hasErrorState: f.content.includes('ErrorBoundary') || f.content.includes('catch'),
        hasEmptyState: f.content.includes('empty') || f.content.includes('no results'),
        reachableFromNav: false,
        linkedRoutes: extractLinkedRoutes(f.content),
        primaryAction: extractPrimaryAction(f.content),
      });
      continue;
    }

    // React Router: detect <Route path=...> or createBrowserRouter patterns
    if (framework === 'react' || (!framework && (rel.includes('router') || rel.includes('routes')))) {
      const reactRouterRoutes = extractReactRouterRoutes(rel, f.content);
      routes.push(...reactRouterRoutes);
    }
  }

  return routes;
}
