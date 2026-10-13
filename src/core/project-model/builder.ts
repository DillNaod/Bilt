// ─── ProjectModel Builder ──────────────────────────────────────────────────────
// Orchestrates all extractors and assembles a normalized ProjectModel.
// Accuracy > completeness — each extractor captures only what it can verify
// structurally from source text.
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import fs from 'node:fs/promises';
import fg from 'fast-glob';
import { normalizeComponentTree } from './normalizer.js';
import type {
  ProjectModel,
  RouteModel,
  ComponentModel,
  DesignSystemModel,
  NavigationModel,
  NavItem,
  ApiEndpointModel,
  DbOperation,
  ContentModel,
  AuthModel,
  CrossPageModel,
  UserFlowModel,
  FlowState,
  InteractiveElementModel,
  FormFieldModel,
  DecorativeSignal,
  HeadingModel,
  Location,
} from './types.js';
import type { DesignSnapshot } from '../design/types.js';
import type { DesignBrief } from '../design/brief/types.js';

// ─── File Payload ─────────────────────────────────────────────────────────────

interface FilePayload {
  absPath: string;
  relPath: string;
  content: string;
}

// ─── Public Builder ───────────────────────────────────────────────────────────

export async function buildProjectModel(
  rootDir: string,
  options?: {
    files?: Array<{ path: string; content: string }>;
    includeApiSecurity?: boolean;
    legacySnapshot?: DesignSnapshot;
    designBrief?: DesignBrief;
  },
): Promise<ProjectModel> {
  const start = Date.now();
  const normalizedRoot = path.resolve(rootDir);

  // ── 1. Load files ──────────────────────────────────────────────────────────
  const payloads = await loadFiles(normalizedRoot, options?.files);

  // ── 2. Detect framework ────────────────────────────────────────────────────
  const framework = detectFramework(payloads);

  // ── 3. Extract routes ──────────────────────────────────────────────────────
  const routes = extractRoutes(payloads, framework);

  // ── 4. Extract components ─────────────────────────────────────────────────
  const components = extractComponents(payloads);

  // ── 5. Extract design system ───────────────────────────────────────────────
  const designSystem = extractDesignSystem(payloads);

  // ── 6. Extract navigation ──────────────────────────────────────────────────
  const navigation = extractNavigation(payloads, routes);

  // ── 7. Resolve nav reachability ────────────────────────────────────────────
  resolveNavReachability(routes, navigation);

  // ── 8. Extract API endpoints ───────────────────────────────────────────────
  const apiEndpoints = extractApiEndpoints(payloads);

  // ── 9. Detect auth ────────────────────────────────────────────────────────
  const auth = extractAuth(payloads, routes);

  // ── 10. Extract content signals ────────────────────────────────────────────
  const content = extractContent(payloads, components);

  // ── 11. Cross-page analysis ────────────────────────────────────────────────
  const crossPage = buildCrossPage(components, routes);

  // ── 12. Detect user flows ──────────────────────────────────────────────────
  const userFlows = detectUserFlows(routes, components, apiEndpoints);

  return {
    framework,
    rootDir: normalizedRoot,
    routes,
    components,
    navigation,
    userFlows,
    apiEndpoints,
    auth,
    designSystem,
    content,
    crossPage,
    requirements: [],                       // populated by higher-level layer
    designBrief: options?.designBrief,
    legacySnapshot: options?.legacySnapshot,
    totalFilesScanned: payloads.length,
    buildTimeMs: Date.now() - start,
  };
}

// ─── File Loading ─────────────────────────────────────────────────────────────

