// ─── Design Snapshot: UX State Collector ──────────────────────────────────────

import type { UXStateSnapshot } from "../types.js";

export class UXStateCollector {
  private missingLoadingCount = 0;
  private missingEmptyCount = 0;
  private missingErrorCount = 0;
  private missingSuccessCount = 0;
  private missingDisabledCount = 0;
  private missingFormValidationCount = 0;
  private missingFocusStylesCount = 0;
  private missingA11yIconCount = 0;
  private destructiveWithoutConfirmCount = 0;
  private emptyDashboardCount = 0;
  private deadLinkCtaCount = 0;

  processFile(content: string, lines: string[]): void {
    lines.forEach((lineText) => {
      // Focus styles & a11y
      if (
        /outline-none|focus:outline-none/i.test(lineText) &&
        !/focus-visible:|focus:ring|ring-offset/i.test(lineText)
      ) {
        this.missingFocusStylesCount++;
      }

      // Buttons with dead links
      if (
        /<(?:button|a)[^>]*(?:href="#"|onClick=\{\(\)\s*=>\s*\{\}\})[^>]*>/i.test(
          lineText,
        ) &&
        /get started|sign up|buy now|try free|start free/i.test(lineText)
      ) {
        this.deadLinkCtaCount++;
      }

      // Destructive actions without confirm
      if (
        /<button[^>]*>[^<]*(?:delete|remove|destroy|purge)[^<]*<\/button>/i.test(
          lineText,
        ) &&
        !/confirm|dialog|alert|prompt|modal/i.test(content)
      ) {
        this.destructiveWithoutConfirmCount++;
      }

      // Icon without aria-label
      if (
        /<button[^>]*>(?:\s*<(?:[A-Z][a-zA-Z0-9]*Icon|Sparkles|Check|Arrow|X|Menu|Trash)[^>]*\/>|\s*<svg[^>]*>[\s\S]*?<\/svg>)\s*<\/button>/i.test(
          lineText,
        ) &&
        !/aria-label|aria-labelledby|<span[^>]*class="sr-only"/i.test(lineText)
      ) {
        this.missingA11yIconCount++;
      }
    });
  }

  snapshot(missingMobileNav: boolean): UXStateSnapshot {
    return {
      file: "project",
      missingLoadingCount: this.missingLoadingCount,
      missingEmptyCount: this.missingEmptyCount,
      missingErrorCount: this.missingErrorCount,
      missingSuccessCount: this.missingSuccessCount,
      missingDisabledCount: this.missingDisabledCount,
      missingFormValidationCount: this.missingFormValidationCount,
      missingMobileNav,
      missingFocusStylesCount: this.missingFocusStylesCount,
      missingA11yIconCount: this.missingA11yIconCount,
      destructiveWithoutConfirmCount: this.destructiveWithoutConfirmCount,
      emptyDashboardCount: this.emptyDashboardCount,
      deadLinkCtaCount: this.deadLinkCtaCount,
    };
  }
}
