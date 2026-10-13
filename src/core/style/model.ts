// ─── L3: Computed Style & Inventory Model ────────────────────────────────────
// Turns every styling mechanism into one ComputedStyle per element and derives
// the design-system inventory (radius scale, spacing scale, palette, type scale).
// ─────────────────────────────────────────────────────────────────────────────

import type { Fact, Provenance } from "../facts/fact.js";

export type ElementId = string;

export interface Color {
  raw: string;
  hex: string;
  l: number; // OKLab / OKLCH lightness
  a: number;
  b: number;
}

export interface Box<T> {
  top?: T;
  right?: T;
  bottom?: T;
  left?: T;
}

export interface StyleSource {
  kind: "tailwind" | "css-var" | "css-in-js" | "inline";
  raw: string;
  at?: Provenance;
}

export interface ComputedStyle {
  fontSizePx?: Fact<number>;
  fontWeight?: Fact<number>;
  lineHeight?: Fact<number>;
  color?: Fact<Color>;
  background?: Fact<string>;
  borderRadiusPx?: Fact<number>;
  spacing?: {
    padding?: Box<Fact<number>>;
    margin?: Box<Fact<number>>;
    gap?: Fact<number>;
  };
  boxShadow?: Fact<string>;
  display?: Fact<string>;
  source: StyleSource[];
}

export type UsageHistogram<T> = { value: T; count: number; elements: ElementId[]; viaToken: boolean }[];

export interface StyleInventory {
  radius: UsageHistogram<number>;
  spacing: UsageHistogram<number>;
  fontSize: UsageHistogram<number>;
  fontWeight: UsageHistogram<number>;
  colors: UsageHistogram<string>;
  shadows: UsageHistogram<string>;
  breakpoints: UsageHistogram<number>;
}

export interface DesignTokens {
  radii?: Record<string, number>;
  spacing?: Record<string, number>;
  colors?: Record<string, string>;
  fontSizes?: Record<string, number>;
}

export interface StyleModel {
  byElement: Map<ElementId, ComputedStyle>;
  tokens: DesignTokens;
  inventory: StyleInventory;
}
