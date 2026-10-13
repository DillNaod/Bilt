// ─── L3 Resolver: Tailwind Utilities ──────────────────────────────────────────
// Resolves Tailwind classes against default and project-defined theme scales.
// Uses linear-time patterns without nested quantifiers.
// ─────────────────────────────────────────────────────────────────────────────

import type { Fact, Provenance } from "../facts/fact.js";
import { confirmed, unknown } from "../facts/fact.js";

export interface TailwindTheme {
  borderRadius: Record<string, string | number>;
  spacing: Record<string, string | number>;
  colors: Record<string, string>;
  fontSize: Record<string, string | number>;
}

export const DEFAULT_TAILWIND_THEME: TailwindTheme = {
  borderRadius: {
    none: 0,
    sm: 2,
    DEFAULT: 4,
    md: 6,
    lg: 8,
    xl: 12,
    "2xl": 16,
    "3xl": 24,
    full: 9999,
  },
  spacing: {
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },
  colors: {},
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
  },
};

export function remToPx(val: string | number): number {
  if (typeof val === "number") return val;
  const matchRem = /^([0-9.]+)rem$/.exec(val);
  if (matchRem) return parseFloat(matchRem[1]!) * 16;
  const matchPx = /^([0-9.]+)px$/.exec(val);
  if (matchPx) return parseFloat(matchPx[1]!);
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

export function resolveTailwindRadius(
  cls: string,
  themeFact?: Fact<TailwindTheme>
): Fact<number> | undefined {
  const theme = themeFact && themeFact.state === "confirmed" ? themeFact.value : DEFAULT_TAILWIND_THEME;
  const prov = themeFact && themeFact.state === "confirmed" ? themeFact.provenance : [];

  // Match arbitrary: rounded-[14px]
  const arb = /^rounded-\[(\d+(?:\.\d+)?)px\]$/.exec(cls);
  if (arb) return confirmed(Number(arb[1]), []);

  // Match standard: rounded, rounded-sm, rounded-md, rounded-lg, etc.
  const m = /^rounded(?:-(none|sm|md|lg|xl|2xl|3xl|full))?$/.exec(cls);
  if (m) {
    const key = m[1] ?? "DEFAULT";
    const mapped = theme.borderRadius[key];
    if (mapped !== undefined) {
      return confirmed(remToPx(mapped), prov);
    }
  }

  return undefined;
}

export function resolveTailwindSpacing(
  cls: string,
  themeFact?: Fact<TailwindTheme>
): Fact<number> | undefined {
  const theme = themeFact && themeFact.state === "confirmed" ? themeFact.value : DEFAULT_TAILWIND_THEME;
  const prov = themeFact && themeFact.state === "confirmed" ? themeFact.provenance : [];

  // Match arbitrary: p-[16px], m-[8px], gap-[12px]
  const arb = /^(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)-\[(\d+(?:\.\d+)?)px\]$/.exec(cls);
  if (arb) return confirmed(Number(arb[1]), []);

  // Match standard: p-4, m-2, gap-6
  const m = /^(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)-([0-9.]+)$/.exec(cls);
  if (m) {
    const key = m[1]!;
    const mapped = theme.spacing[key];
    if (mapped !== undefined) {
      return confirmed(remToPx(mapped), prov);
    }
  }

  return undefined;
}

export function resolveTailwindFontSize(cls: string): Fact<number> | undefined {
  const arb = /^text-\[(\d+(?:\.\d+)?)px\]$/.exec(cls);
  if (arb) return confirmed(Number(arb[1]), []);

  const m = /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl)$/.exec(cls);
  if (m) {
    const mapped = DEFAULT_TAILWIND_THEME.fontSize[m[1]!];
    if (mapped !== undefined) {
      return confirmed(remToPx(mapped), []);
    }
  }

  return undefined;
}

export function resolveTailwindFontWeight(cls: string): Fact<number> | undefined {
  const map: Record<string, number> = {
    "font-thin": 100,
    "font-extralight": 200,
    "font-light": 300,
    "font-normal": 400,
    "font-medium": 500,
    "font-semibold": 600,
    "font-bold": 700,
    "font-extrabold": 800,
    "font-black": 900,
  };
  if (map[cls]) return confirmed(map[cls]!, []);
  return undefined;
}
