// ─── Design Snapshot: Typography Collector ────────────────────────────────────

import type { TypographySnapshot } from "../types.js";

export class TypographyCollector {
  private allDetectedFonts = new Set<string>();
  private hasInterGeistWithoutIntent = false;
  private heroHeadingSizes: number[] = [];
  private boldTextMatches = 0;
  private uppercaseEyebrowCount = 0;
  private colonHeadingCount = 0;
  private rhetoricalQuestionHeadingCount = 0;

  processFile(content: string, lines: string[]): void {
    if (
      content.includes("font-sans") ||
      content.includes("Inter") ||
      content.includes("Geist") ||
      content.includes("Space Grotesk")
    ) {
      if (content.includes("Inter")) this.allDetectedFonts.add("Inter");
      if (content.includes("Geist")) this.allDetectedFonts.add("Geist");
      if (content.includes("Space Grotesk")) this.allDetectedFonts.add("Space Grotesk");

      if (
        (content.includes("Inter") ||
          content.includes("Geist") ||
          content.includes("Space Grotesk")) &&
        !content.includes("font-serif") &&
        !content.includes("font-mono")
      ) {
        this.hasInterGeistWithoutIntent = true;
      }
    }

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      // Hero heading sizes
      if (
        /text-6xl|text-7xl|text-8xl|text-9xl|font-size:\s*(?:6[4-9]|[7-9]\d|\d{3})px/i.test(
          lineText,
        )
      ) {
        this.heroHeadingSizes.push(lineNum);
      }

      // Bold counts
      if (
        /font-bold|font-extrabold|font-black|font-weight:\s*(?:700|800|900)/i.test(
          lineText,
        )
      ) {
        this.boldTextMatches++;
      }

      // Eyebrow labels
      if (
        /uppercase(?:\s+tracking-w(?:ider|idest))?(?:\s+text-xs|\s+text-sm)?/i.test(
          lineText,
        ) &&
        /eyebrow|<span|<p/i.test(lineText)
      ) {
        this.uppercaseEyebrowCount++;
      }

      // Colon headings
      if (/<h[1-4][^>]*>[^<:]+:\s*[^<]+<\/h[1-4]>/i.test(lineText)) {
        this.colonHeadingCount++;
      }

      // Rhetorical questions
      if (
        /<h[1-4][^>]*>[^<]*\?[^<]*<\/h[1-4]>/i.test(lineText) &&
        /why|how|ready|what/i.test(lineText)
      ) {
        this.rhetoricalQuestionHeadingCount++;
      }
    });
  }

  snapshot(): TypographySnapshot {
    return {
      fontsDetected: Array.from(this.allDetectedFonts),
      hasInterGeistWithoutIntent: this.hasInterGeistWithoutIntent,
      heroHeadingSizes: this.heroHeadingSizes,
      hasExcessiveBold: this.boldTextMatches > 25,
      uppercaseEyebrowCount: this.uppercaseEyebrowCount,
      colonHeadingCount: this.colonHeadingCount,
      rhetoricalQuestionHeadingCount: this.rhetoricalQuestionHeadingCount,
    };
  }
}
