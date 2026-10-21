import type { DesignRule, DesignSnapshot, DesignRuleCheckResult } from "../../types.js";
import { getInteractionTotals, getUXStateTotals } from "../../types.js";

export const A11Y_RULES: DesignRule[] = [
  {
    id: "A11Y-UI-001",
    category: "accessibility",
    severity: "high",
    title: "Interactive icon button missing accessible name",
    whyItMatters:
      "Buttons containing only an icon or SVG without an aria-label, title, or sr-only text are inaccessible to screen reader users (WCAG 2.1 4.1.2).",
    recommendation:
      "Provide an explicit aria-label describing the button's action (e.g. aria-label=\"Search documents\").",
    agentAction:
      "Add aria-label attributes to all icon-only button elements.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const uxStates = getUXStateTotals(snapshot);
      if (uxStates.missingA11yIconCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${uxStates.missingA11yIconCount} icon-only button(s) lack aria-label or accessible text`],
            fixable: true,
          },
        ];
      }
      return [];
    },
  },

  {
    id: "A11Y-UI-002",
    category: "accessibility",
    severity: "medium",
    title: "Interactive elements suppress outline without focus-visible replacement",
    whyItMatters:
      "Removing default focus outlines (outline-none) without supplying a visible focus indicator prevents keyboard-only users from navigating the page (WCAG 2.1 2.4.7).",
    recommendation:
      "Add focus-visible styling (e.g. focus-visible:ring-2 focus-visible:ring-offset-2) when suppressing default outlines.",
    agentAction:
      "Pair outline-none classes with focus-visible ring utilities.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const uxStates = getUXStateTotals(snapshot);
      if (uxStates.missingFocusStylesCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${uxStates.missingFocusStylesCount} element(s) suppress outline without visible focus indicators`],
            fixable: true,
          },
        ];
      }
      return [];
    },
  },

  {
    id: "A11Y-UI-003",
    category: "accessibility",
    severity: "medium",
    title: "Images missing alt text attribute",
    whyItMatters:
      "Images without alt attributes prevent screen readers from conveying visual information or properly skipping decorative graphics (WCAG 2.1 1.1.1).",
    recommendation:
      "Add descriptive alt text to informative images, or alt=\"\" to purely decorative images.",
    agentAction:
      "Supply alt attributes for all img tags.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const missingAlt = snapshot.assets.flatMap((a) =>
        a.images.filter((img) => img.alt === undefined),
      );
      if (missingAlt.length > 0) {
        return [
          {
            matches: true,
            evidence: [`${missingAlt.length} image(s) missing alt attribute`],
            fixable: true,
          },
        ];
      }
      return [];
    },
  },

  {
    id: "A11Y-UI-004",
    category: "accessibility",
    severity: "low",
    title: "Animations lack reduced-motion preference handling",
    whyItMatters:
      "Continuous or large-scale CSS animations without prefers-reduced-motion queries can trigger vestibular motion disorders.",
    recommendation:
      "Wrap keyframe animations and transitions in motion-reduce: (Tailwind) or @media (prefers-reduced-motion: reduce).",
    agentAction:
      "Add reduced-motion media query guards to page animations.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const hasAnimations = snapshot.styles.some((s) => s.hasReducedMotion === false && s.blurCount > 2);
      const interactions = getInteractionTotals(snapshot);
      if (hasAnimations && interactions.scrollAnimationCount > 2) {
        return [
          {
            matches: true,
            evidence: ["Scroll animations present without prefers-reduced-motion guard"],
          },
        ];
      }
      return [];
    },
  },
];