async function loadFiles(
  rootDir: string,
  override?: Array<{ path: string; content: string }>,
): Promise<FilePayload[]> {
  if (override && override.length > 0) {
    return override.map((f) => {
      const absPath = path.isAbsolute(f.path) ? f.path : path.join(rootDir, f.path);
      return {
        absPath,
        relPath: path.relative(rootDir, absPath).replace(/\\/g, '/'),
        content: f.content,
      };
    });
  }

  const matched = await fg(
    ['**/*.{tsx,ts,jsx,js,css,scss,json}'],
    {
      cwd: rootDir,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/.git/**',
        '**/coverage/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/test/**',
        '**/tests/**',
        '**/fixtures/**',
        '**/__mocks__/**',
      ],
      absolute: true,
    },
  );

  const payloads: FilePayload[] = [];
  for (const absPath of matched) {
    try {
      const stat = await fs.stat(absPath);
      if (stat.size > 512_000) continue;  // skip files >512KB
      const content = await fs.readFile(absPath, 'utf-8');
      const relPath = path.relative(rootDir, absPath).replace(/\\/g, '/');
      payloads.push({ absPath, relPath, content });
    } catch {
      // Unreadable file — skip
    }
  }

  return payloads;
}

// ─── Framework Detection ──────────────────────────────────────────────────────

function detectFramework(payloads: FilePayload[]): string | undefined {
  for (const f of payloads) {
    if (!f.relPath.endsWith('package.json') || f.relPath.includes('/')) {
      // Only root package.json
      if (f.relPath !== 'package.json') continue;
    }
    try {
      const pkg = JSON.parse(f.content) as Record<string, unknown>;
      const deps = {
        ...((pkg['dependencies'] ?? {}) as Record<string, string>),
        ...((pkg['devDependencies'] ?? {}) as Record<string, string>),
      };
      if (deps['next']) return 'nextjs';
      if (deps['@remix-run/react']) return 'remix';
      if (deps['nuxt']) return 'nuxt';
      if (deps['@sveltejs/kit']) return 'sveltekit';
      if (deps['astro']) return 'astro';
      if (deps['react']) return 'react';
      if (deps['vue']) return 'vue';
    } catch {
      // Malformed JSON
    }
  }
  return undefined;
}

// ─── Route Extraction ─────────────────────────────────────────────────────────

function extractRoutes(payloads: FilePayload[], framework?: string): RouteModel[] {
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

function extractLinkedRoutes(content: string): string[] {
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

function extractPrimaryAction(content: string): string | undefined {
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

function extractReactRouterRoutes(file: string, content: string): RouteModel[] {
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

// ─── Component Extraction ─────────────────────────────────────────────────────

/** Exported JSX/TSX component detectors — one extractor per file */
function extractComponents(payloads: FilePayload[]): ComponentModel[] {
  const components: ComponentModel[] = [];

  for (const f of payloads) {
    const ext = path.extname(f.relPath).toLowerCase();
    if (!['.tsx', '.jsx'].includes(ext)) continue;

    const lines = f.content.split('\n');
    const comp = buildComponentModel(f.relPath, lines, f.content);
    if (comp) components.push(comp);
  }

  return components;
}

function buildComponentModel(
  relPath: string,
  lines: string[],
  content: string,
): ComponentModel | null {
  const name = path.basename(relPath, path.extname(relPath));
  const lowerContent = content.toLowerCase();

  // Determine component role
  const isNavigation = /nav|navbar|header|sidebar/i.test(name) || /<nav\b/i.test(content);
  const isHero = /hero/i.test(name) || /<section[^>]*hero/i.test(content);
  const isCard = /card/i.test(name) || (content.includes('rounded-') && (content.includes('border') || content.includes('shadow')));
  const isForm = /form/i.test(name) || /<form\b/i.test(content);
  const isModal = /modal|dialog|drawer/i.test(name) || /<(?:Dialog|Modal|Drawer)\b/i.test(content);
  const isSection = !isNavigation && !isHero && !isCard && !isForm && !isModal
    && (/<section\b/i.test(content) || /section/i.test(name));
  const isDataDisplay = /table|list|grid|data/i.test(name)
    || /<(?:table|Table|DataGrid|DataTable)\b/i.test(content);

  // State detection
  const hasLoadingState = lowerContent.includes('loading') || lowerContent.includes('skeleton') || lowerContent.includes('spinner') || /animate-pulse/.test(content);
  const hasErrorState = lowerContent.includes('error') || lowerContent.includes('catch') || /<ErrorBoundary\b/i.test(content);
  const hasEmptyState = lowerContent.includes('empty')
    || /no results|no items|no data/i.test(content)
    || /\.length\s*===?\s*0/.test(content)
    || /!\w+\.length\b/.test(content)
    || /no\s+\w+\s+(?:found|connected|available|configured|results|records|items)/i.test(content);
  const hasSuccessState = lowerContent.includes('success') || lowerContent.includes('submitted') || lowerContent.includes('completed');
  const hasDisabledState = content.includes('disabled') || /aria-disabled/i.test(content);

  // Extract headings
  const headings = extractHeadings(lines);

  // Extract interactive elements
  const interactiveElements = extractInteractiveElements(lines, content);

  // Extract form fields
  const formFields = extractFormFields(lines);

  // Extract CTA texts
  const ctaTexts = extractCtaTexts(content);

  // Extract icon names
  const iconNames: string[] = [];
  const iconRe = /<([A-Z][a-zA-Z0-9]*Icon|Sparkles|Wand2|Brain|Zap|Check|ArrowRight|Star|Globe|Shield|Activity|Terminal|Copy|X|Menu|Trash)\b/g;
  let iconMatch: RegExpExecArray | null;
  while ((iconMatch = iconRe.exec(content)) !== null) {
    if (iconMatch[1]) iconNames.push(iconMatch[1]);
  }

  // Decorative signals
  const decorativeSignals = detectDecorativeSignals(lines);

  // Structural signature
  const structuralSignature = normalizeComponentTree(content);

  // Find first meaningful line number (skip imports)
  let line = 1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? '';
    if (!l.startsWith('import') && !l.startsWith('//') && l.trim().length > 0) {
      line = i + 1;
      break;
    }
  }

  return {
    name,
    file: relPath,
    line,
    structuralSignature,
    isSection,
    isCard,
    isNavigation,
    isForm,
    isModal,
    isHero,
    isDataDisplay,
    hasLoadingState,
    hasErrorState,
    hasEmptyState,
    hasSuccessState,
    hasDisabledState,
    interactiveElements,
    formFields,
    ctaTexts,
    headings,
    iconNames: [...new Set(iconNames)],
    rawText: content.slice(0, 10000),
    decorativeSignals,
  };
}

function extractHeadings(lines: string[]): HeadingModel[] {
  const headings: HeadingModel[] = [];
  // Match: <h1 className="...">text</h1>  or  <h2>text</h2>
  const hRe = /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    let m: RegExpExecArray | null;
    hRe.lastIndex = 0;
    while ((m = hRe.exec(line)) !== null) {
      const level = parseInt(m[1] ?? '1', 10) as 1 | 2 | 3 | 4 | 5 | 6;
      const attrs = m[2] ?? '';
      const inner = (m[3] ?? '').replace(/<[^>]+>/g, '').trim(); // strip child tags
      if (!inner) continue;

      // Extract tailwind classes from attrs
      const classMatch = attrs.match(/class(?:Name)?=["']([^"']+)["']/);
      const tailwindClasses = classMatch
        ? classMatch[1]!.split(/\s+/).filter((c) => c.length > 0)
        : [];

      headings.push({ level, text: inner.slice(0, 200), tailwindClasses });
    }
  }

  return headings.slice(0, 50);
}

function extractInteractiveElements(lines: string[], fullContent: string): InteractiveElementModel[] {
  const elements: InteractiveElementModel[] = [];

  function getLine(idx: number): number {
    return fullContent.slice(0, idx).split('\n').length;
  }

  // Buttons
  const btnRe = /<button([^>]*)>([\s\S]*?)<\/button>/gi;
  let m: RegExpExecArray | null;
  while ((m = btnRe.exec(fullContent)) !== null) {
    const lineNum = getLine(m.index);
    const attrs = m[1] ?? '';
    const text = (m[2] ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 100);
    const hasAriaLabel = /aria-label/i.test(attrs);
    const hasOnClick = /onClick/i.test(attrs);
    const onClickIsEmpty = /onClick=\{[()=>\s]*\{\s*\}\}/i.test(attrs);
    const isDestructive = /delete|remove|destroy|purge|unlink|revoke/i.test(text);
    const surroundStart = Math.max(0, lineNum - 6);
    const surroundEnd = Math.min(lines.length, lineNum + 6);
    const surroundText = lines.slice(surroundStart, surroundEnd).join('\n');
    const hasConfirmation = /confirm|dialog|alert|prompt|modal/i.test(surroundText);

    elements.push({
      type: 'button',
      text: text || undefined,
      hasAriaLabel,
      isDestructive,
      hasConfirmation,
      hasOnClick,
      onClickIsEmpty,
      line: lineNum,
    });
  }

  // Links
  const linkRe = /<(?:Link|a)([^>]*)>([\s\S]*?)<\/(?:Link|a)>/gi;
  while ((m = linkRe.exec(fullContent)) !== null) {
    const lineNum = getLine(m.index);
    const attrs = m[1] ?? '';
    const text = (m[2] ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 100);
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/);
    const href = hrefMatch?.[1];
    const hasAriaLabel = /aria-label/i.test(attrs);
    const isDestructive = /delete|remove|destroy/i.test(text);
    const hasOnClick = /onClick/i.test(attrs);
    const onClickIsEmpty = href === '#' || /onClick=\{[()=>\s]*\{\s*\}\}/i.test(attrs);

    elements.push({
      type: 'link',
      text: text || undefined,
      href,
      hasAriaLabel,
      isDestructive,
      hasConfirmation: false,
      hasOnClick,
      onClickIsEmpty,
      line: lineNum,
    });
  }

  // Inputs
  const inputRe = /<input([^>]*)\/?>/gi;
  while ((m = inputRe.exec(fullContent)) !== null) {
    const lineNum = getLine(m.index);
    const attrs = m[1] ?? '';
    const hasAriaLabel = /aria-label/i.test(attrs);

    elements.push({
      type: 'input',
      hasAriaLabel,
      isDestructive: false,
      hasConfirmation: false,
      hasOnClick: false,
      onClickIsEmpty: false,
      line: lineNum,
    });
  }

  // Clickable divs
  const divClickRe = /<(?:div|span)([^>]*onClick=[^>]*)>/gi;
  while ((m = divClickRe.exec(fullContent)) !== null) {
    const lineNum = getLine(m.index);
    const attrs = m[1] ?? '';
    const hasAriaLabel = /aria-label/i.test(attrs);

    elements.push({
      type: 'div-clickable',
      hasAriaLabel,
      isDestructive: false,
      hasConfirmation: false,
      hasOnClick: true,
      onClickIsEmpty: false,
      line: lineNum,
    });
  }

  return elements.slice(0, 100);
}

