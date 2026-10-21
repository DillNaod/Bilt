import type { DesignRule, DesignSnapshot, DesignRuleCheckResult } from "../../types.js";

export const CONTENT_RULES: DesignRule[] = [
  {
    id: "CONTENT-QUALITY-001",
    category: "content-quality",
    severity: "medium",
    title: "Concentration of generic AI marketing slogans",
    whyItMatters:
      "Headings like 'Supercharge your workflow' or 'The future of productivity' offer zero information about what the software actually does, eroding user trust.",
    recommendation:
      "Replace marketing cliches with concrete descriptions of the product's actual domain, core operations, and supported workflows.",
    agentAction:
      "Rewrite headings to explicitly describe the concrete problem solved and the target user.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.genericSaaSCount >= 2) {
        return [
          {
            matches: true,
            evidence: snapshot.copy.genericPhrasesFound.map((p) => `Generic phrase: "${p}"`),
          },
        ];
      }
      return [];
    },
  },

  {
    id: "CONTENT-QUALITY-002",
    category: "content-quality",
    severity: "low",
    title: "AI adjective stacking ('powerful, seamless, intelligent')",
    whyItMatters:
      "Stringing together buzzwords ('powerful, seamless, and intelligent') is a trademark artifact of LLM text generation that fails to convince discerning users.",
    recommendation:
      "State specific verifiable metrics or technical attributes instead of abstract superlatives.",
    agentAction:
      "Replace adjective lists with clear factual statements describing capabilities.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.adjectiveStackCount >= 2) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.adjectiveStackCount} instances of stacked marketing adjectives detected`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "CONTENT-QUALITY-003",
    category: "content-quality",
    severity: "medium",
    title: "Placeholder or unverified customer testimonials",
    whyItMatters:
      "Stock testimonials featuring generic titles like 'CEO at TechCorp' or 'John D.' damage credibility and indicate placeholder marketing copy.",
    recommendation:
      "Either include verified customer case studies with verifiable details, or replace testimonial sections with real product documentation, community stats, or live metrics.",
    agentAction:
      "Remove placeholder testimonials or replace with verifiable project metrics.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.fakeTestimonialCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.fakeTestimonialCount} placeholder customer testimonials detected`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "CONTENT-QUALITY-004",
    category: "content-quality",
    severity: "low",
    title: "Formulaic 'It's not X, it's Y' contrast copy",
    whyItMatters:
      "Relying on artificial antithesis formulas ('It's not just a tool, it's an ecosystem') is an overused copywriting template that feels derivative.",
    recommendation:
      "Describe the product's actual architecture, capabilities, and workflows in direct, authentic terms.",
    agentAction:
      "Rewrite contrasting copy formulas into direct, informative descriptions.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.itIsNotXItIsYCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.itIsNotXItIsYCount} formulaic 'It's not X, it's Y' phrase(s) detected`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "CONTENT-QUALITY-005",
    category: "content-quality",
    severity: "low",
    title: "Manufactured urgency or exaggerated claims",
    whyItMatters:
      "Phrases like 'Your workflow will never be the same' or 'The only tool you'll ever need' diminish credibility.",
    recommendation:
      "Ground marketing copy in measurable technical advantages and clear product capabilities.",
    agentAction:
      "Remove artificial urgency claims and replace with verifiable product capabilities.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.fakeUrgencyCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.fakeUrgencyCount} manufactured urgency claim(s) detected`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "CONTENT-QUALITY-006",
    category: "content-quality",
    severity: "low",
    title: "Excessive decorative emoji usage in interface copy",
    whyItMatters:
      "Sprinkling emojis (🚀, ✨, 🔥, 💡) across headings and buttons produces an informal, toy-like appearance unsuitable for production software.",
    recommendation:
      "Replace emojis with accessible SVG icons or deliberate typographic emphasis.",
    agentAction:
      "Remove decorative emojis from headings and navigation labels.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.emojiCount >= 6) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.emojiCount} decorative emojis detected across interface copy`],
          },
        ];
      }
      return [];
    },
  },
];
