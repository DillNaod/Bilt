// ─── Design Brief Alignment Rules ─────────────────────────────────────────────
// Validates that the implementation aligns with the developer's Design Brief.
// Detects high-level mismatches between human intent and coded structure.
// ─────────────────────────────────────────────────────────────────────────────

import type { RegisteredRule, RuleFinding } from '../../rule-registry/types.js';
import type { ProjectModel } from '../../project-model/types.js';

// ---------------------------------------------------------------------------
// DESIGN-BRIEF-010: Structural Mismatch With Stated Direction (Minimal vs Cluttered)
// ---------------------------------------------------------------------------
export const designBrief010: RegisteredRule = {
  id: 'DESIGN-BRIEF-010',
  category: 'design-brief',
  title: 'Stated Minimal Direction Contradicted by High Decorative Density',
  severity: 'low',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const brief = model.designBrief;
    if (!brief) return [];

    const directions = brief.visualDirection?.value || [];
    const isMinimalIntent = Array.isArray(directions) && directions.some((d) => /minimal/i.test(d));

    if (!isMinimalIntent) return [];

    // Check decorative density
    let totalOrbs = 0;
    let totalBento = 0;
    let totalGradients = 0;

    for (const comp of model.components) {
      if (Array.isArray(comp.decorativeSignals)) {
        for (const s of comp.decorativeSignals) {
          if (s.type === 'radial-orb') totalOrbs++;
          if (s.type === 'bento-grid') totalBento++;
          if (s.type === 'gradient') totalGradients++;
        }
      }
    }

    if (totalOrbs >= 2 || totalBento >= 2 || totalGradients >= 4) {
      return [
        {
          ruleId: 'DESIGN-BRIEF-010',
          title: 'Design Brief Specifies "Minimal" Direction, But Implementation Has High Decorative Density',
          severity: 'low',
          precision: 'high',
          maturity: 'stable',
          category: 'design-brief',
          evidence: [
            `Design Brief visual direction: "${directions.join(', ')}"`,
            `Found heavy decorative styling contradicting minimal intent:`,
            `  - ${totalOrbs} radial glow orbs`,
            `  - ${totalBento} bento grid layouts`,
            `  - ${totalGradients} gradient styled elements`,
            'A minimal interface requires restrained typography and whitespace rather than stacked decorative textures.',
          ],
          locations: model.components.slice(0, 3).map((c) => ({ file: c.file, line: c.line })),
          agentObjective:
            'Strip out extraneous decorative orbs and background gradients to honor the user\'s "minimal" brief.',
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// DESIGN-BRIEF-011: Editorial / Cinematic Intent vs Generic SaaS Layout
// ---------------------------------------------------------------------------
export const designBrief011: RegisteredRule = {
  id: 'DESIGN-BRIEF-011',
  category: 'design-brief',
  title: 'Editorial / Warm Intent Contradicted by Template SaaS Composition',
  severity: 'low',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const brief = model.designBrief;
    if (!brief) return [];

    const directions = brief.visualDirection?.value || [];
    const isEditorialWarm =
      Array.isArray(directions) &&
      directions.some((d) => /editorial|warm|cinematic|analog|human/i.test(d));

    if (!isEditorialWarm) return [];

    // Check if the page uses template SaaS elements
    const hasThreeCol = model.components.some((c) =>
      c.decorativeSignals?.some((s) => s.type === 'three-column'),
    );
    const hasEyebrow = model.components.some((c) =>
      c.decorativeSignals?.some((s) => s.type === 'hero-eyebrow'),
    );
    const hasGenericCta = model.components.some((c) =>
      c.ctaTexts?.some((t) => /get started|try free|start free/i.test(t)),
    );

    if (hasThreeCol && hasEyebrow && hasGenericCta) {
      return [
        {
          ruleId: 'DESIGN-BRIEF-011',
          title: 'Editorial/Warm Brief Intent Contradicted by Generic Tech SaaS Pattern',
          severity: 'low',
          precision: 'high',
          maturity: 'stable',
          category: 'design-brief',
          evidence: [
            `Design Brief requests an editorial / warm aesthetic: "${directions.join(', ')}"`,
            'However, layout defaults to standard tech SaaS template markers:',
            '  - Uppercase hero eyebrow tag',
            '  - Three-column feature grid with icon circles',
            '  - Generic "Get Started" call to action',
            'Editorial layouts prioritize content narrative, typographic scale, and editorial asymmetry over repetitive SaaS feature cards.',
          ],
          locations: model.components.slice(0, 3).map((c) => ({ file: c.file, line: c.line })),
          agentObjective:
            'Restructure the layout into an editorial narrative: use magazine-style typographic hierarchy and article layouts rather than standard 3-card SaaS grids.',
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// DESIGN-BRIEF-012: Brand Color Absence
// ---------------------------------------------------------------------------
export const designBrief012: RegisteredRule = {
  id: 'DESIGN-BRIEF-012',
  category: 'design-brief',
  title: 'Required Brand Color Missing from Design System Tokens',
  severity: 'low',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const brief = model.designBrief;
    if (!brief) return [];

    const brandColors = brief.brandColors?.value;
    if (!Array.isArray(brandColors) || brandColors.length === 0) return [];

    const detectedColors = model.designSystem?.colors;
    if (!detectedColors || detectedColors.size === 0) return [];

    const missingColors: string[] = [];

    for (const color of brandColors) {
      const clean = color.toLowerCase().replace('#', '');
      let found = false;

      for (const [token] of detectedColors.entries()) {
        if (token.toLowerCase().includes(clean)) {
          found = true;
          break;
        }
      }

      if (!found) {
        missingColors.push(color);
      }
    }

    if (missingColors.length > 0) {
      return [
        {
          ruleId: 'DESIGN-BRIEF-012',
          title: 'Design Brief Brand Colors Missing from Implementation',
          severity: 'low',
          precision: 'high',
          maturity: 'stable',
          category: 'design-brief',
          evidence: [
            `Required brand colors specified in brief: ${brandColors.join(', ')}`,
            `Colors not found in extracted design tokens: ${missingColors.join(', ')}`,
            'Ensure the product primary accent tokens reflect the client\'s explicit brand identity.',
          ],
          locations: [],
          agentObjective: `Incorporate brand colors (${missingColors.join(', ')}) into primary actions and layout tokens.`,
        },
      ];
    }

    return [];
  },
};
