import path from 'node:path';
import type { NavigationModel, NavItem, RouteModel } from '../types.js';
import type { FilePayload } from './types.js';

export function extractNavigation(payloads: FilePayload[], routes: RouteModel[]): NavigationModel {
  const items: NavItem[] = [];
  let hasDesktopNav = false;
  let hasMobileNav = false;
  let framework: NavigationModel['framework'] = 'unknown';

  for (const f of payloads) {
    const ext = path.extname(f.relPath).toLowerCase();
    if (!['.tsx', '.jsx', '.ts', '.js'].includes(ext)) continue;

    const isNavFile = /nav|navbar|header|sidebar|bottombar|menu/i.test(f.relPath);
    const hasNavElement = /<nav\b/i.test(f.content) || /<Sidebar\b/i.test(f.content) || /<Navbar\b/i.test(f.content);
    if (!isNavFile && !hasNavElement) continue;

    hasDesktopNav = true;

    // Mobile nav detection
    if (/md:hidden|mobile-nav|hamburger|drawer|sheet/i.test(f.content)) {
      hasMobileNav = true;
    }

    // Framework detection
    if (/sidebar/i.test(f.relPath) || /<Sidebar\b/i.test(f.content)) framework = 'sidebar';
    else if (/bottombar|bottom-nav/i.test(f.relPath)) framework = 'bottombar';
    else if (/<nav\b/i.test(f.content)) framework = 'topbar';
    else if (/tabs|TabBar/i.test(f.content)) framework = 'tabs';

    // Extract nav items
    const lines = f.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNum = i + 1;

      // <Link href="...">label</Link> or <a href="...">label</a>
      const linkRe = /<(?:Link|a)\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/(?:Link|a)>/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(line)) !== null) {
        const href = m[1] ?? '';
        const label = (m[2] ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 60);
        if (!label || !href) continue;

        const isExternal = /^https?:\/\//.test(href);
        const isDeadLink = href === '#' || href === '';

        // Match to known routes
        const resolvedRoute = routes.find((r) => r.path === href || r.file.includes(href.replace(/^\//, '')));

        items.push({
          label,
          href,
          resolvedRoute,
          isExternal,
          isDeadLink,
          line: lineNum,
          file: f.relPath,
        });
      }
    }
  }

  return { items, hasDesktopNav, hasMobileNav, framework };
}

export function resolveNavReachability(routes: RouteModel[], navigation: NavigationModel): void {
  const reachablePaths = new Set(navigation.items.map((n) => n.href));
  for (const route of routes) {
    if (reachablePaths.has(route.path)) {
      route.reachableFromNav = true;
    }
  }
}
