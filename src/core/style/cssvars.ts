// ─── L3 Resolver: CSS Variables & Tokens ──────────────────────────────────────
// Extracts declared tokens from :root and resolves var(--x) references.
// ─────────────────────────────────────────────────────────────────────────────

import { remToPx } from "./tailwind.js";

export interface CssTokens {
  vars: Map<string, string>;
  radii: Map<string, number>;
  spacing: Map<string, number>;
  colors: Map<string, string>;
}

export function extractCssVariables(cssContent: string): CssTokens {
  const vars = new Map<string, string>();
  const radii = new Map<string, number>();
  const spacing = new Map<string, number>();
  const colors = new Map<string, string>();

  // Extract CSS variable declarations: --name: value;
  const varRegex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
  let match: RegExpExecArray | null;

  while ((match = varRegex.exec(cssContent)) !== null) {
    const varName = match[1]!;
    const val = match[2]!.trim();
    vars.set(varName, val);

    if (varName.includes("radius") || varName.includes("rounded")) {
      radii.set(varName, remToPx(val));
    } else if (varName.includes("spacing") || varName.includes("gap") || varName.includes("pad")) {
      spacing.set(varName, remToPx(val));
    } else if (varName.includes("color") || val.startsWith("#") || val.startsWith("rgb")) {
      colors.set(varName, val);
    }
  }

  return { vars, radii, spacing, colors };
}

export function resolveCssVar(
  varNameOrCall: string,
  tokens: CssTokens
): string | undefined {
  const m = /var\(\s*(--[a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\s*\)/.exec(varNameOrCall);
  if (!m) {
    return tokens.vars.get(varNameOrCall);
  }
  const name = m[1]!;
  const fallback = m[2];
  return tokens.vars.get(name) ?? fallback;
}
