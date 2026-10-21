import path from 'node:path';
import type { DesignSystemModel, Location } from '../types.js';
import type { FilePayload } from './types.js';

export function extractDesignSystem(payloads: FilePayload[]): DesignSystemModel {
  const radii = new Map<string, { count: number; locations: Location[] }>();
  const spacing = new Map<string, { count: number; locations: Location[] }>();
  const colors = new Map<string, { count: number; locations: Location[] }>();
  const fontSizes = new Map<string, { count: number; locations: Location[] }>();
  const fontWeights = new Map<string, { count: number; locations: Location[] }>();
  const shadows = new Map<string, { count: number; locations: Location[] }>();
  const detectedFonts = new Set<string>();
  let hasDesignTokenFile = false;

  function increment(
    map: Map<string, { count: number; locations: Location[] }>,
    key: string,
    loc: Location,
  ): void {
    const entry = map.get(key);
    if (entry) {
      entry.count++;
      if (entry.locations.length < 10) entry.locations.push(loc);
    } else {
      map.set(key, { count: 1, locations: [loc] });
    }
  }

  for (const f of payloads) {
    const rel = f.relPath;
    const ext = path.extname(rel).toLowerCase();

    // Detect design token files
    if (
      rel.includes('tailwind.config') ||
      rel.includes('tokens.css') ||
      rel.includes('design-tokens') ||
      rel.includes('theme.ts') ||
      rel.includes('theme.js')
    ) {
      hasDesignTokenFile = true;
    }

    if (!['.tsx', '.ts', '.jsx', '.js', '.css', '.scss'].includes(ext)) continue;

    const lines = f.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNum = i + 1;
      const loc: Location = { file: rel, line: lineNum };

      // Tailwind radius classes
      const radiusMatches = line.match(/\brounded(?:-(?:sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?\b/g);
      if (radiusMatches) {
        for (const r of radiusMatches) increment(radii, r, loc);
      }

      // Tailwind spacing
      const spacingMatches = line.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-(?:\d+|\[[^\]]+\])\b/g);
      if (spacingMatches) {
        for (const s of spacingMatches) increment(spacing, s, loc);
      }

      // Tailwind colors: bg-X-Y, text-X-Y, border-X-Y
      const colorMatches = line.match(/\b(?:bg|text|border|ring|fill|stroke)-(?:[a-z]+-(?:\d{2,3}|50|950)|(?:white|black|transparent|current))\b/g);
      if (colorMatches) {
        for (const c of colorMatches) increment(colors, c, loc);
      }
      // Hex colors
      const hexMatches = line.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hexMatches) {
        for (const h of hexMatches) increment(colors, h.toLowerCase(), loc);
      }

      // Font sizes
      const fontSizeMatches = line.match(/\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[[^\]]+\])\b/g);
      if (fontSizeMatches) {
        for (const fs of fontSizeMatches) increment(fontSizes, fs, loc);
      }

      // Font weights
      const fontWeightMatches = line.match(/\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g);
      if (fontWeightMatches) {
        for (const fw of fontWeightMatches) increment(fontWeights, fw, loc);
      }

      // Shadows
      const shadowMatches = line.match(/\bshadow-(?:sm|md|lg|xl|2xl|inner|none|\[[^\]]+\])\b/g);
      if (shadowMatches) {
        for (const s of shadowMatches) increment(shadows, s, loc);
      }

      // Font detection
      if (/\bInter\b/.test(line)) detectedFonts.add('Inter');
      if (/\bGeist\b/.test(line)) detectedFonts.add('Geist');
      if (/Space Grotesk/.test(line)) detectedFonts.add('Space Grotesk');
      if (/\bRoboto\b/.test(line)) detectedFonts.add('Roboto');
      if (/\bPoppins\b/.test(line)) detectedFonts.add('Poppins');
      if (/\bMontserrat\b/.test(line)) detectedFonts.add('Montserrat');
      if (/\bPlusJakarta/i.test(line)) detectedFonts.add('Plus Jakarta Sans');
    }
  }

  return {
    radii,
    spacing,
    colors,
    fontSizes,
    fontWeights,
    shadows,
    colorCount: colors.size,
    uniqueRadiusCount: radii.size,
    uniqueSpacingCount: spacing.size,
    hasDesignTokenFile,
    detectedFonts: Array.from(detectedFonts),
  };
}
