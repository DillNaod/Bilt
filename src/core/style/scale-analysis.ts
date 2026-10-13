// ─── L3: Scale Analysis & Color Comparison ────────────────────────────────────
// Analyzes design token scale coherence (e.g. radius, spacing) and detects
// near-duplicate values / arbitrary off-scale values using OKLab distance.
// ─────────────────────────────────────────────────────────────────────────────

import type { UsageHistogram } from "./model.js";

export interface ScaleCluster {
  center: number;
  members: number[];
  uses: number;
}

export interface ScaleReport {
  distinct: number;
  clusters: ScaleCluster[];
  nearDuplicates: [number, number][];
  offScale: { value: number; uses: number }[];
  followsDeclaredScale: boolean;
}

export function parseHex(hexStr: string): { r: number; g: number; b: number } | null {
  const clean = hexStr.replace(/^#/, "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0]! + clean[0]!, 16) / 255;
    const g = parseInt(clean[1]! + clean[1]!, 16) / 255;
    const b = parseInt(clean[2]! + clean[2]!, 16) / 255;
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  return null;
}

// Convert sRGB to linear sRGB
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Convert linear sRGB to OKLab
export function hexToOklab(hex: string): { l: number; a: number; b: number } {
  const rgb = parseHex(hex);
  if (!rgb) return { l: 0, a: 0, b: 0 };

  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  // Approximate D65 to cone response (M1)
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function nearDuplicateColors(hexA: string, hexB: string): boolean {
  if (hexA.toLowerCase() === hexB.toLowerCase()) return false;
  const labA = hexToOklab(hexA);
  const labB = hexToOklab(hexB);
  const dist = Math.sqrt(
    Math.pow(labA.l - labB.l, 2) + Math.pow(labA.a - labB.a, 2) + Math.pow(labA.b - labB.b, 2)
  );
  return dist < 0.02;
}

function onScale(val: number, scale: number[], tol: number): boolean {
  return scale.some((step) => Math.abs(val - step) <= tol);
}

function clusterValues(
  values: number[],
  hist: UsageHistogram<number>,
  tol: number
): ScaleCluster[] {
  const clusters: ScaleCluster[] = [];
  const visited = new Set<number>();

  for (const v of values) {
    if (visited.has(v)) continue;
    const members = values.filter((other) => Math.abs(other - v) <= tol);
    for (const m of members) visited.add(m);

    const center = members.reduce((sum, n) => sum + n, 0) / members.length;
    const uses = members.reduce((sum, m) => {
      const entry = hist.find((h) => h.value === m);
      return sum + (entry?.count ?? 1);
    }, 0);

    clusters.push({ center, members, uses });
  }

  return clusters;
}

export function analyzeScale(
  hist: UsageHistogram<number>,
  declared?: number[],
  tol = 1.5
): ScaleReport {
  const values = Array.from(new Set(hist.map((h) => h.value))).sort((a, b) => a - b);
  const near: [number, number][] = [];

  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]!;
    const curr = values[i]!;
    if (curr - prev > 0 && curr - prev <= tol) {
      near.push([prev, curr]);
    }
  }

  const effectiveScale = declared ?? [0, 4, 8, 12, 16, 24, 32, 48, 64];
  const off = hist
    .filter((h) => !onScale(h.value, effectiveScale, tol))
    .map((h) => ({ value: h.value, uses: h.count }));

  const followsDeclaredScale = declared !== undefined && off.length === 0;

  return {
    distinct: values.length,
    clusters: clusterValues(values, hist, tol),
    nearDuplicates: near,
    offScale: off,
    followsDeclaredScale,
  };
}
