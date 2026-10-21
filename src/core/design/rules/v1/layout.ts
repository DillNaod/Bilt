import type { DesignRule, DesignSnapshot, DesignRuleCheckResult } from "../../types.js";

export const LAYOUT_RULES: DesignRule[] = [
  {
    id: "DESIGN-LAYOUT-001",
    category: "design-genericity",
    severity: "medium",
    title: "Formulaic three-column feature cards",
    whyItMatters:
      "Repeating identical 3-column card grids for all product features suggests template filling rather than deliberate information architecture tailored to actual product mechanics.",
    recommendation:
      "Consider whether this information needs a card at all. Use hierarchy, whitespace, typography, tables, timelines, lists, or direct interaction when those structures communicate more naturally.",
    agentAction:
      "Refactor uniform 3-card grids into diverse layouts (e.g. side-by-side workflow previews, data tables, or sequential steps).",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const threeColSections = snapshot.components.filter((c) => c.isThreeColumnSection).length;
      if (threeColSections >= 2) {
        return [
          {
            matches: true,
            evidence: [`${threeColSections} distinct sections using uniform 3-column card layouts`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-LAYOUT-002",
    category: "design-genericity",
    severity: "medium",
    title: "Excessive container and card nesting",
    whyItMatters:
      "Nesting cards inside cards inside cards (Page → Section → Card → Nested Card) creates clutter, shrinks readable content space, and signals template composition.",
    recommendation:
      "Flatter visual hierarchy. Remove intermediate container boundaries and use whitespace or subtle dividers instead of enclosing boxes.",
    agentAction:
      "Flatten deeply nested container divs into direct content blocks.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const deeplyNested = snapshot.components.filter((c) => (c.cardNestingDepth || 0) >= 3);
      if (deeplyNested.length > 0) {
        return deeplyNested.map((c) => ({
          matches: true,
          evidence: [`Card nesting depth of ${c.cardNestingDepth} in ${c.file}`],
          file: c.file,
        }));
      }
      return [];
    },
  },

  {
    id: "DESIGN-LAYOUT-003",
    category: "design-genericity",
    severity: "low",
    title: "All buttons styled as identical pill shapes",
    whyItMatters:
      "Applying rounded-full pill styling to every action button without hierarchy flattens semantic priority between primary, secondary, and tertiary controls.",
    recommendation:
      "Differentiate primary calls to action with distinct sizing, subtle rectangular geometry, or contextual positioning.",
    agentAction:
      "Limit pill buttons to badges or filter chips; use purposeful button geometry for core actions.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const pillButtons = snapshot.styles.reduce((s, st) => s + st.pillButtonCount, 0);
      if (pillButtons >= 4) {
        return [
          {
            matches: true,
            evidence: [`${pillButtons} buttons using identical rounded-full pill styling`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-LAYOUT-004",
    category: "design-genericity",
    severity: "low",
    title: "Decorative simulated terminal window mockup",
    whyItMatters:
      "Displaying a simulated macOS terminal window with fake npm install commands as the primary hero image is a pervasive developer-tool cliché that adds no functional understanding.",
    recommendation:
      "Display actual functional code snippets, real API responses, or live interactive playground controls instead of static terminal graphics.",
    agentAction:
      "Replace simulated terminal graphic with interactive code snippet or actual terminal component.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const terminalComponents = snapshot.components.filter((c) => c.isTerminalMockup);
      if (terminalComponents.length > 0) {
        return [
          {
            matches: true,
            evidence: [`Simulated terminal mockup detected in ${terminalComponents.map((c) => c.file).join(", ")}`],
          },
        ];
      }
      return [];
    },
  },
];
