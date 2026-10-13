// ─── Structural Composition Rules ─────────────────────────────────────────────
// Rules that analyze the structural composition of components across pages.
// Evidence-first: collect structural facts, then evaluate facts in rules.
// ─────────────────────────────────────────────────────────────────────────────

import type { RegisteredRule, RuleFinding, RuleFindingLocation } from '../../rule-registry/types.js';

// ---------------------------------------------------------------------------
// DESIGN-STRUCTURE-001: Generic SaaS Landing Composition
// ---------------------------------------------------------------------------
// Fires when >= 5 distinct generic SaaS landing-page signals co-occur on a page.
// Precision is 'high' at >= 6 signals, 'medium' at >= 5.
// ---------------------------------------------------------------------------

const GENERIC_CTA_TEXTS = ['get started', 'start free', 'try for free', 'build the future'];

interface CompositionSignal {
  key: string;
  label: string;
  locations: RuleFindingLocation[];
}

function detectCompositionSignals(model: any): CompositionSignal[] {
  const components: any[] = Array.isArray(model?.components) ? model.components : [];
  const signals: CompositionSignal[] = [];

  // Helper: add a signal with deduplicated locations
  function addSignal(key: string, label: string, locs: RuleFindingLocation[]): void {
    signals.push({ key, label, locations: locs });
  }

  // 1. hero-eyebrow
  const eyebrowComponents = components.filter((c: any) =>
    Array.isArray(c.decorativeSignals) &&
    c.decorativeSignals.some((s: any) => s.type === 'hero-eyebrow'),
  );
  if (eyebrowComponents.length > 0) {
    addSignal('hero-eyebrow', 'uppercase eyebrow text above hero heading', eyebrowComponents.map((c: any) => ({ file: c.file, line: c.line, description: 'hero eyebrow' })));
  }

  // 2. radial-orb
  const orbComponents = components.filter((c: any) =>
    Array.isArray(c.decorativeSignals) &&
    c.decorativeSignals.some((s: any) => s.type === 'radial-orb'),
  );
  if (orbComponents.length > 0) {
    addSignal('radial-orb', 'decorative radial glow/orb background element', orbComponents.map((c: any) => ({ file: c.file, line: c.line, description: 'radial orb' })));
  }

  // 3. three-column
  const threeColComponents = components.filter((c: any) =>
    Array.isArray(c.decorativeSignals) &&
    c.decorativeSignals.some((s: any) => s.type === 'three-column'),
  );
  if (threeColComponents.length > 0) {
    addSignal('three-column', 'three-column feature grid', threeColComponents.map((c: any) => ({ file: c.file, line: c.line, description: 'three-column grid' })));
  }

  // 4. feature-icons (Lucide icons inside colored circles in feature cards)
  const featureIconComponents = components.filter((c: any) =>
    Array.isArray(c.decorativeSignals) &&
    c.decorativeSignals.some((s: any) => s.type === 'feature-icons'),
  );
  if (featureIconComponents.length > 0) {
    addSignal('feature-icons', 'Lucide icons inside colored circles in feature cards', featureIconComponents.map((c: any) => ({ file: c.file, line: c.line, description: 'feature icons' })));
  }

  // 5. bento-grid
  const bentoComponents = components.filter((c: any) =>
    Array.isArray(c.decorativeSignals) &&
    c.decorativeSignals.some((s: any) => s.type === 'bento-grid'),
  );
  if (bentoComponents.length > 0) {
    addSignal('bento-grid', 'bento/asymmetric grid layout', bentoComponents.map((c: any) => ({ file: c.file, line: c.line, description: 'bento grid' })));
  }

  // 6. logo-strip
  const logoComponents = components.filter((c: any) =>
    Array.isArray(c.decorativeSignals) &&
    c.decorativeSignals.some((s: any) => s.type === 'logo-strip'),
  );
  if (logoComponents.length > 0) {
    addSignal('logo-strip', 'fake customer logo strip', logoComponents.map((c: any) => ({ file: c.file, line: c.line, description: 'logo strip' })));
  }

  // 7. testimonial
  const testimonialComponents = components.filter((c: any) =>
    Array.isArray(c.decorativeSignals) &&
    c.decorativeSignals.some((s: any) => s.type === 'testimonial'),
  );
  if (testimonialComponents.length > 0) {
    addSignal('testimonial', 'testimonial section with quotes', testimonialComponents.map((c: any) => ({ file: c.file, line: c.line, description: 'testimonial' })));
  }

  // 8. marquee
  const marqueeComponents = components.filter((c: any) =>
    Array.isArray(c.decorativeSignals) &&
    c.decorativeSignals.some((s: any) => s.type === 'marquee'),
  );
  if (marqueeComponents.length > 0) {
    addSignal('marquee', 'infinite scrolling marquee', marqueeComponents.map((c: any) => ({ file: c.file, line: c.line, description: 'marquee' })));
  }

  // 9. gradient (2+ gradient components)
  const gradientComponents = components.filter((c: any) =>
    Array.isArray(c.decorativeSignals) &&
    c.decorativeSignals.some((s: any) => s.type === 'gradient'),
  );
  if (gradientComponents.length >= 2) {
    addSignal('gradient', `${gradientComponents.length} gradient components`, gradientComponents.map((c: any) => ({ file: c.file, line: c.line, description: 'gradient' })));
  }

  // 10. glassmorphism
  const glassComponents = components.filter((c: any) =>
    Array.isArray(c.decorativeSignals) &&
    c.decorativeSignals.some((s: any) => s.type === 'glassmorphism'),
  );
  if (glassComponents.length > 0) {
    addSignal('glassmorphism', 'glass/frosted card effects', glassComponents.map((c: any) => ({ file: c.file, line: c.line, description: 'glassmorphism' })));
  }

  // 11. Generic CTA text
  const ctaComponents = components.filter((c: any) =>
    Array.isArray(c.ctaTexts) &&
    c.ctaTexts.some((t: string) =>
      GENERIC_CTA_TEXTS.some((generic) => t.toLowerCase().includes(generic)),
    ),
  );
  if (ctaComponents.length > 0) {
    const foundCtas = ctaComponents.flatMap((c: any) =>
      (c.ctaTexts as string[]).filter((t) =>
        GENERIC_CTA_TEXTS.some((generic) => t.toLowerCase().includes(generic)),
      ),
    );
    const uniqueCtas = Array.from(new Set(foundCtas));
    addSignal('generic-cta', `generic CTA text: ${uniqueCtas.slice(0, 3).map((t) => `"${t}"`).join(', ')}`, ctaComponents.map((c: any) => ({ file: c.file, line: c.line, description: 'generic CTA' })));
  }

  return signals;
}

