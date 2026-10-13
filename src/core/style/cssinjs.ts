// ─── L3 Resolver: CSS-in-JS (styled-components / emotion) ─────────────────────
// Parses styles declared in styled.div`...` or css`...` tagged templates.
// ─────────────────────────────────────────────────────────────────────────────

import { remToPx } from "./tailwind.js";

export interface CssInJsDeclaration {
  property: string;
  value: string;
  numericPx?: number;
}

export function parseCssBlock(block: string): CssInJsDeclaration[] {
  const decls: CssInJsDeclaration[] = [];
  const lines = block.split(";");

  for (const line of lines) {
    const parts = line.split(":");
    if (parts.length < 2) continue;
    const prop = parts[0]!.trim().toLowerCase();
    const val = parts.slice(1).join(":").trim();
    if (!prop || !val) continue;

    decls.push({
      property: prop,
      value: val,
      numericPx: remToPx(val),
    });
  }

  return decls;
}

export function extractStyledComponents(sourceCode: string): CssInJsDeclaration[] {
  const decls: CssInJsDeclaration[] = [];

  // Match styled.tag`...` or styled(Component)`...`
  const styledRegex = /styled(?:\.[a-zA-Z0-9]+|\([^)]+\))\s*`([\s\S]*?)`/g;
  let match: RegExpExecArray | null;

  while ((match = styledRegex.exec(sourceCode)) !== null) {
    const block = match[1]!;
    decls.push(...parseCssBlock(block));
  }

  // Match css`...` tagged templates
  const cssTaggedRegex = /\bcss\s*`([\s\S]*?)`/g;
  while ((match = cssTaggedRegex.exec(sourceCode)) !== null) {
    const block = match[1]!;
    decls.push(...parseCssBlock(block));
  }

  return decls;
}
