// ─── Design Snapshot: Color Collector ─────────────────────────────────────────

import type { ColorSnapshot } from "../types.js";

export class ColorCollector {
  private detectedPrimaryColors = new Set<string>();
  private isPurpleBlackAesthetic = false;
  private hasNeonColors = false;
  private hasGenericPastelPalette = false;
  private pureWhiteBgCount = 0;
  private multiAccentCount = 0;
  private lowContrastCount = 0;

  processLine(lineText: string): void {
    // Purple + Black aesthetic detection
    if (
      (lineText.includes("#09090b") ||
        lineText.includes("bg-black") ||
        lineText.includes("bg-zinc-950") ||
        lineText.includes("bg-neutral-950")) &&
      (lineText.includes("purple") || lineText.includes("violet"))
    ) {
      this.isPurpleBlackAesthetic = true;
    }

    // Neon colors
    if (
      /#00ff[0-9a-f]{2}|#ff00ff|#00ffff|bg-neon-|text-neon-/i.test(lineText)
    ) {
      this.hasNeonColors = true;
    }

    // Pastel colors
    if (
      /bg-purple-100.*bg-blue-100.*bg-pink-100|#f3e8ff.*#e0e7ff/i.test(
        lineText,
      )
    ) {
      this.hasGenericPastelPalette = true;
    }

    // Pure white background
    if (
      /bg-white|#ffffff|rgb\(255,\s*255,\s*255\)/i.test(lineText) &&
      /<(?:body|main|section|div class="min-h-screen")/i.test(lineText)
    ) {
      this.pureWhiteBgCount++;
    }
  }

  snapshot(): ColorSnapshot {
    return {
      primaryColors: Array.from(this.detectedPrimaryColors),
      isPurpleBlackAesthetic: this.isPurpleBlackAesthetic,
      hasNeonColors: this.hasNeonColors,
      hasGenericPastelPalette: this.hasGenericPastelPalette,
      pureWhiteBgCount: this.pureWhiteBgCount,
      multiAccentCount: this.multiAccentCount,
      lowContrastCount: this.lowContrastCount,
    };
  }
}
