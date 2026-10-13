// ─── Design System Consistency Rules ─────────────────────────────────────────
// Rules that analyze model.designSystem for incoherence:
//   • Border radius distribution
//   • Arbitrary spacing values
//   • Color proliferation
// Evidence-first: collect structural facts, then evaluate in rules.
// ─────────────────────────────────────────────────────────────────────────────

import type { RegisteredRule, RuleFinding } from '../../rule-registry/types.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Given a Map<string, any> (token → count or { count, locations }), compute:
 *  - total usage count
 *  - percentage of usage accounted for by the top N values
 */
function topNCoverage(dist: Map<string, any>, n: number): { total: number; topCoverage: number; topEntries: Array<[string, number]> } {
  const entries: Array<[string, number]> = [];
  for (const [k, v] of dist.entries()) {
    const count = typeof v === 'number' ? v : (v && typeof v.count === 'number' ? v.count : 1);
    entries.push([k, count]);
  }
  entries.sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return { total: 0, topCoverage: 1, topEntries: [] };

  const topEntries = entries.slice(0, n);
  const topSum = topEntries.reduce((sum, [, count]) => sum + count, 0);
  return { total, topCoverage: topSum / total, topEntries };
}

function formatDistribution(entries: Array<[string, any]>): string {
  return entries.map(([k, v]) => {
    const count = typeof v === 'number' ? v : (v && typeof v.count === 'number' ? v.count : 1);
    return `${k} (${count})`;
  }).join(', ');
}

// ---------------------------------------------------------------------------
// DESIGN-SYSTEM-001: Incoherent Border Radius Distribution
// ---------------------------------------------------------------------------