function extractFormFields(lines: string[]): FormFieldModel[] {
  const fields: FormFieldModel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNum = i + 1;

    const inputRe = /<(?:input|select|textarea)([^>]*)\/?>/gi;
    let m: RegExpExecArray | null;
    while ((m = inputRe.exec(line)) !== null) {
      const attrs = m[1] ?? '';
      const tag = (line.match(/<(input|select|textarea)/i)?.[1] ?? 'input').toLowerCase();
      const typeMatch = attrs.match(/type=["']([^"']*)["']/);
      const nameMatch = attrs.match(/name=["']([^"']*)["']/);
      const hasAriaLabel = /aria-label/i.test(attrs);
      const hasRequired = /required/i.test(attrs);

      // Check surrounding lines for associated <label>
      const surroundLines = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 3)).join('\n');
      const hasLabel = /<label\b/i.test(surroundLines);
      // Check for error message nearby
      const hasErrorMessage = /error|invalid|required/i.test(surroundLines);

      fields.push({
        type: typeMatch?.[1] ?? tag,
        name: nameMatch?.[1],
        hasLabel,
        hasAriaLabel,
        hasErrorMessage,
        hasRequired,
        line: lineNum,
      });
    }
  }

  return fields.slice(0, 50);
}

function extractCtaTexts(content: string): string[] {
  const texts = new Set<string>();
  // Button text
  const btnRe = /<button[^>]*>([\s\S]*?)<\/button>/gi;
  let m: RegExpExecArray | null;
  while ((m = btnRe.exec(content)) !== null) {
    const text = (m[1] ?? '').replace(/<[^>]+>/g, '').trim();
    if (text.length >= 2 && text.length <= 80) texts.add(text);
  }
  // Link text
  const linkRe = /<(?:Link|a)[^>]*>([\s\S]*?)<\/(?:Link|a)>/gi;
  while ((m = linkRe.exec(content)) !== null) {
    const text = (m[1] ?? '').replace(/<[^>]+>/g, '').trim();
    if (text.length >= 2 && text.length <= 80 && /^[A-Za-z]/.test(text)) {
      texts.add(text);
    }
  }
  return Array.from(texts).slice(0, 30);
}

