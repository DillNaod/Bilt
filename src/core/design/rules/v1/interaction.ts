import type { DesignRule, DesignSnapshot, DesignRuleCheckResult } from "../../types.js";
import { getInteractionTotals } from "../../types.js";

export const INTERACTION_RULES: DesignRule[] = [
  // ─── Typography (design-genericity) ─────────────────────────────────────────
  {
    id: "DESIGN-TYPOGRAPHY-001",
    category: "design-genericity",
    severity: "low",
    title: "Unintentional typography default (Inter/Geist without scale)",
    whyItMatters:
      "Relying exclusively on default sans-serif web fonts without intentional hierarchy, scale, or paired monospace/serif fonts produces an anonymous aesthetic.",
    recommendation:
      "Establish an intentional typographic system with proportional leading, distinct font weights, and domain-appropriate font selection.",
    agentAction:
      "Pair body copy with a distinctive heading typeface or establish clear proportional scale variables.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.typography.hasInterGeistWithoutIntent) {
        return [
          {
            matches: true,
            evidence: [
              `Fonts detected: ${snapshot.typography.fontsDetected.join(", ")} without complementary type pairing`,
            ],
          },
        ];
      }
      return [];
    },
  },

  // ─── Interaction Patterns (design-genericity) ──────────────────────────────
  {
    id: "DESIGN-INTERACTION-001",
    category: "design-genericity",
    severity: "medium",
    title: "Excessive hover scale and micro-movement animations",
    whyItMatters:
      "Applying scale-105 transforms and upward floats to every card and button creates a dizzying experience and causes layout jitter on touchscreens.",
    recommendation:
      "Use subtle color or border-intensity transitions for hover feedback rather than spatial displacement.",
    agentAction:
      "Remove hover:scale-105 and hover:-translate-y from static content cards.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const interactions = getInteractionTotals(snapshot);
      const hoverScales = interactions.excessiveScaleHoverCount;
      const hoverMoves = interactions.buttonHoverMoveCount + interactions.cardFloatHoverCount;
      if (hoverScales + hoverMoves >= 4) {
        return [
          {
            matches: true,
            evidence: [
              `${hoverScales} elements using hover:scale-105+`,
              `${hoverMoves} elements moving/translating on hover`,
            ],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-INTERACTION-002",
    category: "design-genericity",
    severity: "low",
    title: "Infinite logo marquee used purely for filler",
    whyItMatters:
      "Continuously scrolling marquee bars often disguise a lack of authentic social proof or meaningful content.",
    recommendation:
      "Display verified integrations or partners in a static, responsive grid with clear documentation links.",
    agentAction:
      "Replace continuous marquee animation with a clean static integration grid.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const interactions = getInteractionTotals(snapshot);
      if (interactions.infiniteMarqueeCount >= 1) {
        return [
          {
            matches: true,
            evidence: [`${interactions.infiniteMarqueeCount} animated infinite marquee ticker(s)`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-INTERACTION-003",
    category: "design-genericity",
    severity: "low",
    title: "Simulated progress bar or artificial counter animation",
    whyItMatters:
      "Hardcoded count-up tickers (e.g. '0 to 10,000 in 2s') or decorative progress bars unlinked to actual backend data degrade user trust.",
    recommendation:
      "Connect metric counters to real application statistics or display static verified numbers.",
    agentAction:
      "Link counters to real telemetry or replace with static verified metrics.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const interactions = getInteractionTotals(snapshot);
      if (interactions.fakeCounterCount > 0 || interactions.fakeProgressBarCount > 0) {
        return [
          {
            matches: true,
            evidence: [
              interactions.fakeCounterCount > 0 ? `${interactions.fakeCounterCount} artificial count-up animation(s)` : "",
              interactions.fakeProgressBarCount > 0 ? `${interactions.fakeProgressBarCount} simulated progress bar(s)` : "",
            ].filter(Boolean),
          },
        ];
      }
      return [];
    },
  },
];
