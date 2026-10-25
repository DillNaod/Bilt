// ─── Design Snapshot Builder ───────────────────────────────────────────────
// Static analysis scanner that constructs a normalized DesignSnapshot representation
// without executing arbitrary code or relying on external LLMs.
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import fs from "node:fs/promises";
import fg from "fast-glob";
import type {
  DesignSnapshot,
  RouteSnapshot,
  ComponentSnapshot,
  StyleSnapshot,
  AssetSnapshot,
} from "./types.js";

import {
  detectFramework,
  checkLegalAnd404,
  extractRouteSnapshot,
  TypographyCollector,
  ColorCollector,
  InteractionCollector,
  CopyCollector,
  UXStateCollector,
  extractStyleSnapshot,
  extractComponentSnapshot,
  extractAssetSnapshot,
} from "./snapshot/index.js";

export * from "./snapshot/index.js";

export async function buildDesignSnapshot(
  rootDir: string,
  targetFiles?: string[],
): Promise<DesignSnapshot> {
  const normalizedRoot = path.resolve(rootDir);

  // 1. Gather all UI-relevant files
  let scannedPaths: string[];
  if (targetFiles && targetFiles.length > 0) {
    scannedPaths = targetFiles.map((f) =>
      path.isAbsolute(f) ? f : path.join(normalizedRoot, f),
    );
  } else {
    scannedPaths = await fg(
      [
        "**/*.{tsx,jsx,html,vue,svelte,css,scss}",
        "**/package.json",
        "**/app/**",
        "**/pages/**",
        "**/routes/**",
        "**/public/**",
      ],
      {
        cwd: normalizedRoot,
        ignore: [
          "**/node_modules/**",
          "**/dist/**",
          "**/build/**",
          "**/.next/**",
          "**/.nuxt/**",
          "**/.git/**",
          "**/coverage/**",
          "**/test/**",
          "**/tests/**",
          "**/*.test.*",
          "**/*.spec.*",
        ],
        absolute: true,
      },
    );
  }

  const routes: RouteSnapshot[] = [];
  const components: ComponentSnapshot[] = [];
  const styles: StyleSnapshot[] = [];
  const assets: AssetSnapshot[] = [];

  let detectedFramework: string | undefined;
  let hasTosFile = false;
  let hasPrivacyFile = false;
  let has404File = false;
  let hasDesktopNavComponent = false;
  let hasMobileNavComponent = false;

  const typographyCollector = new TypographyCollector();
  const colorCollector = new ColorCollector();
  const interactionCollector = new InteractionCollector();
  const copyCollector = new CopyCollector();
  const uxStateCollector = new UXStateCollector();

  for (const filePath of scannedPaths) {
    const relPath = path.relative(normalizedRoot, filePath).replace(/\\/g, "/");
    const lowerRel = relPath.toLowerCase();

    // Check legal & 404 routes
    const legalAnd404 = checkLegalAnd404(lowerRel);
    if (legalAnd404.isTos) hasTosFile = true;
    if (legalAnd404.isPrivacy) hasPrivacyFile = true;
    if (legalAnd404.is404) has404File = true;

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      continue;
    }

    if (relPath.endsWith("package.json")) {
      const framework = detectFramework(content);
      if (framework) {
        detectedFramework = framework;
      }
      continue;
    }

    // Identify routes
    const routeSnapshot = extractRouteSnapshot(relPath, lowerRel, content);
    if (routeSnapshot) {
      routes.push(routeSnapshot);
    }

    const lines = content.split("\n");

    // Process typography, copy, and UX states
    typographyCollector.processFile(content, lines);
    copyCollector.processFile(relPath, content, lines);
    uxStateCollector.processFile(content, lines);

    // Process interactions per line
    for (const lineText of lines) {
      interactionCollector.processLine(lineText);
    }

    // Inspect styles & colors
    styles.push(extractStyleSnapshot(relPath, content, lines, colorCollector));

    // Inspect components
    const componentResult = extractComponentSnapshot(
      filePath,
      relPath,
      content,
      lines,
      interactionCollector.getMarqueeCount() > 0,
    );
    if (componentResult.hasDesktopNav) hasDesktopNavComponent = true;
    if (componentResult.hasMobileNav) hasMobileNavComponent = true;
    components.push(componentResult.component);

    // Inspect assets
    assets.push(
      extractAssetSnapshot(relPath, content, {
        hasTos: hasTosFile,
        hasPrivacy: hasPrivacyFile,
        has404: has404File,
      }),
    );
  }

  const missingMobileNav = hasDesktopNavComponent && !hasMobileNavComponent;

  return {
    framework: detectedFramework,
    routes,
    components,
    styles,
    typography: typographyCollector.snapshot(),
    colors: colorCollector.snapshot(),
    assets,
    interactions: [interactionCollector.snapshot()],
    copy: copyCollector.snapshot(),
    uxStates: [uxStateCollector.snapshot(missingMobileNav)],
    totalFilesScanned: scannedPaths.length,
  };
}
