// ─── Design Snapshot: Component Extractor ────────────────────────────────────

import path from "node:path";
import type { ComponentSnapshot } from "../types.js";

export interface ComponentExtractionResult {
  component: ComponentSnapshot;
  hasDesktopNav: boolean;
  hasMobileNav: boolean;
}

export function extractComponentSnapshot(
  filePath: string,
  relPath: string,
  content: string,
  lines: string[],
  isMarquee: boolean,
): ComponentExtractionResult {
  const isHero = /hero/i.test(relPath) || /<section[^>]*hero/i.test(content);
  const isNavbar = /nav|navbar|header/i.test(relPath) || /<nav/i.test(content);
  const isTestimonial =
    /testimonial/i.test(relPath) || /testimonials/i.test(content);
  const isTerminalMockup =
    /terminal/i.test(relPath) ||
    /rounded-full.*bg-red-500.*bg-yellow-500.*bg-green-500/i.test(content);
  const isBento =
    /bento/i.test(relPath) ||
    (content.includes("col-span-2") && content.includes("row-span-2"));
  const isThreeColumn =
    /grid-cols-3/i.test(content) || /three-column/i.test(content);

  let hasDesktopNav = false;
  let hasMobileNav = false;

  if (isNavbar) {
    hasDesktopNav = true;
    if (/md:hidden|mobile-nav|hamburger|drawer/i.test(content)) {
      hasMobileNav = true;
    }
  }

  // Extract icons
  const iconNames: string[] = [];
  const iconMatches = content.matchAll(
    /<(Sparkles|Sparkle|Wand2|Brain|Zap|Check|ArrowRight|Star|Globe|Shield|Activity|Terminal|Copy)\b/g,
  );
  for (const match of iconMatches) {
    if (match[1]) iconNames.push(match[1]);
  }

  // Check card nesting
  let cardNestingDepth = 0;
  if (content.includes("card") || content.includes("Card")) {
    const cardTags = (
      content.match(
        /<(?:div|article|section)[^>]*(?:class(?:Name)?="[^"]*card|<Card)/gi,
      ) || []
    ).length;
    if (cardTags >= 3) cardNestingDepth = cardTags;
  }

  let componentStartLine = 1;
  if (isHero) {
    const heroIdx = lines.findIndex((l) =>
      /<section[^>]*hero|<header/i.test(l),
    );
    if (heroIdx >= 0) componentStartLine = heroIdx + 1;
  } else if (isTerminalMockup) {
    const termIdx = lines.findIndex((l) =>
      /terminal|rounded-full.*bg-red-500/i.test(l),
    );
    if (termIdx >= 0) componentStartLine = termIdx + 1;
  } else if (isBento) {
    const bentoIdx = lines.findIndex((l) => /col-span-2/i.test(l));
    if (bentoIdx >= 0) componentStartLine = bentoIdx + 1;
  } else if (isTestimonial) {
    const testIdx = lines.findIndex((l) => /testimonial/i.test(l));
    if (testIdx >= 0) componentStartLine = testIdx + 1;
  }

  const component: ComponentSnapshot = {
    name: path.basename(filePath, path.extname(filePath)),
    file: relPath,
    line: componentStartLine,
    tag: "component",
    isCard:
      content.includes("rounded-") &&
      (content.includes("border") || content.includes("shadow")),
    isButton: content.includes("<button"),
    isNavbar,
    isHero,
    isTestimonial,
    isTerminalMockup,
    isBentoGrid: isBento,
    isMarquee,
    isFeatureMatrix: content.includes("feature") && content.includes("grid"),
    isThreeColumnSection: isThreeColumn,
    hasIcon: iconNames.length > 0,
    iconNames,
    hasLoadingState:
      content.includes("loading") || content.includes("Skeleton"),
    hasErrorState: content.includes("error") || content.includes("catch"),
    hasEmptyState: content.includes("empty") || content.includes("no results"),
    hasSuccessState:
      content.includes("success") || content.includes("submitted"),
    hasDisabledState: content.includes("disabled"),
    cardNestingDepth,
    classes: [],
    rawText: content.slice(0, 1000),
  };

  return {
    component,
    hasDesktopNav,
    hasMobileNav,
  };
}
