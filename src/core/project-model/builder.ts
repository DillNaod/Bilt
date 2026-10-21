// ─── ProjectModel Builder ──────────────────────────────────────────────────────
// Orchestrates all extractors and assembles a normalized ProjectModel.
// Accuracy > completeness — each extractor captures only what it can verify
// structurally from source text.
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import fs from 'node:fs/promises';
import fg from 'fast-glob';
import type {
  ProjectModel,
  RouteModel,
  ComponentModel,
  DesignSystemModel,
  NavigationModel,
  ApiEndpointModel,
  ContentModel,
  AuthModel,
  CrossPageModel,
  UserFlowModel,
} from './types.js';
import type { DesignSnapshot } from '../design/types.js';
import type { DesignBrief } from '../design/brief/types.js';
import {
  detectFramework,
  extractRoutes,
  extractComponents,
  extractDesignSystem,
  extractNavigation,
  resolveNavReachability,
  extractApiEndpoints,
  extractAuth,
  extractContent,
  buildCrossPage,
  detectUserFlows,
  type FilePayload,
} from './extractors/index.js';

// Re-export all extractors for modular external consumption
export * from './extractors/index.js';

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
      if (stat.size > 512_000) continue; // skip files >512KB
      const content = await fs.readFile(absPath, 'utf-8');
      const relPath = path.relative(rootDir, absPath).replace(/\\/g, '/');
      payloads.push({ absPath, relPath, content });
    } catch {
      // Unreadable file — skip
    }
  }

  return payloads;
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
    requirements: [], // populated by higher-level layer
    designBrief: options?.designBrief,
    legacySnapshot: options?.legacySnapshot,
    totalFilesScanned: payloads.length,
    buildTimeMs: Date.now() - start,
  };
}