export const designStructure001: RegisteredRule = {
  id: 'DESIGN-STRUCTURE-001',
  category: 'design-composition',
  title: 'Generic SaaS Landing Composition',
  severity: 'high',
  precision: 'high',
  maturity: 'stable',

  detect(model: any): RuleFinding[] {
    const signals = detectCompositionSignals(model);
    const score = signals.length;

    if (score < 5) return [];

    const precision = score >= 6 ? 'high' as const : 'medium' as const;

    const allLocations: RuleFindingLocation[] = signals.flatMap((s) => s.locations);

    const evidence: string[] = [
      `${score} of 11 generic SaaS landing patterns detected`,
      ...signals.map((s) => s.label),
    ];

    return [
      {
        ruleId: 'DESIGN-STRUCTURE-001',
        title: 'Generic SaaS Landing Composition',
        severity: 'high',
        precision,
        maturity: 'stable',
        category: 'design-composition',
        evidence,
        locations: allLocations,
        agentObjective:
          'Replace at least 3 of the detected generic SaaS patterns with product-specific visual elements: real product screenshots, domain-specific diagrams, or authentic user workflow states. Remove the decorative radial orbs and logo strips that are placeholder content.',
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// DESIGN-STRUCTURE-002: Uniform Section Repetition
// ---------------------------------------------------------------------------
// Detects when 3+ components share identical or near-identical structural
// signatures (similarity ratio >= 0.85) across different pages/sections.
// Does NOT fire for known card variants that intentionally repeat in one file.
// ---------------------------------------------------------------------------

/**
 * Compute a structural signature string for a component based on its
 * decorativeSignals and other structural properties.
 */
function getStructuralSignature(component: any): string {
  const signals: string[] = [];

  if (Array.isArray(component.decorativeSignals)) {
    for (const s of component.decorativeSignals) {
      signals.push(String(s.type));
    }
  }

  // Include CTA count to differentiate
  if (Array.isArray(component.ctaTexts)) {
    signals.push(`cta:${component.ctaTexts.length}`);
  }

  return signals.sort().join('|');
}

/**
 * Rough similarity ratio between two signature strings.
 * Uses token intersection / union (Jaccard-like) on pipe-delimited tokens.
 */
function signatureSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const tokA = new Set(a.split('|').filter(Boolean));
  const tokB = new Set(b.split('|').filter(Boolean));
  if (tokA.size === 0 && tokB.size === 0) return 1;
  if (tokA.size === 0 || tokB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokA) {
    if (tokB.has(t)) intersection++;
  }
  const union = tokA.size + tokB.size - intersection;
  return intersection / union;
}

export const designStructure002: RegisteredRule = {
  id: 'DESIGN-STRUCTURE-002',
  category: 'design-repetition',
  title: 'Uniform Section Repetition',
  severity: 'medium',
  precision: 'medium',
  maturity: 'stable',

  detect(model: any): RuleFinding[] {
    const components: any[] = Array.isArray(model?.components) ? model.components : [];
    if (components.length < 3) return [];

    // Group components by (file + name) to identify intentional repeats
    type ComponentGroup = {
      component: any;
      signature: string;
    };

    const groups: ComponentGroup[] = components
      .filter((c: any) => {
        const sig = getStructuralSignature(c);
        return sig.length > 0;
      })
      .map((c: any) => ({ component: c, signature: getStructuralSignature(c) }));

    // Find clusters of components with near-identical signatures
    const visited = new Set<number>();
    const findings: RuleFinding[] = [];

    for (let i = 0; i < groups.length; i++) {
      if (visited.has(i)) continue;
      const clusterItems: ComponentGroup[] = [groups[i]!];
      visited.add(i);

      for (let j = i + 1; j < groups.length; j++) {
        if (visited.has(j)) continue;
        const similarity = signatureSimilarity(groups[i]!.signature, groups[j]!.signature);
        if (similarity >= 0.85) {
          clusterItems.push(groups[j]!);
          visited.add(j);
        }
      }

      if (clusterItems.length < 3) continue;

      // Check: all in same file with same component name => intentional, skip
      const files = new Set(clusterItems.map((g) => g.component.file as string));
      const names = new Set(clusterItems.map((g) => (g.component.name as string | undefined) ?? ''));
      if (files.size === 1 && names.size === 1) continue;

      // Count distinct pages/sections
      const locationList: RuleFindingLocation[] = clusterItems.map((g) => ({
        file: g.component.file as string,
        line: g.component.line as number | undefined,
        description: (g.component.name as string | undefined) ?? undefined,
      }));

      const fileCount = files.size;
      const sig = groups[i]!.signature;
      const signatureDisplay = sig.replace(/\|/g, ' > ');

      findings.push({
        ruleId: 'DESIGN-STRUCTURE-002',
        title: 'Uniform Section Repetition',
        severity: 'medium',
        precision: 'medium',
        maturity: 'stable',
        category: 'design-repetition',
        evidence: [
          `${clusterItems.length} sections across ${fileCount} pages share identical composition: ${signatureDisplay}`,
          `Affected: ${locationList.map((l) => `${l.description ?? ''} (${l.file}${l.line ? ':' + String(l.line) : ''})`).join(', ')}`,
        ],
        locations: locationList,
        agentObjective:
          'Differentiate repeated section structures by varying layout, component hierarchy, or content format. Identical structure across pages signals template filling rather than intentional information architecture.',
      });
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// DESIGN-STRUCTURE-003: Content-to-Decoration Ratio
// ---------------------------------------------------------------------------
// For each page-level component (isSection=true), count decorative vs
// functional signals. Fires when a page has >= 4 decorative and <= 1
// functional non-generic element.
// ---------------------------------------------------------------------------

const DECORATIVE_SIGNAL_TYPES = new Set([
  'gradient',
  'radial-orb',
  'blob',
  'glassmorphism',
  'marquee',
  'decorative-blob',
  'orb',
]);

const GENERIC_FUNCTIONAL_HEADINGS_RE = /supercharge|the future|next.gen|ai.powered|transform/i;

export const designStructure003: RegisteredRule = {
  id: 'DESIGN-STRUCTURE-003',
  category: 'design-composition',
  title: 'Content-to-Decoration Ratio',
  severity: 'medium',
  precision: 'medium',
  maturity: 'experimental',

  detect(model: any): RuleFinding[] {
    const components: any[] = Array.isArray(model?.components) ? model.components : [];

    const findings: RuleFinding[] = [];

    for (const comp of components) {
      // Only analyse page-level section components
      if (!comp.isSection) continue;

      const decorativeSignals: any[] = Array.isArray(comp.decorativeSignals)
        ? comp.decorativeSignals
        : [];
      const decorativeCount = decorativeSignals.filter((s: any) =>
        DECORATIVE_SIGNAL_TYPES.has(String(s.type)),
      ).length;

      if (decorativeCount < 4) continue;

      // Count functional signals
      let functionalCount = 0;
      const functionalItems: string[] = [];

      if (Array.isArray(comp.formFields) && comp.formFields.length > 0) {
        functionalCount++;
        functionalItems.push(`${comp.formFields.length} form field(s)`);
      }
      if (Array.isArray(comp.dataTables) && comp.dataTables.length > 0) {
        functionalCount++;
        functionalItems.push(`${comp.dataTables.length} data table(s)`);
      }
      if (Array.isArray(comp.ctaTexts)) {
        const nonGenericCtas = (comp.ctaTexts as string[]).filter(
          (t) => !GENERIC_CTA_TEXTS.some((g) => t.toLowerCase().includes(g)),
        );
        if (nonGenericCtas.length > 0) {
          functionalCount++;
          functionalItems.push(`non-generic CTAs: ${nonGenericCtas.slice(0, 2).join(', ')}`);
        }
      }
      if (typeof comp.headingText === 'string' && comp.headingText.trim().length > 0) {
        if (!GENERIC_FUNCTIONAL_HEADINGS_RE.test(comp.headingText)) {
          functionalCount++;
          functionalItems.push(`specific heading: "${comp.headingText}"`);
        }
      }

      if (functionalCount > 1) continue;

      const decorativeLabels = decorativeSignals
        .filter((s: any) => DECORATIVE_SIGNAL_TYPES.has(String(s.type)))
        .map((s: any) => String(s.type));

      findings.push({
        ruleId: 'DESIGN-STRUCTURE-003',
        title: 'Content-to-Decoration Ratio',
        severity: 'medium',
        precision: 'medium',
        maturity: 'experimental',
        category: 'design-composition',
        evidence: [
          `${decorativeCount} decorative signals: ${decorativeLabels.join(', ')}`,
          `${functionalCount} functional element(s)${functionalItems.length > 0 ? ': ' + functionalItems.join('; ') : ' (none detected)'}`,
          'This section is predominantly decorative with minimal functional content.',
        ],
        locations: [
          {
            file: String(comp.file),
            line: typeof comp.line === 'number' ? comp.line : undefined,
            description: typeof comp.name === 'string' ? comp.name : undefined,
          },
        ],
        agentObjective:
          'Reduce decorative elements in this section and add functional content: form fields, real product data, specific domain information, or interactive states. A section with 4+ decorative elements and no functional content is decoration, not design.',
      });
    }

    return findings;
  },
};
