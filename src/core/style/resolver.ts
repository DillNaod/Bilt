// ─── L3 Resolver Orchestrator & Inventory Builder ─────────────────────────────
// Normalizes Tailwind, CSS variables, CSS-in-JS, and inline styles into an
// authoring-method-independent StyleInventory.
// ─────────────────────────────────────────────────────────────────────────────

import type { RepoIndex } from "../model/builder.js";
import type {
  StyleModel,
  StyleInventory,
  UsageHistogram,
  ComputedStyle,
  ElementId,
  DesignTokens,
} from "./model.js";
import {
  DEFAULT_TAILWIND_THEME,
  resolveTailwindRadius,
  resolveTailwindSpacing,
  resolveTailwindFontSize,
  resolveTailwindFontWeight,
  remToPx,
  type TailwindTheme,
} from "./tailwind.js";
import { extractCssVariables, resolveCssVar, type CssTokens } from "./cssvars.js";
import { extractStyledComponents } from "./cssinjs.js";
import { confirmed, type Fact } from "../facts/fact.js";
import { evaluateConfigFile } from "../ingest/static-eval.js";

function addToHistogram<T>(
  hist: UsageHistogram<T>,
  val: T,
  elementId: ElementId,
  viaToken: boolean
): void {
  const existing = hist.find((h) => h.value === val);
  if (existing) {
    existing.count++;
    if (!existing.elements.includes(elementId)) {
      existing.elements.push(elementId);
    }
    if (viaToken) existing.viaToken = true;
  } else {
    hist.push({
      value: val,
      count: 1,
      elements: [elementId],
      viaToken,
    });
  }
}

