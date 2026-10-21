import type { DesignRule, DesignSnapshot, DesignRuleCheckResult } from "../../types.js";
import { getInteractionTotals } from "../../types.js";

export const COMBINATION_RULES: DesignRule[] = [
  {
    id: "GENERIC-SAAS-COMBINATION-001",
    category: "design-genericity",
    severity: "high",
    title: "High concentration of recognizable SaaS template patterns",
    whyItMatters:
      "Individually, rounded cards, gradients, or sparkle icons are normal design elements. However, stacking them together creates an unmistakably generic, interchangeable template look commonly associated with AI vibecoding.",
    recommendation:
      "Replace at least two decorative template patterns with product-specific visual elements: real product screenshots, domain diagrams, or authentic user workflow states.",
    agentAction:
      "Audit the hero and feature sections. Replace generic decorative gradients and radial orbs with authentic product UI previews or domain-specific data representations.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const evidence: string[] = [];
      const totalCards = snapshot.components.filter((c) => c.isCard).length;
      const totalGradients = snapshot.styles.reduce((sum, s) => sum + s.gradientCount, 0);
      const totalRadialOrbs = snapshot.styles.reduce((sum, s) => sum + s.radialOrbCount, 0);
      const totalSparkles = snapshot.components.reduce(
        (sum, c) => sum + c.iconNames.filter((i) => i.includes("Sparkle") || i.includes("Wand")).length,
        0,
      );
      const hasThreeColumn = snapshot.components.some((c) => c.isThreeColumnSection);
      const hasGenericCopy = snapshot.copy.genericSaaSCount > 0;
      const isPurpleBlack = snapshot.colors.isPurpleBlackAesthetic;
      const hasBento = snapshot.components.some((c) => c.isBentoGrid);

      if (totalCards >= 3) evidence.push(`${totalCards} rounded container cards`);
      if (totalGradients >= 2) evidence.push(`${totalGradients} decorative gradients`);
      if (totalRadialOrbs >= 1) evidence.push(`${totalRadialOrbs} radial background orbs`);
      if (totalSparkles >= 1) evidence.push(`${totalSparkles} generic sparkle/AI icons`);
      if (hasThreeColumn) evidence.push("repetitive three-column feature cards");
      if (hasGenericCopy) evidence.push(`generic marketing copy (${snapshot.copy.genericPhrasesFound.slice(0, 2).join(", ")})`);
      if (isPurpleBlack) evidence.push("purple-on-black default SaaS color scheme");
      if (hasBento) evidence.push("bento grid composition");

      // Triggers when 4 or more recognizable patterns co-occur
      if (evidence.length >= 4) {
        return [{ matches: true, evidence }];
      }
      return [];
    },
  },

  {
    id: "VIBECODED-LANDING-PAGE-001",
    category: "design-genericity",
    severity: "medium",
    title: "Template-heavy landing page composition",
    whyItMatters:
      "Landing pages following the formulaic 'Eyebrow → Giant Heading → 2 CTA Pill Buttons → 3 Feature Cards → Fake Testimonial' lack distinctive brand identity and make the product appear artificial.",
    recommendation:
      "Restructure the landing page to feature the actual product workflow immediately. Anchor the value proposition in concrete product mechanics rather than generic marketing slogans.",
    agentAction:
      "Introduce real product interaction states or interactive previews directly into the hero section.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const evidence: string[] = [];
      const interactions = getInteractionTotals(snapshot);
      if (snapshot.typography.heroHeadingSizes.length > 0) evidence.push("giant 64px+ hero heading");
      if (snapshot.typography.uppercaseEyebrowCount >= 2) evidence.push(`${snapshot.typography.uppercaseEyebrowCount} uppercase eyebrow labels`);
      if (snapshot.copy.fakeTestimonialCount > 0) evidence.push("unverified testimonial placeholders");
      if (interactions.fakeTypingCount > 0) evidence.push("decorative simulated terminal window");
      if (snapshot.copy.genericSaaSCount >= 2) evidence.push("formulaic slogan headings");

      if (evidence.length >= 3) {
        return [{ matches: true, evidence }];
      }
      return [];
    },
  },

  {
    id: "DECORATION-OVERLOAD-001",
    category: "design-genericity",
    severity: "medium",
    title: "Excessive decorative visual elements without functional purpose",
    whyItMatters:
      "Stacking decorative blobs, floating cards, squiggles, and glowing borders creates visual noise that distracts users from the product's actual purpose.",
    recommendation:
      "Remove non-functional decorative artifacts. Rely on deliberate typographic hierarchy, proportional whitespace, and functional contrast to structure the page.",
    agentAction:
      "Eliminate background blobs, floating decorative cards, and glow effects that do not represent interactive states.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const totalBlobs = snapshot.styles.reduce((sum, s) => sum + s.decorativeBlobCount, 0);
      const totalGlow = snapshot.styles.reduce((sum, s) => sum + s.glowCount, 0);
      const totalSquiggles = snapshot.styles.reduce((sum, s) => sum + s.squigglesCount, 0);
      const interactions = getInteractionTotals(snapshot);
      const totalFloatCards = interactions.cardFloatHoverCount;

      const evidence: string[] = [];
      if (totalBlobs >= 2) evidence.push(`${totalBlobs} blurred decorative background blobs`);
      if (totalGlow >= 2) evidence.push(`${totalGlow} artificial glow drop-shadows`);
      if (totalSquiggles >= 1) evidence.push(`${totalSquiggles} decorative squiggles/lines`);
      if (totalFloatCards >= 2) evidence.push(`${totalFloatCards} floating hover elements`);

      if (evidence.length >= 2) {
        return [{ matches: true, evidence }];
      }
      return [];
    },
  },
];
