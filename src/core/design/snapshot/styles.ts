// ─── Design Snapshot: Style Extractor ─────────────────────────────────────────

import type { StyleSnapshot } from "../types.js";
import type { ColorCollector } from "./colors.js";

export function extractStyleSnapshot(
  relPath: string,
  content: string,
  lines: string[],
  colorCollector: ColorCollector,
): StyleSnapshot {
  let gradientCount = 0;
  let harshGradientCount = 0;
  let purpleBlueGradientCount = 0;
  let rainbowGradientCount = 0;
  let gradientTextCount = 0;
  let gradientButtonCount = 0;
  let gradientBorderCount = 0;
  let shadowCount = 0;
  let excessiveShadowCount = 0;
  let blurCount = 0;
  let glassmorphismCount = 0;
  let glowCount = 0;
  let softRadiusCount = 0;
  let extremeRadiusCount = 0;
  let pillButtonCount = 0;
  let noiseTextureCount = 0;
  let dotGridCount = 0;
  let radialOrbCount = 0;
  let decorativeBlobCount = 0;
  let squigglesCount = 0;
  let outlineNoneWithoutFocusVisibleCount = 0;

  for (const lineText of lines) {
    colorCollector.processLine(lineText);

    // Gradients
    if (/bg-gradient-to|linear-gradient/i.test(lineText)) {
      gradientCount++;
      if (
        /from-purple|to-blue|from-indigo|to-purple|from-violet/i.test(
          lineText,
        )
      ) {
        purpleBlueGradientCount++;
      }
      if (
        /from-pink.*via-purple.*to-blue|from-red.*via-green|rainbow/i.test(
          lineText,
        )
      ) {
        rainbowGradientCount++;
      }
      if (
        /from-cyan-400.*to-fuchsia-500|from-[#0-9a-fA-F]{6}.*to-[#0-9a-fA-F]{6}/i.test(
          lineText,
        )
      ) {
        harshGradientCount++;
      }
      if (/bg-clip-text\s+text-transparent/i.test(lineText)) {
        gradientTextCount++;
      }
      if (/<button[^>]*class(?:Name)?="[^"]*bg-gradient/i.test(lineText)) {
        gradientButtonCount++;
      }
      if (/p-\[1px\]\s+bg-gradient/i.test(lineText)) {
        gradientBorderCount++;
      }
    }

    // Shadows & Glow
    if (/shadow-2xl|shadow-xl|box-shadow:\s*0\s+2[0-9]px/i.test(lineText)) {
      shadowCount++;
      excessiveShadowCount++;
    } else if (/shadow-lg|shadow-md/i.test(lineText)) {
      shadowCount++;
    }

    if (/shadow-\[0_0_.*px_rgba|drop-shadow-\[0_0_/i.test(lineText)) {
      glowCount++;
    }

    // Glassmorphism & Blur
    if (/backdrop-blur|backdrop-filter:\s*blur/i.test(lineText)) {
      blurCount++;
      if (/bg-white\/[0-9]+|bg-black\/[0-9]+|bg-opacity/i.test(lineText)) {
        glassmorphismCount++;
      }
    }

    // Radius
    if (
      /rounded-3xl|rounded-\[3[0-9]px\]|rounded-\[4[0-9]px\]/i.test(lineText)
    ) {
      extremeRadiusCount++;
    } else if (/rounded-2xl|rounded-xl/i.test(lineText)) {
      softRadiusCount++;
    }

    if (/<button[^>]*class(?:Name)?="[^"]*rounded-full/i.test(lineText)) {
      pillButtonCount++;
    }

    // Noise & Dot grid & Orbs
    if (/noise|bg-\[url\(['"]?.*noise/i.test(lineText)) {
      noiseTextureCount++;
    }
    if (
      /bg-dot-grid|radial-gradient\(#.*1px,\s*transparent\s+1px\)/i.test(
        lineText,
      )
    ) {
      dotGridCount++;
    }
    if (
      /radial-gradient|bg-\[radial-gradient|blur-3xl.*rounded-full.*bg-purple/i.test(
        lineText,
      )
    ) {
      radialOrbCount++;
      decorativeBlobCount++;
    }
    if (/squiggle|<svg[^>]*class(?:Name)?="[^"]*squiggle/i.test(lineText)) {
      squigglesCount++;
    }

    // Focus styles
    if (
      /outline-none|focus:outline-none/i.test(lineText) &&
      !/focus-visible:|focus:ring|ring-offset/i.test(lineText)
    ) {
      outlineNoneWithoutFocusVisibleCount++;
    }
  }

  return {
    file: relPath,
    gradientCount,
    harshGradientCount,
    purpleBlueGradientCount,
    rainbowGradientCount,
    gradientTextCount,
    gradientButtonCount,
    gradientBorderCount,
    shadowCount,
    excessiveShadowCount,
    blurCount,
    glassmorphismCount,
    glowCount,
    softRadiusCount,
    extremeRadiusCount,
    pillButtonCount,
    noiseTextureCount,
    dotGridCount,
    radialOrbCount,
    decorativeBlobCount,
    squigglesCount,
    hasReducedMotion:
      content.includes("prefers-reduced-motion") ||
      content.includes("motion-reduce:"),
    outlineNoneWithoutFocusVisibleCount,
  };
}
