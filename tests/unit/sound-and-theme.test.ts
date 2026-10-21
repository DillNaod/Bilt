import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { playSound } from "../../src/ui/sound.js";
import {
  setPlainMode,
  isPlainMode,
  initColorSupport,
  colors,
  glyphs,
  severityGlyph,
  styledGlyph,
  pulseBar,
  sectionHeader,
  ruleLine,
  divider,
  summaryBox,
  truncatePath,
  stripAnsi,
  Spinner,
  text,
} from "../../src/ui/theme.js";

describe("Theme and Sound UI utilities", () => {
  const originalNoColor = process.env.NO_COLOR;
  const originalTerm = process.env.TERM;

  beforeEach(() => {
    setPlainMode(false);
    delete process.env.NO_COLOR;
    process.env.TERM = "xterm-256color";
  });

  afterEach(() => {
    setPlainMode(false);
    if (originalNoColor !== undefined) {
      process.env.NO_COLOR = originalNoColor;
    } else {
      delete process.env.NO_COLOR;
    }
    if (originalTerm !== undefined) {
      process.env.TERM = originalTerm;
    } else {
      delete process.env.TERM;
    }
  });

  describe("playSound", () => {
    it("should write terminal bell in normal mode", () => {
      const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      setPlainMode(false);
      delete process.env.NO_COLOR;

      playSound();

      expect(writeSpy).toHaveBeenCalledWith("\x07");
      writeSpy.mockRestore();
    });

    it("should suppress terminal bell when in plain mode", () => {
      const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      setPlainMode(true);

      playSound();

      expect(writeSpy).not.toHaveBeenCalled();
      writeSpy.mockRestore();
    });

    it("should suppress terminal bell when NO_COLOR is set", () => {
      const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      setPlainMode(false);
      process.env.NO_COLOR = "1";

      playSound();

      expect(writeSpy).not.toHaveBeenCalled();
      writeSpy.mockRestore();
    });
  });

  describe("Theme and Plain Mode", () => {
    it("manages plainMode flag", () => {
      expect(isPlainMode()).toBe(false);
      setPlainMode(true);
      expect(isPlainMode()).toBe(true);
      setPlainMode(false);
      expect(isPlainMode()).toBe(false);
    });

    it("respects initColorSupport options", () => {
      initColorSupport(true);
      initColorSupport(false);
      process.env.TERM = "dumb";
      initColorSupport();
    });

    it("renders severityGlyph and styledGlyph accurately", () => {
      expect(severityGlyph("critical")).toBe(glyphs.critical);
      expect(severityGlyph("warning")).toBe(glyphs.warning);
      expect(severityGlyph("info")).toBe(glyphs.info);

      setPlainMode(true);
      expect(styledGlyph("critical")).toBe(glyphs.critical);
      expect(styledGlyph("warning")).toBe(glyphs.warning);
      expect(styledGlyph("info")).toBe(glyphs.info);

      setPlainMode(false);
      expect(stripAnsi(styledGlyph("critical"))).toBe(glyphs.critical);
      expect(stripAnsi(styledGlyph("warning"))).toBe(glyphs.warning);
      expect(stripAnsi(styledGlyph("info"))).toBe(glyphs.info);
    });

    it("renders pulseBar across critical, warning, and mint ranges", () => {
      setPlainMode(true);
      const plainBar = pulseBar(85);
      expect(plainBar).toContain("Health");
      expect(plainBar).toContain("85/100");

      setPlainMode(false);
      const lowBar = stripAnsi(pulseBar(30));
      expect(lowBar).toContain("Health");
      expect(lowBar).toContain("30/100");

      const midBar = stripAnsi(pulseBar(65));
      expect(midBar).toContain("65/100");

      const highBar = stripAnsi(pulseBar(95));
      expect(highBar).toContain("95/100");
    });

    it("renders sectionHeader, ruleLine, and divider", () => {
      setPlainMode(true);
      expect(sectionHeader("Security")).toBe("\nSecurity");
      expect(ruleLine("test line")).toBe("  test line");
      expect(divider(10)).toBe("----------");

      setPlainMode(false);
      expect(stripAnsi(sectionHeader("Security"))).toContain("Security");
      expect(stripAnsi(ruleLine("test line"))).toContain("test line");
      expect(stripAnsi(divider(10))).toContain(glyphs.divider.repeat(10));
    });

    it("renders summaryBox in plain and styled modes", () => {
      const lines = ["Line 1", "Line 2 is longer"];
      setPlainMode(true);
      expect(summaryBox(lines)).toBe("Line 1\nLine 2 is longer");

      setPlainMode(false);
      const boxed = stripAnsi(summaryBox(lines));
      expect(boxed).toContain("Line 1");
      expect(boxed).toContain("Line 2 is longer");
    });

    it("truncates paths properly", () => {
      expect(truncatePath("short/path.ts", 30)).toBe("short/path.ts");
      const long = "very/long/nested/directory/structure/and/file/name.ts";
      const truncated = truncatePath(long, 20);
      expect(truncated.startsWith("\u2026/")).toBe(true);
      expect(truncated.length).toBeLessThanOrEqual(20);
    });

    it("renders colors and text helpers", () => {
      expect(colors.voidInk.hex).toBe("#0D1117");
      expect(colors.vitalTeal.apply("test")).toBeDefined();
      expect(colors.vitalTeal.bold("test")).toBeDefined();
      expect(colors.vitalTeal.dim("test")).toBeDefined();
      expect(text.bold("hello")).toBeDefined();
      expect(text.dim("hello")).toBeDefined();
    });
  });

  describe("Spinner", () => {
    it("handles plain mode start and stop without intervals", () => {
      const writeSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      setPlainMode(true);
      const spinner = new Spinner("Analyzing");
      expect(spinner.text).toBe("Analyzing");
      spinner.text = "Checking";
      expect(spinner.text).toBe("Checking");

      spinner.start();
      expect(writeSpy).toHaveBeenCalledWith("Checking\n");

      spinner.stop();
      writeSpy.mockRestore();
    });

    it("handles interactive start, stop, and fail", () => {
      const writeSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      setPlainMode(false);

      const spinner = new Spinner("Running");
      spinner.start();
      spinner.stop();

      const spinnerFail = new Spinner("Failing");
      spinnerFail.start();
      spinnerFail.fail("Execution broke");

      expect(errorSpy).toHaveBeenCalled();
      writeSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
