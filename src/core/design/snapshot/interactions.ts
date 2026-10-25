// ─── Design Snapshot: Interaction Collector ───────────────────────────────────

import type { InteractionSnapshot } from "../types.js";

export class InteractionCollector {
  private hoverAnimationCount = 0;
  private excessiveScaleHoverCount = 0;
  private buttonHoverMoveCount = 0;
  private cardFloatHoverCount = 0;
  private cursorFollowerCount = 0;
  private scrollAnimationCount = 0;
  private parallaxCount = 0;
  private animatedGradientCount = 0;
  private infiniteMarqueeCount = 0;
  private textRevealCount = 0;
  private fakeTypingCount = 0;
  private fakeCounterCount = 0;
  private fakeProgressBarCount = 0;
  private fakeLiveIndicatorCount = 0;
  private fakeOnlineUsersCount = 0;
  private fakeToastsCount = 0;

  processLine(lineText: string): void {
    if (/hover:scale-105|hover:scale-110/i.test(lineText)) {
      this.hoverAnimationCount++;
      this.excessiveScaleHoverCount++;
    } else if (/hover:scale-/i.test(lineText)) {
      this.hoverAnimationCount++;
    }

    if (/hover:-translate-y-1|hover:-translate-y-2/i.test(lineText)) {
      if (/<button/i.test(lineText)) this.buttonHoverMoveCount++;
      else this.cardFloatHoverCount++;
    }

    if (/cursor-pointer.*follow|custom-cursor|cursor-tracker/i.test(lineText)) {
      this.cursorFollowerCount++;
    }

    if (/whileInView|data-aos|aos-animate|scroll-trigger/i.test(lineText)) {
      this.scrollAnimationCount++;
    }

    if (/parallax|transform-gpu/i.test(lineText) && /scroll/i.test(lineText)) {
      this.parallaxCount++;
    }

    if (/animate-gradient|gradient-shift/i.test(lineText)) {
      this.animatedGradientCount++;
    }

    if (/animate-marquee|<Marquee|marquee/i.test(lineText)) {
      this.infiniteMarqueeCount++;
    }

    if (/typewriter|text-reveal/i.test(lineText)) {
      this.textRevealCount++;
    }

    if (
      /fake-terminal|npm i|curl -s|bash <\(/i.test(lineText) &&
      /bg-black|rounded-lg/i.test(lineText)
    ) {
      this.fakeTypingCount++;
    }

    if (/count-up|data-counter|0 to 10,?000/i.test(lineText)) {
      this.fakeCounterCount++;
    }

    if (
      /<progress|role="progressbar"|w-\[85%\]|w-\[99%\]/i.test(lineText) &&
      /bg-green|bg-blue/i.test(lineText)
    ) {
      this.fakeProgressBarCount++;
    }

    if (
      /animate-ping.*bg-green/i.test(lineText) &&
      /live|online|uptime/i.test(lineText)
    ) {
      this.fakeLiveIndicatorCount++;
    }

    if (
      /[0-9]+\s+(?:people|users)\s+(?:viewing|online)\s+right\s+now/i.test(
        lineText,
      )
    ) {
      this.fakeOnlineUsersCount++;
    }

    if (/just bought|purchased.*seconds ago/i.test(lineText)) {
      this.fakeToastsCount++;
    }
  }

  getMarqueeCount(): number {
    return this.infiniteMarqueeCount;
  }

  snapshot(): InteractionSnapshot {
    return {
      file: "project",
      hoverAnimationCount: this.hoverAnimationCount,
      excessiveScaleHoverCount: this.excessiveScaleHoverCount,
      buttonHoverMoveCount: this.buttonHoverMoveCount,
      cardFloatHoverCount: this.cardFloatHoverCount,
      cursorFollowerCount: this.cursorFollowerCount,
      scrollAnimationCount: this.scrollAnimationCount,
      parallaxCount: this.parallaxCount,
      animatedGradientCount: this.animatedGradientCount,
      infiniteMarqueeCount: this.infiniteMarqueeCount,
      textRevealCount: this.textRevealCount,
      fakeTypingCount: this.fakeTypingCount,
      fakeCounterCount: this.fakeCounterCount,
      fakeProgressBarCount: this.fakeProgressBarCount,
      fakeLiveIndicatorCount: this.fakeLiveIndicatorCount,
      fakeOnlineUsersCount: this.fakeOnlineUsersCount,
      fakeToastsCount: this.fakeToastsCount,
    };
  }
}
