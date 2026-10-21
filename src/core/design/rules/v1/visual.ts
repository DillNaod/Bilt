import type { DesignRule, DesignSnapshot, DesignRuleCheckResult } from "../../types.js";

export const VISUAL_RULES: DesignRule[] = [
  {
    id: "DESIGN-VISUAL-001",
    category: "design-genericity",
    severity: "medium",
    title: "Excessive gradient saturation across headings and buttons",
    whyItMatters:
      "Widespread use of multi-stop or clip-text gradients across headings, buttons, and borders diminishes visual hierarchy and looks like a generic landing page template.",
    recommendation:
      "Reserve gradients for subtle accentuation, or use solid semantic colors aligned with the product's primary visual identity.",
    agentAction:
      "Replace text-clip and button gradients with solid high-contrast brand colors.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const gradTexts = snapshot.styles.reduce((s, st) => s + st.gradientTextCount, 0);
      const gradBtns = snapshot.styles.reduce((s, st) => s + st.gradientButtonCount, 0);
      const gradBorders = snapshot.styles.reduce((s, st) => s + st.gradientBorderCount, 0);

      if (gradTexts + gradBtns + gradBorders >= 3) {
        return [
          {
            matches: true,
            evidence: [
              `${gradTexts} gradient text headings`,
              `${gradBtns} gradient CTA buttons`,
              `${gradBorders} gradient borders`,
            ],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-002",
    category: "design-genericity",
    severity: "low",
    title: "Default purple-on-dark SaaS aesthetic",
    whyItMatters:
      "The combination of near-black backgrounds (#09090b) with purple/violet (#8b5cf6) glows and accents has become the default aesthetic of AI-generated web apps.",
    recommendation:
      "Choose a color palette derived from your product's specific problem space (e.g. data-dense slate, warm editorial ochre, industrial amber, or clean corporate indigo).",
    agentAction:
      "Explore non-default accent tones that uniquely signify the product's domain rather than template defaults.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.colors.isPurpleBlackAesthetic) {
        return [
          {
            matches: true,
            evidence: ["Dark background paired with purple/violet accent glow"],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-003",
    category: "design-genericity",
    severity: "medium",
    title: "Excessive glassmorphism and backdrop-blur nesting",
    whyItMatters:
      "Translucent frosted glass cards placed on top of other frosted glass layers cause legibility issues and performance penalties on low-powered mobile devices.",
    recommendation:
      "Use solid surface colors with subtle borders or gentle tonal shifts rather than heavy backdrop-blur filters.",
    agentAction:
      "Replace nested backdrop-blur cards with solid background surfaces.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const glassCount = snapshot.styles.reduce((s, st) => s + st.glassmorphismCount, 0);
      if (glassCount >= 3) {
        return [
          {
            matches: true,
            evidence: [`${glassCount} glassmorphism elements with backdrop-blur and translucent backgrounds`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-004",
    category: "design-genericity",
    severity: "low",
    title: "Extreme corner radius on all containers",
    whyItMatters:
      "Applying extreme rounded corners (rounded-3xl or rounded-full) to every card, modal, and container produces a puffy, toy-like appearance unsuitable for professional tools.",
    recommendation:
      "Calibrate border radius purposefully. Standard enterprise interfaces typically use 6px to 12px (rounded-md to rounded-lg) for crisp container definition.",
    agentAction:
      "Reduce container border radii from rounded-3xl/full to standard rounded-lg or rounded-xl.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const extremeRadius = snapshot.styles.reduce((s, st) => s + st.extremeRadiusCount, 0);
      if (extremeRadius >= 4) {
        return [
          {
            matches: true,
            evidence: [`${extremeRadius} containers configured with extreme rounded-3xl or 30px+ radii`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-005",
    category: "design-genericity",
    severity: "medium",
    title: "Generic AI sparkle and wand icon decorations",
    whyItMatters:
      "Sprinkling Sparkles, Wand, and Brain icons across non-AI product capabilities has become an AI template trope that conveys little practical meaning to users.",
    recommendation:
      "Reserve icons for actions or entities where visual symbols assist navigation. Replace decorative sparkles with meaningful domain iconography or concise text.",
    agentAction:
      "Remove gratuitous sparkle and wand icons from feature headlines and list items.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const sparkleIcons = snapshot.components.flatMap((c) =>
        c.iconNames.filter((name) => /Sparkle|Wand|Brain/i.test(name)),
      );
      if (sparkleIcons.length >= 2) {
        return [
          {
            matches: true,
            evidence: [`${sparkleIcons.length} decorative sparkle/wand icons detected (${sparkleIcons.join(", ")})`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-006",
    category: "design-genericity",
    severity: "low",
    title: "Dot-grid and background noise texture overuse",
    whyItMatters:
      "Synthetic dot-grid patterns and SVG noise textures are ubiquitous in AI demo templates and frequently conflict with text contrast and content clarity.",
    recommendation:
      "Use clean background fields or structural borders to frame content. If subtle texture is required, restrict it to specialized header or footer areas.",
    agentAction:
      "Remove repetitive dot-grid and noise overlays from primary reading areas.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const dotGrids = snapshot.styles.reduce((s, st) => s + st.dotGridCount, 0);
      const noises = snapshot.styles.reduce((s, st) => s + st.noiseTextureCount, 0);
      if (dotGrids + noises >= 2) {
        return [
          {
            matches: true,
            evidence: [
              dotGrids > 0 ? `${dotGrids} dot-grid backgrounds` : "",
              noises > 0 ? `${noises} noise texture overlays` : "",
            ].filter(Boolean),
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-007",
    category: "design-genericity",
    severity: "low",
    title: "Unconstrained neon or pastel color accents",
    whyItMatters:
      "Employing uncalibrated high-saturation neon accents (#00ffxx, #ff00ff) or generic pastel grids purely because they look futuristic reduces contrast and visual authority.",
    recommendation:
      "Anchor accent colors to domain semantics (e.g. status tokens, data categories) with calibrated contrast ratios.",
    agentAction:
      "Replace arbitrary neon highlights with deliberate accessible brand accents.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.colors.hasNeonColors || snapshot.colors.hasGenericPastelPalette) {
        return [
          {
            matches: true,
            evidence: [
              snapshot.colors.hasNeonColors ? "High-saturation neon colors detected" : "",
              snapshot.colors.hasGenericPastelPalette ? "Generic multi-pastel palette detected" : "",
            ].filter(Boolean),
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-008",
    category: "design-genericity",
    severity: "low",
    title: "Pure unmodulated white backgrounds without structural hierarchy",
    whyItMatters:
      "Using pure #ffffff backgrounds across every container without subtle borders, surface cards, or elevation produces an unfinished, unmodulated interface.",
    recommendation:
      "Introduce subtle neutral surface tones (e.g., slate-50, zinc-50) and light structural border lines to frame content areas.",
    agentAction:
      "Add surface backgrounds or crisp boundary borders to separate content sections.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.colors.pureWhiteBgCount >= 4) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.colors.pureWhiteBgCount} container sections using pure unmodulated white backgrounds`],
          },
        ];
      }
      return [];
    },
  },
];