export const designSystem001: RegisteredRule = {
  id: 'DESIGN-SYSTEM-001',
  category: 'design-system',
  title: 'Incoherent Border Radius Distribution',
  severity: 'low',
  precision: 'high',
  maturity: 'stable',

  detect(model: any): RuleFinding[] {
    const radii: Map<string, any> | undefined = model?.designSystem?.radii;
    if (!(radii instanceof Map) || radii.size < 5) return [];

    const { total, topCoverage, topEntries } = topNCoverage(radii, 3);
    if (total === 0) return [];

    // Only report when top-3 values don't account for >= 70% of usage
    if (topCoverage >= 0.70) return [];

    const allEntries = Array.from(radii.entries())
      .map(([k, v]) => [k, typeof v === 'number' ? v : (v as any)?.count ?? 1] as [string, number])
      .sort((a, b) => b[1] - a[1]);
    const topPct = Math.round(topCoverage * 100);

    return [
      {
        ruleId: 'DESIGN-SYSTEM-001',
        title: 'Incoherent Border Radius Distribution',
        severity: 'low',
        precision: 'high',
        maturity: 'stable',
        category: 'design-system',
        evidence: [
          `Interface uses ${radii.size} distinct border-radius values: ${formatDistribution(allEntries)}`,
          `No radius system detected: top-3 values account for only ${topPct}% of usage`,
          `Top-3 radius values: ${formatDistribution(topEntries)}`,
        ],
        locations: [],
        agentObjective:
          'Establish a coherent border-radius scale. Choose 2–3 radius values (e.g. rounded-md for containers, rounded-sm for inputs, rounded-full for badges) and apply them consistently throughout the interface. Remove ad-hoc radius values.',
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// DESIGN-SYSTEM-002: Arbitrary Spacing Values
// ---------------------------------------------------------------------------

export const designSystem002: RegisteredRule = {
  id: 'DESIGN-SYSTEM-002',
  category: 'design-system',
  title: 'Arbitrary Spacing Values',
  severity: 'low',
  precision: 'high',
  maturity: 'stable',

  detect(model: any): RuleFinding[] {
    const spacing: Map<string, any> | undefined = model?.designSystem?.spacing;
    if (!(spacing instanceof Map) || spacing.size < 8) return [];

    // 1. Detect explicit arbitrary bracket spacing values: p-[17px], mt-[23px], gap-[13px]
    const arbitraryEntries: Array<[string, number]> = [];
    for (const [k, v] of spacing.entries()) {
      if (/\[[^\]]+\]/.test(k)) {
        const count = typeof v === 'number' ? v : (v && typeof v.count === 'number' ? v.count : 1);
        arbitraryEntries.push([k, count]);
      }
    }

    if (arbitraryEntries.length >= 2) {
      return [
        {
          ruleId: 'DESIGN-SYSTEM-002',
          title: 'Arbitrary Spacing Values',
          severity: 'low',
          precision: 'high',
          maturity: 'stable',
          category: 'design-system',
          evidence: [
            `${arbitraryEntries.length} arbitrary bracket spacing values bypass the design scale: ${formatDistribution(arbitraryEntries)}`,
            'Hardcoded pixel values break spacing rhythm and responsiveness.',
          ],
          locations: [],
          agentObjective:
            'Replace arbitrary bracket spacing values with standard scale tokens from your design system or Tailwind scale.',
        },
      ];
    }

    // 2. Normalize to scale steps (stripping p-, px-, py-, mt-, mb-, gap-, etc.)
    const scaleSteps = new Map<string, number>();
    for (const [k, v] of spacing.entries()) {
      const step = k.replace(/^(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-/, '');
      const count = typeof v === 'number' ? v : (v && typeof v.count === 'number' ? v.count : 1);
      scaleSteps.set(step, (scaleSteps.get(step) ?? 0) + count);
    }

    // High distinct scale steps with chaotic distribution and no design token file
    if (scaleSteps.size >= 14 && !model?.designSystem?.hasDesignTokenFile) {
      const { topCoverage, topEntries } = topNCoverage(scaleSteps, 4);
      if (topCoverage < 0.50) {
        const allEntries = Array.from(scaleSteps.entries()).sort((a, b) => b[1] - a[1]);
        const topPct = Math.round(topCoverage * 100);
        return [
          {
            ruleId: 'DESIGN-SYSTEM-002',
            title: 'Arbitrary Spacing Values',
            severity: 'low',
            precision: 'high',
            maturity: 'stable',
            category: 'design-system',
            evidence: [
              `Interface uses ${scaleSteps.size} distinct spacing scale steps: ${formatDistribution(allEntries)}`,
              `No consistent spacing scale: top-4 scale values account for only ${topPct}% of usage`,
              `Top-4 scale values: ${formatDistribution(topEntries)}`,
            ],
            locations: [],
            agentObjective:
              'Define a spacing scale (e.g. 4, 8, 16, 24, 32, 48px) and apply it consistently via Tailwind spacing classes. Eliminate arbitrary one-off spacing values.',
          },
        ];
      }
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// DESIGN-SYSTEM-003: Color Proliferation
// ---------------------------------------------------------------------------
// Counts distinct non-neutral color values. Does NOT count neutral grays
// (gray, slate, neutral, zinc, stone, white, black) as proliferation signals.
// ---------------------------------------------------------------------------

const NEUTRAL_COLOR_RE = /^(?:(?:bg|text|border|ring|divide|from|to|via|fill|stroke)-)?(?:gray|slate|neutral|zinc|stone)(?:-\d+)?$/i;
const BASE_NEUTRALS = /^(?:(?:bg|text|border|ring|divide|from|to|via|fill|stroke)-)?(?:white|black|transparent|inherit|current|currentColor)$/i;

function isNeutralColor(token: string): boolean {
  return NEUTRAL_COLOR_RE.test(token) || BASE_NEUTRALS.test(token);
}

export const designSystem003: RegisteredRule = {
  id: 'DESIGN-SYSTEM-003',
  category: 'design-system',
  title: 'Color Proliferation',
  severity: 'medium',
  precision: 'medium',
  maturity: 'stable',

  detect(model: any): RuleFinding[] {
    const colors: Map<string, any> | undefined = model?.designSystem?.colors;
    if (!(colors instanceof Map)) return [];

    // Filter out neutral grays
    const nonNeutral = new Map<string, number>();
    for (const [token, val] of colors.entries()) {
      if (!isNeutralColor(token)) {
        const count = typeof val === 'number' ? val : (val && typeof val.count === 'number' ? val.count : 1);
        nonNeutral.set(token, count);
      }
    }

    if (nonNeutral.size < 12) return [];

    const allEntries = Array.from(nonNeutral.entries())
      .map(([k, v]) => [k, typeof v === 'number' ? v : (v as any)?.count ?? 1] as [string, number])
      .sort((a, b) => b[1] - a[1]);
    const { topCoverage, topEntries } = topNCoverage(nonNeutral, 5);
    const topPct = Math.round(topCoverage * 100);

    return [
      {
        ruleId: 'DESIGN-SYSTEM-003',
        title: 'Color Proliferation',
        severity: 'medium',
        precision: 'medium',
        maturity: 'stable',
        category: 'design-system',
        evidence: [
          `${nonNeutral.size} distinct non-neutral color values found across the codebase`,
          `Distribution: ${formatDistribution(allEntries.slice(0, 8))}${allEntries.length > 8 ? ` (+${allEntries.length - 8} more)` : ''}`,
          `Top-5 colors account for ${topPct}% of usage: ${formatDistribution(topEntries)}`,
        ],
        locations: [],
        agentObjective:
          'Consolidate to a defined color palette: 1 primary, 1 accent, 2-3 semantic colors (success, warning, error), and neutrals. Extract color tokens to a design system file or CSS custom properties. Remove one-off color values not part of the palette.',
      },
    ];
  },
};
