// ─── Design Snapshot: Copy Collector ──────────────────────────────────────────

import type { CopySnapshot } from "../types.js";
import {
  GENERIC_SAAS_PATTERNS,
  ADJECTIVE_STACK_REGEX,
  IT_IS_NOT_X_REGEX,
  FAKE_URGENCY_REGEX,
  FAKE_TESTIMONIAL_NAME_REGEX,
  FAKE_COMPANY_REGEX,
  EMOJI_REGEX,
} from "../patterns.js";

export class CopyCollector {
  private genericSaaSCount = 0;
  private genericPhrasesFound: string[] = [];
  private copyMatchLocations: Array<{
    file: string;
    line: number;
    phrase: string;
    patternType?: string;
  }> = [];
  private adjectiveStackCount = 0;
  private itIsNotXItIsYCount = 0;
  private fakeTestimonialCount = 0;
  private fakeCompanyCount = 0;
  private fakeUrgencyCount = 0;
  private emDashCount = 0;
  private emojiCount = 0;
  private loremIpsumCount = 0;
  private featureMatrixCardOnlyCount = 0;

  processFile(relPath: string, content: string, lines: string[]): void {
    for (const pattern of GENERIC_SAAS_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        this.genericSaaSCount++;
        this.genericPhrasesFound.push(match[0]);
      }
    }

    if (ADJECTIVE_STACK_REGEX.test(content)) {
      this.adjectiveStackCount++;
    }

    if (IT_IS_NOT_X_REGEX.test(content)) {
      this.itIsNotXItIsYCount++;
    }

    if (FAKE_URGENCY_REGEX.test(content)) {
      this.fakeUrgencyCount++;
    }

    if (FAKE_TESTIMONIAL_NAME_REGEX.test(content)) {
      this.fakeTestimonialCount++;
    }

    if (FAKE_COMPANY_REGEX.test(content)) {
      this.fakeCompanyCount++;
    }

    const emDashes = (content.match(/—|&mdash;/g) || []).length;
    if (emDashes > 3) {
      this.emDashCount += emDashes;
    }

    const emojis = (content.match(new RegExp(EMOJI_REGEX, "gu")) || []).length;
    if (emojis > 0) {
      this.emojiCount += emojis;
    }

    if (/lorem ipsum/i.test(content)) {
      this.loremIpsumCount++;
    }

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      for (const pattern of GENERIC_SAAS_PATTERNS) {
        const match = lineText.match(pattern);
        if (match) {
          this.copyMatchLocations.push({
            file: relPath,
            line: lineNum,
            phrase: match[0],
            patternType: "slogan",
          });
        }
      }
      if (ADJECTIVE_STACK_REGEX.test(lineText)) {
        this.copyMatchLocations.push({
          file: relPath,
          line: lineNum,
          phrase: "adjective stack",
          patternType: "adjective-stack",
        });
      }
      if (IT_IS_NOT_X_REGEX.test(lineText)) {
        this.copyMatchLocations.push({
          file: relPath,
          line: lineNum,
          phrase: "formulaic comparison",
          patternType: "formulaic-claim",
        });
      }
      if (FAKE_TESTIMONIAL_NAME_REGEX.test(lineText)) {
        this.copyMatchLocations.push({
          file: relPath,
          line: lineNum,
          phrase: "fake customer testimonial",
          patternType: "testimonial",
        });
      }
      if (FAKE_COMPANY_REGEX.test(lineText)) {
        this.copyMatchLocations.push({
          file: relPath,
          line: lineNum,
          phrase: "placeholder company name",
          patternType: "company",
        });
      }
      if (/lorem ipsum/i.test(lineText)) {
        this.copyMatchLocations.push({
          file: relPath,
          line: lineNum,
          phrase: "Lorem ipsum",
          patternType: "lorem-ipsum",
        });
      }
    });
  }

  snapshot(): CopySnapshot {
    return {
      genericSaaSCount: this.genericSaaSCount,
      genericPhrasesFound: this.genericPhrasesFound,
      adjectiveStackCount: this.adjectiveStackCount,
      itIsNotXItIsYCount: this.itIsNotXItIsYCount,
      fakeTestimonialCount: this.fakeTestimonialCount,
      fakeCompanyCount: this.fakeCompanyCount,
      fakeUrgencyCount: this.fakeUrgencyCount,
      emDashCount: this.emDashCount,
      emojiCount: this.emojiCount,
      loremIpsumCount: this.loremIpsumCount,
      featureMatrixCardOnlyCount: this.featureMatrixCardOnlyCount,
      matchLocations: this.copyMatchLocations,
    };
  }
}