export async function buildStyleModel(repo: RepoIndex): Promise<StyleModel> {
  const byElement = new Map<ElementId, ComputedStyle>();
  const radiusHist: UsageHistogram<number> = [];
  const spacingHist: UsageHistogram<number> = [];
  const fontSizeHist: UsageHistogram<number> = [];
  const fontWeightHist: UsageHistogram<number> = [];
  const colorsHist: UsageHistogram<string> = [];
  const shadowsHist: UsageHistogram<string> = [];
  const breakpointsHist: UsageHistogram<number> = [];

  // 1. Resolve project Tailwind theme if configured
  let tailwindThemeFact: Fact<TailwindTheme> | undefined;
  const twFile =
    repo.file("tailwind.config.js") ??
    repo.file("tailwind.config.ts") ??
    repo.file("tailwind.config.mjs") ??
    repo.file("tailwind.config.cjs");

  if (twFile) {
    const evaluated = evaluateConfigFile(twFile.bytes.toString("utf8"));
    if (evaluated.ok && evaluated.value) {
      const themeObj = (evaluated.value as any).theme ?? {};
      const extend = themeObj.extend ?? {};
      const customRadius = extend.borderRadius ?? themeObj.borderRadius ?? {};
      const customSpacing = extend.spacing ?? themeObj.spacing ?? {};
      const customColors = extend.colors ?? themeObj.colors ?? {};

      const mergedTheme: TailwindTheme = {
        borderRadius: { ...DEFAULT_TAILWIND_THEME.borderRadius, ...customRadius },
        spacing: { ...DEFAULT_TAILWIND_THEME.spacing, ...customSpacing },
        colors: { ...DEFAULT_TAILWIND_THEME.colors, ...customColors },
        fontSize: { ...DEFAULT_TAILWIND_THEME.fontSize, ...(themeObj.fontSize ?? {}) },
      };
      tailwindThemeFact = confirmed(mergedTheme, [{ file: twFile.path }]);
    }
  }

  // 2. Extract CSS variables from all CSS files
  let allCssTokens: CssTokens = {
    vars: new Map(),
    radii: new Map(),
    spacing: new Map(),
    colors: new Map(),
  };

  for (const file of repo.files) {
    if (file.path.endsWith(".css")) {
      const content = file.bytes.toString("utf8");
      const tokens = extractCssVariables(content);
      for (const [k, v] of tokens.vars) allCssTokens.vars.set(k, v);
      for (const [k, v] of tokens.radii) allCssTokens.radii.set(k, v);
      for (const [k, v] of tokens.spacing) allCssTokens.spacing.set(k, v);
      for (const [k, v] of tokens.colors) allCssTokens.colors.set(k, v);
    }
  }

  // 3. Extract styled-components and CSS-in-JS declarations
  for (const file of repo.files) {
    if (
      file.path.endsWith(".tsx") ||
      file.path.endsWith(".jsx") ||
      file.path.endsWith(".ts") ||
      file.path.endsWith(".js")
    ) {
      const content = file.bytes.toString("utf8");
      const styledDecls = extractStyledComponents(content);
      for (const decl of styledDecls) {
        const elId = `${file.path}:styled`;
        let numPx = decl.numericPx;
        let viaToken = false;
        if (decl.value.startsWith("var(")) {
          const resolved = resolveCssVar(decl.value, allCssTokens);
          if (resolved) {
            numPx = remToPx(resolved);
            viaToken = true;
          }
        }
        if (decl.property === "border-radius" && numPx !== undefined && numPx > 0) {
          addToHistogram(radiusHist, numPx, elId, viaToken);
        } else if (
          (decl.property === "padding" || decl.property === "margin" || decl.property === "gap") &&
          numPx !== undefined && numPx > 0
        ) {
          addToHistogram(spacingHist, numPx, elId, viaToken);
        } else if (decl.property === "color" || decl.property === "background-color") {
          addToHistogram(colorsHist, decl.value, elId, viaToken);
        }
      }
    }
  }

  // 4. Scan classNames across JSX/TSX/HTML files
  for (const file of repo.files) {
    if (
      file.path.endsWith(".tsx") ||
      file.path.endsWith(".jsx") ||
      file.path.endsWith(".html") ||
      file.path.endsWith(".vue") ||
      file.path.endsWith(".svelte")
    ) {
      const content = file.bytes.toString("utf8");
      // Find class or className="..."
      const classRegex = /(?:className|class)\s*=\s*['"`]([^'"`]+)['"`]/g;
      let match: RegExpExecArray | null;

      while ((match = classRegex.exec(content)) !== null) {
        const classNames = match[1]!.split(/\s+/).filter(Boolean);
        const line = content.slice(0, match.index).split("\n").length;
        const elId = `${file.path}:${line}`;

        for (const cls of classNames) {
          // Check radius
          const rFact = resolveTailwindRadius(cls, tailwindThemeFact);
          if (rFact && rFact.state === "confirmed") {
            addToHistogram(radiusHist, rFact.value, elId, true);
          }

          // Check spacing
          const sFact = resolveTailwindSpacing(cls, tailwindThemeFact);
          if (sFact && sFact.state === "confirmed") {
            addToHistogram(spacingHist, sFact.value, elId, true);
          }

          // Check font size
          const fsFact = resolveTailwindFontSize(cls);
          if (fsFact && fsFact.state === "confirmed") {
            addToHistogram(fontSizeHist, fsFact.value, elId, true);
          }

          // Check font weight
          const fwFact = resolveTailwindFontWeight(cls);
          if (fwFact && fwFact.state === "confirmed") {
            addToHistogram(fontWeightHist, fwFact.value, elId, true);
          }

          // Check color classes
          const colMatch = /^(?:bg|text|border)-([a-zA-Z0-9_-]+)$/.exec(cls);
          if (colMatch) {
            addToHistogram(colorsHist, colMatch[1]!, elId, true);
          }
        }
      }

      // Find inline style blocks: style={{ ... }}
      const styleBlockRegex = /style\s*=\s*\{\{([\s\S]*?)\}\}/g;
      let blockMatch: RegExpExecArray | null;
      while ((blockMatch = styleBlockRegex.exec(content)) !== null) {
        const block = blockMatch[1]!;
        const blockIndex = blockMatch.index;
        const line = content.slice(0, blockIndex).split("\n").length;
        const elId = `${file.path}:${line}`;

        // Find borderRadius inside style block
        const rMatch = /borderRadius\s*:\s*['"`]?([0-9.]+(?:px|rem)?|var\([^)]+\))['"`]?/.exec(block);
        if (rMatch) {
          const raw = rMatch[1]!;
          if (raw.startsWith("var(")) {
            const varVal = resolveCssVar(raw, allCssTokens);
            if (varVal) {
              addToHistogram(radiusHist, remToPx(varVal), elId, true);
            }
          } else {
            addToHistogram(radiusHist, remToPx(raw), elId, false);
          }
        }

        // Find padding, margin, or gap inside style block
        const sMatch = /(?:padding|margin|gap)\s*:\s*['"`]?([0-9.]+(?:px|rem)?|var\([^)]+\))['"`]?/.exec(block);
        if (sMatch) {
          const raw = sMatch[1]!;
          if (raw.startsWith("var(")) {
            const varVal = resolveCssVar(raw, allCssTokens);
            if (varVal) {
              addToHistogram(spacingHist, remToPx(varVal), elId, true);
            }
          } else {
            addToHistogram(spacingHist, remToPx(raw), elId, false);
          }
        }
      }
    }
  }

  // Sort histograms
  radiusHist.sort((a, b) => a.value - b.value);
  spacingHist.sort((a, b) => a.value - b.value);

  const inventory: StyleInventory = {
    radius: radiusHist,
    spacing: spacingHist,
    fontSize: fontSizeHist,
    fontWeight: fontWeightHist,
    colors: colorsHist,
    shadows: shadowsHist,
    breakpoints: breakpointsHist,
  };

  const tokens: DesignTokens = {
    radii: Object.fromEntries(
      (tailwindThemeFact?.state === "confirmed"
        ? Object.entries(tailwindThemeFact.value.borderRadius).map(([k, v]) => [k, remToPx(v)])
        : []
      ).concat(Array.from(allCssTokens.radii.entries()))
    ),
    spacing: Object.fromEntries(Array.from(allCssTokens.spacing.entries())),
    colors: Object.fromEntries(Array.from(allCssTokens.colors.entries())),
  };

  return {
    byElement,
    tokens,
    inventory,
  };
}