function detectDecorativeSignals(lines: string[]): DecorativeSignal[] {
  const signals: DecorativeSignal[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNum = i + 1;

    if (/bg-gradient-to|linear-gradient/i.test(line)) {
      signals.push({ type: 'gradient', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/bg-gradient-radial|radial-gradient|radial-orb|blur-(?:2xl|3xl)/i.test(line)) {
      signals.push({ type: 'radial-orb', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/backdrop-blur.*bg-(?:white|black)\/[0-9]/i.test(line)) {
      signals.push({ type: 'glassmorphism', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/col-span-2.*row-span-2|bento/i.test(line)) {
      signals.push({ type: 'bento-grid', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/grid-cols-3/i.test(line)) {
      signals.push({ type: 'three-column', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/uppercase.*tracking.*text-xs|eyebrow/i.test(line)) {
      signals.push({ type: 'hero-eyebrow', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/animate-marquee|<Marquee/i.test(line)) {
      signals.push({ type: 'marquee', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/\d{1,3}(?:,\d{3})+\s+(?:users|customers|businesses|projects)/i.test(line)) {
      signals.push({ type: 'fake-metric', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/testimonial|"said.*CEO|said.*Founder/i.test(line)) {
      signals.push({ type: 'testimonial', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/logo.*strip|logo.*grid|partners|trusted by/i.test(line)) {
      signals.push({ type: 'logo-strip', evidence: line.trim().slice(0, 80), line: lineNum });
    }
  }

  return signals;
}

// ─── Design System Extraction ─────────────────────────────────────────────────

function extractDesignSystem(payloads: FilePayload[]): DesignSystemModel {
  const radii = new Map<string, { count: number; locations: Location[] }>();
  const spacing = new Map<string, { count: number; locations: Location[] }>();
  const colors = new Map<string, { count: number; locations: Location[] }>();
  const fontSizes = new Map<string, { count: number; locations: Location[] }>();
  const fontWeights = new Map<string, { count: number; locations: Location[] }>();
  const shadows = new Map<string, { count: number; locations: Location[] }>();
  const detectedFonts = new Set<string>();
  let hasDesignTokenFile = false;

  function increment(
    map: Map<string, { count: number; locations: Location[] }>,
    key: string,
    loc: Location,
  ): void {
    const entry = map.get(key);
    if (entry) {
      entry.count++;
      if (entry.locations.length < 10) entry.locations.push(loc);
    } else {
      map.set(key, { count: 1, locations: [loc] });
    }
  }

  for (const f of payloads) {
    const rel = f.relPath;
    const ext = path.extname(rel).toLowerCase();

    // Detect design token files
    if (
      rel.includes('tailwind.config') ||
      rel.includes('tokens.css') ||
      rel.includes('design-tokens') ||
      rel.includes('theme.ts') ||
      rel.includes('theme.js')
    ) {
      hasDesignTokenFile = true;
    }

    if (!['.tsx', '.ts', '.jsx', '.js', '.css', '.scss'].includes(ext)) continue;

    const lines = f.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNum = i + 1;
      const loc: Location = { file: rel, line: lineNum };

      // Tailwind radius classes
      const radiusMatches = line.match(/\brounded(?:-(?:sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?\b/g);
      if (radiusMatches) {
        for (const r of radiusMatches) increment(radii, r, loc);
      }

      // Tailwind spacing
      const spacingMatches = line.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-(?:\d+|\[[^\]]+\])\b/g);
      if (spacingMatches) {
        for (const s of spacingMatches) increment(spacing, s, loc);
      }

      // Tailwind colors: bg-X-Y, text-X-Y, border-X-Y
      const colorMatches = line.match(/\b(?:bg|text|border|ring|fill|stroke)-(?:[a-z]+-(?:\d{2,3}|50|950)|(?:white|black|transparent|current))\b/g);
      if (colorMatches) {
        for (const c of colorMatches) increment(colors, c, loc);
      }
      // Hex colors
      const hexMatches = line.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hexMatches) {
        for (const h of hexMatches) increment(colors, h.toLowerCase(), loc);
      }

      // Font sizes
      const fontSizeMatches = line.match(/\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[[^\]]+\])\b/g);
      if (fontSizeMatches) {
        for (const fs of fontSizeMatches) increment(fontSizes, fs, loc);
      }

      // Font weights
      const fontWeightMatches = line.match(/\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g);
      if (fontWeightMatches) {
        for (const fw of fontWeightMatches) increment(fontWeights, fw, loc);
      }

      // Shadows
      const shadowMatches = line.match(/\bshadow-(?:sm|md|lg|xl|2xl|inner|none|\[[^\]]+\])\b/g);
      if (shadowMatches) {
        for (const s of shadowMatches) increment(shadows, s, loc);
      }

      // Font detection
      if (/\bInter\b/.test(line)) detectedFonts.add('Inter');
      if (/\bGeist\b/.test(line)) detectedFonts.add('Geist');
      if (/Space Grotesk/.test(line)) detectedFonts.add('Space Grotesk');
      if (/\bRoboto\b/.test(line)) detectedFonts.add('Roboto');
      if (/\bPoppins\b/.test(line)) detectedFonts.add('Poppins');
      if (/\bMontserrat\b/.test(line)) detectedFonts.add('Montserrat');
      if (/\bPlusJakarta/i.test(line)) detectedFonts.add('Plus Jakarta Sans');
    }
  }

  return {
    radii,
    spacing,
    colors,
    fontSizes,
    fontWeights,
    shadows,
    colorCount: colors.size,
    uniqueRadiusCount: radii.size,
    uniqueSpacingCount: spacing.size,
    hasDesignTokenFile,
    detectedFonts: Array.from(detectedFonts),
  };
}

// ─── Navigation Extraction ────────────────────────────────────────────────────

function extractNavigation(payloads: FilePayload[], routes: RouteModel[]): NavigationModel {
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

function resolveNavReachability(routes: RouteModel[], navigation: NavigationModel): void {
  const reachablePaths = new Set(navigation.items.map((n) => n.href));
  for (const route of routes) {
    if (reachablePaths.has(route.path)) {
      route.reachableFromNav = true;
    }
  }
}

// ─── API Endpoint Extraction ──────────────────────────────────────────────────

function extractApiEndpoints(payloads: FilePayload[]): ApiEndpointModel[] {
  const endpoints: ApiEndpointModel[] = [];

  for (const f of payloads) {
    const rel = f.relPath;
    const ext = path.extname(rel).toLowerCase();
    if (!['.ts', '.js', '.tsx', '.jsx'].includes(ext)) continue;

    // Next.js App Router: app/**/route.ts
    if (/(?:^|[/\\])(?:src[/\\])?app[/\\].*route\.(ts|js|tsx|jsx)$/i.test(rel)) {
      extractNextAppRouteEndpoints(rel, f.content, endpoints);
    }
    // Next.js Pages Router: pages/api/**
    else if (/(?:^|[/\\])(?:src[/\\])?pages[/\\]api[/\\]/i.test(rel)) {
      extractNextPagesApiEndpoints(rel, f.content, endpoints);
    }
    // Express/Fastify patterns
    else if (/(?:app|router|fastify)\.(get|post|put|patch|delete|all)\s*\(/i.test(f.content)) {
      extractExpressEndpoints(rel, f.content, endpoints);
    }
  }

  return endpoints;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

function extractNextAppRouteEndpoints(
  file: string,
  content: string,
  out: ApiEndpointModel[],
): void {
  let apiPath = file
    .replace(/^.*?(?:src[/\\])?app[/\\]/i, '/')
    .replace(/[/\\]route\.(ts|js|tsx|jsx)$/i, '')
    .replace(/\\/g, '/');
  if (!apiPath.startsWith('/')) apiPath = '/' + apiPath;
  apiPath = apiPath.replace(/\[([^\]]+)\]/g, ':$1');

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    for (const method of HTTP_METHODS) {
      const re = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`, 'i');
      const re2 = new RegExp(`export\\s+const\\s+${method}\\b`, 'i');
      if (re.test(line) || re2.test(line)) {
        const handlerContent = lines.slice(i, Math.min(lines.length, i + 50)).join('\n');
        out.push(analyzeEndpoint(method, apiPath, file, i + 1, 'nextjs', handlerContent));
      }
    }
  }
}

function extractNextPagesApiEndpoints(
  file: string,
  content: string,
  out: ApiEndpointModel[],
): void {
  let apiPath = file
    .replace(/^.*?(?:src[/\\])?pages[/\\]/i, '/')
    .replace(/\.(ts|js|tsx|jsx)$/i, '')
    .replace(/\/index$/, '')
    .replace(/\\/g, '/');
  if (!apiPath.startsWith('/')) apiPath = '/' + apiPath;
  apiPath = apiPath.replace(/\[([^\]]+)\]/g, ':$1');

  const methodMatches = content.matchAll(/req\.method\s*===\s*['"]([A-Z]+)['"]/g);
  const methods = new Set<string>();
  for (const m of methodMatches) {
    if (m[1]) methods.add(m[1]);
  }
  if (methods.size === 0) methods.add('ALL');

  for (const method of methods) {
    out.push(analyzeEndpoint(method, apiPath, file, 1, 'nextjs', content));
  }
}

function extractExpressEndpoints(
  file: string,
  content: string,
  out: ApiEndpointModel[],
): void {
  const lines = content.split('\n');
  const routeRe = /(?:app|router|fastify|server)\.(get|post|put|patch|delete|all|use)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    routeRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = routeRe.exec(line)) !== null) {
      const method = (m[1] ?? 'all').toUpperCase();
      const routePath = m[2] ?? '/';
      let endIdx = Math.min(lines.length, i + 40);
      for (let j = i + 1; j < endIdx; j++) {
        if (/^(?:router|app|fastify|server)\.(?:get|post|put|patch|delete|all|use)\b/i.test(lines[j]?.trim() ?? '')) {
          endIdx = j;
          break;
        }
      }
      const handlerContent = lines.slice(i, endIdx).join('\n');
      const framework = content.includes('fastify') ? 'fastify' : 'express';
      out.push(analyzeEndpoint(method, routePath, file, i + 1, framework, handlerContent));
    }
  }
}

function analyzeEndpoint(
  method: string,
  apiPath: string,
  file: string,
  line: number,
  framework: string,
  handlerContent: string,
): ApiEndpointModel {
  const c = handlerContent;

  // Auth check detection
  const hasAuthCheck =
    /getServerSession|auth\(\)|getSession|verifyToken|requireAuth|currentUser|protect|middleware/i.test(c) ||
    /authorization|bearer|jwt\.verify|clerkClient|validateSession/i.test(c);
  let authCheckType: ApiEndpointModel['authCheckType'];
  if (hasAuthCheck) {
    if (/session|getServerSession|getSession/i.test(c)) authCheckType = 'session';
    else if (/jwt|verifyToken|bearer/i.test(c)) authCheckType = 'jwt';
    else if (/middleware|protect/i.test(c)) authCheckType = 'middleware';
    else authCheckType = 'unknown';
  }

  // Ownership check: does the handler compare userId with resource.userId?
  const hasOwnershipCheck = /(?:userId|user_id|ownerId|owner_id).*(?:===|!==|==)|where.*userId/i.test(c);

  // Input validation
  const hasInputValidation = /\.parse\(|\.safeParse\(|validate\(|check\(|schema\.validate|Joi\.object|yup\.object/i.test(c);
  let validationLibrary: string | undefined;
  if (hasInputValidation) {
    if (/zod|\.parse\(|z\./i.test(c)) validationLibrary = 'zod';
    else if (/joi|Joi\./i.test(c)) validationLibrary = 'joi';
    else if (/yup|yup\./i.test(c)) validationLibrary = 'yup';
    else if (/express-validator|check\(/i.test(c)) validationLibrary = 'express-validator';
  }

  // Body usage
  const acceptsReqBody = /req\.body|request\.json\(\)|formData\(\)/i.test(c);
  const hasExplicitFieldSelection = /const\s*\{[^}]+\}\s*=\s*(?:req\.body|await\s+req|body)/i.test(c);
  // Mass assignment: passing req.body directly to db call
  const passesBodyToDb = acceptsReqBody && !hasExplicitFieldSelection &&
    (/(?:create|update|upsert|insert|save|findOneAndUpdate)\s*\(\s*(?:req\.body|body)/i.test(c) ||
     /data\s*:\s*(?:req\.body|body)/i.test(c) ||
     /Object\.assign\s*\([^,]+,\s*(?:req\.body|body)/i.test(c));

  // DB operations
  const dbOperations: DbOperation[] = detectDbOperations(c);

  // Sensitive fields in response
  const sensitiveFieldsInResponse = detectSensitiveFields(c);

  return {
    method,
    path: apiPath,
    file,
    line,
    framework,
    handlerContent,
    hasAuthCheck,
    authCheckType,
    hasOwnershipCheck,
    hasInputValidation,
    validationLibrary,
    acceptsReqBody,
    passesBodyToDb,
    hasExplicitFieldSelection,
    dbOperations,
    sensitiveFieldsInResponse,
  };
}

function detectDbOperations(content: string): DbOperation[] {
  const ops: DbOperation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNum = i + 1;

    // Read operations
    if (/\.find(?:One|Many|First|Unique)?\s*\(|\.get\s*\(|SELECT\b/i.test(line)) {
      const usesParamDirectly = /params\.|req\.params|request\.params/i.test(line) &&
        !/userId|ownerId/i.test(line);
      const modelMatch = line.match(/(\w+)\.(find|get|select)/i);
      ops.push({ type: 'read', model: modelMatch?.[1], usesParamDirectly, line: lineNum });
    }
    // Write operations
    if (/\.create\s*\(|\.update(?:One|Many)?\s*\(|\.upsert\s*\(|INSERT\b|UPDATE\b/i.test(line)) {
      const usesParamDirectly = /params\./i.test(line) && !/userId/i.test(line);
      const modelMatch = line.match(/(\w+)\.(create|update|upsert)/i);
      ops.push({ type: 'write', model: modelMatch?.[1], usesParamDirectly, line: lineNum });
    }
    // Delete operations
    if (/\.delete(?:One|Many)?\s*\(|\.remove\s*\(|DELETE\b/i.test(line)) {
      const usesParamDirectly = /params\./i.test(line) && !/userId/i.test(line);
      const modelMatch = line.match(/(\w+)\.(delete|remove)/i);
      ops.push({ type: 'delete', model: modelMatch?.[1], usesParamDirectly, line: lineNum });
    }
  }

  return ops;
}

function detectSensitiveFields(content: string): string[] {
  const sensitive: string[] = [];
  const fields = ['password', 'passwordHash', 'secret', 'token', 'apiKey', 'privateKey', 'ssn', 'creditCard'];
  for (const field of fields) {
    if (new RegExp(`\\b${field}\\b`, 'i').test(content)) {
      sensitive.push(field);
    }
  }
  return sensitive;
}

// ─── Auth Detection ───────────────────────────────────────────────────────────

function extractAuth(payloads: FilePayload[], routes: RouteModel[]): AuthModel {
  const providers = new Set<string>();
  const authMiddlewareFiles: string[] = [];
  let hasAuthentication = false;

  for (const f of payloads) {
    const content = f.content;

    // Provider detection from imports
    if (/from ['"]@clerk\//i.test(content) || /ClerkProvider/i.test(content)) {
      providers.add('clerk'); hasAuthentication = true;
    }
    if (/from ['"]next-auth/i.test(content) || /NextAuthProvider/i.test(content)) {
      providers.add('nextauth'); hasAuthentication = true;
    }
    if (/from ['"]@supabase\/auth/i.test(content) || /supabase\.auth\./i.test(content)) {
      providers.add('supabase'); hasAuthentication = true;
    }
    if (/from ['"]firebase\/auth/i.test(content) || /getAuth\(\)/i.test(content)) {
      providers.add('firebase'); hasAuthentication = true;
    }
    if (/from ['"]lucia/i.test(content) || /new Lucia\(/i.test(content)) {
      providers.add('lucia'); hasAuthentication = true;
    }
    if (/from ['"]better-auth/i.test(content)) {
      providers.add('better-auth'); hasAuthentication = true;
    }
    if (/passport\.use|PassportStrategy/i.test(content)) {
      providers.add('passport'); hasAuthentication = true;
    }

    // Middleware file detection
    if (
      f.relPath.includes('middleware') &&
      /auth|protect|requireAuth|getServerSession|clerkMiddleware/i.test(content)
    ) {
      authMiddlewareFiles.push(f.relPath);
    }
  }

  const protectedRoutes = routes
    .filter((r) => r.type !== 'auth' && r.type !== 'api')
    .map((r) => r.path)
    .filter((p) => !['/', '/about', '/pricing', '/blog'].includes(p));

  const publicRoutes = routes
    .filter((r) => r.type === 'auth' || ['/', '/about', '/pricing', '/blog'].includes(r.path))
    .map((r) => r.path);

  return {
    hasAuthentication,
    providers: Array.from(providers),
    protectedRoutes: protectedRoutes.slice(0, 50),
    publicRoutes: publicRoutes.slice(0, 20),
    authMiddlewareFiles,
  };
}

// ─── Content Extraction ───────────────────────────────────────────────────────

function extractContent(payloads: FilePayload[], components: ComponentModel[]): ContentModel {
  const genericPhrases: ContentModel['genericPhrases'] = [];
  const hardcodedMetrics: ContentModel['hardcodedMetrics'] = [];
  const ctaTexts = new Map<string, string[]>();
  let loremIpsumCount = 0;
  let fakeTestimonialCount = 0;

  const GENERIC_PATTERNS: RegExp[] = [
    /the future of\b/i,
    /built for the modern\b/i,
    /supercharge your\b/i,
    /transform your workflow\b/i,
    /unlock your potential\b/i,
    /all-in-one platform\b/i,
    /seamlessly integrate\b/i,
    /say goodbye to\b/i,
    /bring your ideas to life\b/i,
    /next-gen\b/i,
    /streamline your\b/i,
  ];

  const FAKE_TESTIMONIAL_RE = /\b(?:CEO at TechCorp|Founder at StartupX|John D\.|Sarah M\.|Alex P\.|Jane Doe|John Doe)\b/i;
  const HARDCODED_METRIC_RE =
    /\d{1,3}(?:,\d{3})*\+?\s*(?:active\s+)?(?:users|customers|businesses|projects|teams|requests|transactions|uptime)/i;
  const PERCENT_METRIC_RE =
    /\d+(?:\.\d+)?%\s*(?:faster|more|better|increase|reduction|uptime|sla)/i;

  for (const f of payloads) {
    const ext = path.extname(f.relPath).toLowerCase();
    if (!['.tsx', '.jsx', '.ts', '.js'].includes(ext)) continue;

    const lines = f.content.split('\n');
    const pageCtas: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNum = i + 1;
      const trimmed = line.trim();

      // Generic phrases
      for (const pattern of GENERIC_PATTERNS) {
        const m = line.match(pattern);
        if (m?.[0]) {
          genericPhrases.push({ phrase: m[0], file: f.relPath, line: lineNum });
        }
      }

      // Fake testimonials
      if (FAKE_TESTIMONIAL_RE.test(line)) fakeTestimonialCount++;

      // Lorem ipsum
      if (/lorem ipsum/i.test(line)) loremIpsumCount++;

      // Hardcoded metrics — only in JSX context (not in comments or type definitions)
      const isComment = trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
      const isJsxFile = ['.tsx', '.jsx'].includes(ext);
      if (isJsxFile && !isComment) {
        if (HARDCODED_METRIC_RE.test(line) && /<[a-zA-Z]/.test(line)) {
          const m = line.match(HARDCODED_METRIC_RE);
          if (m?.[0]) hardcodedMetrics.push({ text: m[0], file: f.relPath, line: lineNum });
        }
        if (PERCENT_METRIC_RE.test(line) && /<[a-zA-Z]/.test(line)) {
          const m = line.match(PERCENT_METRIC_RE);
          if (m?.[0]) hardcodedMetrics.push({ text: m[0], file: f.relPath, line: lineNum });
        }
      }

      // CTA texts from buttons/links
      const btnTextRe = /<button[^>]*>([^<]{2,60})<\/button>/gi;
      let bm: RegExpExecArray | null;
      while ((bm = btnTextRe.exec(line)) !== null) {
        const text = bm[1]?.trim();
        if (text) pageCtas.push(text);
      }
    }

    if (pageCtas.length > 0) {
      ctaTexts.set(f.relPath, pageCtas);
    }
  }

  // Terminology from components
  const terminology = buildTerminologyMap(components);

  return {
    terminology,
    genericPhrases: genericPhrases.slice(0, 100),
    hardcodedMetrics: hardcodedMetrics.slice(0, 50),
    ctaTexts,
    loremIpsumCount,
    fakeTestimonialCount,
  };
}

function buildTerminologyMap(components: ComponentModel[]): Map<string, string[]> {
  const conceptMap = new Map<string, string[]>();

  // Canonical concept -> variant patterns
  const concepts: Array<{ concept: string; variants: RegExp[] }> = [
    { concept: 'create', variants: [/\bcreate\b/i, /\badd\b/i, /\bnew\b/i, /\binsert\b/i] },
    { concept: 'edit', variants: [/\bedit\b/i, /\bupdate\b/i, /\bmodify\b/i, /\bchange\b/i] },
    { concept: 'delete', variants: [/\bdelete\b/i, /\bremove\b/i, /\barchive\b/i, /\bdiscard\b/i] },
    { concept: 'save', variants: [/\bsave\b/i, /\bsubmit\b/i, /\bconfirm\b/i, /\bapply\b/i] },
    { concept: 'cancel', variants: [/\bcancel\b/i, /\bdismiss\b/i, /\bclose\b/i, /\bback\b/i] },
  ];

  for (const comp of components) {
    for (const ctaText of comp.ctaTexts) {
      for (const { concept, variants } of concepts) {
        for (const v of variants) {
          if (v.test(ctaText)) {
            const existing = conceptMap.get(concept) ?? [];
            if (!existing.includes(ctaText)) existing.push(ctaText);
            conceptMap.set(concept, existing);
          }
        }
      }
    }
  }

  return conceptMap;
}

// ─── Cross-Page Analysis ──────────────────────────────────────────────────────

function buildCrossPage(components: ComponentModel[], routes: RouteModel[]): CrossPageModel {
  const pageCtaTexts = new Map<string, string[]>();
  const actionVerbs = new Map<string, string[]>();

  // Gather CTA texts per page file
  for (const comp of components) {
    if (comp.ctaTexts.length > 0) {
      pageCtaTexts.set(comp.file, comp.ctaTexts);
    }

    // Bucket action verbs
    for (const cta of comp.ctaTexts) {
      const buckets: Array<[string, RegExp]> = [
        ['create', /\bcreate|add|new\b/i],
        ['edit', /\bedit|update|modify\b/i],
        ['delete', /\bdelete|remove\b/i],
        ['save', /\bsave|submit\b/i],
        ['cancel', /\bcancel|dismiss\b/i],
        ['view', /\bview|see|show|open\b/i],
      ];
      for (const [bucket, re] of buckets) {
        if (re.test(cta)) {
          const arr = actionVerbs.get(bucket) ?? [];
          if (!arr.includes(cta)) arr.push(cta);
          actionVerbs.set(bucket, arr);
        }
      }
    }
  }

  // Detect terminology inconsistencies: same concept, different words across files
  const terminologyInconsistencies: CrossPageModel['terminologyInconsistencies'] = [];
  for (const [concept, variants] of actionVerbs.entries()) {
    if (variants.length > 1) {
      // Multiple different texts for same concept action = inconsistency
      const variantDetails = variants.map((text) => {
        const comp = components.find((c) => c.ctaTexts.includes(text));
        return { text, file: comp?.file ?? 'unknown', line: comp?.line ?? 0 };
      });
      terminologyInconsistencies.push({ concept, variants: variantDetails });
    }
  }

  return { pageCtaTexts, terminologyInconsistencies, actionVerbs };
}

// ─── User Flow Detection ──────────────────────────────────────────────────────

/**
 * Detect common user flows (signup, login, checkout, CRUD) by looking for
 * entry points in routes + state coverage in components and API endpoints.
 */
function detectUserFlows(
  routes: RouteModel[],
  components: ComponentModel[],
  apiEndpoints: ApiEndpointModel[],
): UserFlowModel[] {
  const flows: UserFlowModel[] = [];

  // Auth flow
  const authRoutes = routes.filter((r) => r.type === 'auth');
  if (authRoutes.length > 0) {
    const isLogin = authRoutes.find((r) => /login|sign-in/i.test(r.path));
    const isSignup = authRoutes.find((r) => /signup|register|sign-up/i.test(r.path));

    if (isLogin || isSignup) {
      flows.push(buildAuthFlow(authRoutes, components));
    }
  }

  // CRUD flows — detect from API endpoints with write operations
  const writeEndpoints = apiEndpoints.filter((e) =>
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.method.toUpperCase()),
  );

  if (writeEndpoints.length > 0) {
    flows.push(buildCrudFlow(writeEndpoints, components));
  }

  return flows;
}

function buildAuthFlow(authRoutes: RouteModel[], components: ComponentModel[]): UserFlowModel {
  const detectedStates: FlowState[] = [];
  const entryPoints: Location[] = authRoutes.map((r) => ({ file: r.file }));

  // Entry: auth route exists
  for (const r of authRoutes) {
    detectedStates.push({ name: 'entry', location: { file: r.file } });
  }

  // Loading: check components in auth files
  const authComps = components.filter((c) =>
    authRoutes.some((r) => r.file.includes(path.dirname(c.file))),
  );
  for (const comp of authComps) {
    if (comp.hasLoadingState) {
      detectedStates.push({ name: 'loading', location: { file: comp.file, line: comp.line } });
    }
    if (comp.hasErrorState) {
      detectedStates.push({ name: 'error', location: { file: comp.file, line: comp.line } });
    }
    if (comp.hasSuccessState) {
      detectedStates.push({ name: 'success', location: { file: comp.file, line: comp.line } });
    }
  }

  // Missing states
  const foundStateNames = new Set(detectedStates.map((s) => s.name));
  const expectedStates = ['entry', 'loading', 'error', 'validation-error'];
  const missingStates = expectedStates.filter((s) => !foundStateNames.has(s as FlowState['name']));

  return {
    name: 'auth',
    detectedStates,
    missingStates,
    entryPoints,
  };
}

function buildCrudFlow(writeEndpoints: ApiEndpointModel[], components: ComponentModel[]): UserFlowModel {
  const detectedStates: FlowState[] = [];
  const entryPoints: Location[] = writeEndpoints.map((e) => ({ file: e.file, line: e.line }));

  // Entry: write endpoint exists
  for (const e of writeEndpoints.slice(0, 3)) {
    detectedStates.push({ name: 'entry', location: { file: e.file, line: e.line } });
  }

  // Check components that have form elements for state coverage
  const formComps = components.filter((c) => c.isForm || c.formFields.length > 0);
  for (const comp of formComps) {
    if (comp.hasLoadingState) {
      detectedStates.push({ name: 'loading', location: { file: comp.file, line: comp.line } });
    }
    if (comp.hasErrorState) {
      detectedStates.push({ name: 'error', location: { file: comp.file, line: comp.line } });
    }
    if (comp.hasSuccessState) {
      detectedStates.push({ name: 'success', location: { file: comp.file, line: comp.line } });
    }
    if (comp.hasDisabledState) {
      detectedStates.push({ name: 'disabled', location: { file: comp.file, line: comp.line } });
    }
  }

  const foundStateNames = new Set(detectedStates.map((s) => s.name));
  const expectedStates: FlowState['name'][] = ['entry', 'loading', 'success', 'error', 'validation-error'];
  const missingStates = expectedStates.filter((s) => !foundStateNames.has(s));

  return {
    name: 'crud',
    detectedStates,
    missingStates,
    entryPoints,
  };
}
