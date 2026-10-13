// ─── Design Hierarchy Rules ──────────────────────────────────────────────────
// Rules that analyze heading levels, visual prominence, CTA weight, and section
// hierarchy across components and pages.
// ─────────────────────────────────────────────────────────────────────────────

import type { RegisteredRule, RuleFinding, RuleFindingLocation } from '../../rule-registry/types.js';
import type { ProjectModel, ComponentModel, HeadingModel } from '../../project-model/types.js';

/**
 * Approximate visual size of Tailwind text size class
 */
function getTextSizeWeight(cls: string): number {
  if (cls.includes('text-9xl')) return 128;
  if (cls.includes('text-8xl')) return 96;
  if (cls.includes('text-7xl')) return 72;
  if (cls.includes('text-6xl')) return 60;
  if (cls.includes('text-5xl')) return 48;
  if (cls.includes('text-4xl')) return 36;
  if (cls.includes('text-3xl')) return 30;
  if (cls.includes('text-2xl')) return 24;
  if (cls.includes('text-xl')) return 20;
  if (cls.includes('text-lg')) return 18;
  if (cls.includes('text-base')) return 16;
  if (cls.includes('text-sm')) return 14;
  if (cls.includes('text-xs')) return 12;
  return 16;
}

// ---------------------------------------------------------------------------
// DESIGN-HIERARCHY-001: Inverted or Broken Heading Hierarchy
// ---------------------------------------------------------------------------
export const designHierarchy001: RegisteredRule = {
  id: 'DESIGN-HIERARCHY-001',
  category: 'design-hierarchy',
  title: 'Inverted or Broken Heading Hierarchy',
  severity: 'medium',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const comp of model.components) {
      if (!comp.headings || comp.headings.length < 2) continue;

      // Check if H1 is visually smaller than secondary headings (H2/H3)
      const h1s = comp.headings.filter((h) => h.level === 1);
      const subHeadings = comp.headings.filter((h) => h.level > 1);

      if (h1s.length > 0 && subHeadings.length > 0) {
        const h1 = h1s[0]!;
        const h1Weight = Math.max(...h1.tailwindClasses.map(getTextSizeWeight), 24);

        for (const sub of subHeadings) {
          const subWeight = Math.max(...sub.tailwindClasses.map(getTextSizeWeight), 16);
          if (subWeight > h1Weight && subWeight - h1Weight >= 8) {
            findings.push({
              ruleId: 'DESIGN-HIERARCHY-001',
              title: 'Inverted Heading Hierarchy: Subheading Visually Dominates H1',
              severity: 'medium',
              precision: 'high',
              maturity: 'stable',
              category: 'design-hierarchy',
              evidence: [
                `H1 "${h1.text}" has visual size equivalent to ~${h1Weight}px`,
                `H${sub.level} "${sub.text}" has visual size equivalent to ~${subWeight}px (${sub.tailwindClasses.join(' ')})`,
                'Lower-level heading visually overpowers the primary page heading',
              ],
              locations: [{ file: comp.file, line: comp.line }],
              agentObjective:
                'Ensure the primary H1 is the most prominent typography element on the page. Scale down secondary headings or increase H1 prominence.',
            });
            break;
          }
        }
      }

      // Check multiple H1s in the same component/page
      if (h1s.length > 1) {
        findings.push({
          ruleId: 'DESIGN-HIERARCHY-001',
          title: 'Multiple Competing H1 Headings in Same View',
          severity: 'low',
          precision: 'high',
          maturity: 'stable',
          category: 'design-hierarchy',
          evidence: [
            `Component contains ${h1s.length} distinct H1 elements:`,
            ...h1s.map((h) => `  - "${h.text}"`),
            'Each page view should have a single primary H1 establishing the main topic.',
          ],
          locations: [{ file: comp.file, line: comp.line }],
          agentObjective:
            'Consolidate to a single H1 per page view and demote subordinate section headings to H2.',
        });
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// DESIGN-HIERARCHY-002: Competing Primary CTAs
// ---------------------------------------------------------------------------
export const designHierarchy002: RegisteredRule = {
  id: 'DESIGN-HIERARCHY-002',
  category: 'design-hierarchy',
  title: 'Multiple Competing Primary CTAs in Single Section',
  severity: 'medium',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const comp of model.components) {
      if (!comp.interactiveElements || comp.interactiveElements.length < 2) continue;

      // Primary buttons typically have strong background colors or prominent text
      const buttons = comp.interactiveElements.filter(
        (el) => el.type === 'button' || el.type === 'link',
      );

      const prominentCtaTexts = buttons
        .map((b) => b.text?.trim() || '')
        .filter((t) =>
          /get started|sign up|buy now|try free|start free|book demo|schedule call|request access/i.test(
            t,
          ),
        );

      if (prominentCtaTexts.length >= 3) {
        findings.push({
          ruleId: 'DESIGN-HIERARCHY-002',
          title: 'Multiple Competing Primary CTAs in Single Section',
          severity: 'medium',
          precision: 'high',
          maturity: 'stable',
          category: 'design-hierarchy',
          evidence: [
            `Found ${prominentCtaTexts.length} competing high-prominence CTAs in component "${comp.name}":`,
            ...prominentCtaTexts.map((t) => `  - "${t}"`),
            'When every action demands primary attention, user decision fatigue increases and conversion drops.',
          ],
          locations: [{ file: comp.file, line: comp.line }],
          agentObjective:
            'Establish visual hierarchy among actions: designate exactly one primary CTA (e.g. filled button) and make alternative paths secondary (e.g. outline or ghost link).',
        });
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// DESIGN-HIERARCHY-003: Identical Visual Weight Across Unrelated Sections
// ---------------------------------------------------------------------------
export const designHierarchy003: RegisteredRule = {
  id: 'DESIGN-HIERARCHY-003',
  category: 'design-hierarchy',
  title: 'Uniform Visual Weight Across Unrelated Sections',
  severity: 'low',
  precision: 'medium',
  maturity: 'experimental',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const sections = model.components.filter((c) => c.isSection);

    if (sections.length >= 4) {
      // Check if all sections use the exact same background and container padding
      const sigs = sections.map((s) => s.structuralSignature).filter(Boolean);
      const uniqueSigs = new Set(sigs);

      if (uniqueSigs.size === 1 && sigs.length >= 4) {
        findings.push({
          ruleId: 'DESIGN-HIERARCHY-003',
          title: 'Monotonous Visual Rhythm Across Page Sections',
          severity: 'low',
          precision: 'medium',
          maturity: 'experimental',
          category: 'design-hierarchy',
          evidence: [
            `${sections.length} page sections share identical structural composition and density (${Array.from(uniqueSigs)[0]})`,
            'Lack of visual cadence or variation makes long pages feel repetitive and hard to scan.',
          ],
          locations: sections.map((s) => ({ file: s.file, line: s.line })),
          agentObjective:
            'Introduce visual cadence between sections by alternating background tone, data density, or column configurations.',
        });
      }
    }

    return findings;
  },
};
