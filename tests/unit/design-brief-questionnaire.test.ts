import { describe, it, expect, vi } from "vitest";
import readline from "node:readline";
import { parseColorInput, runDesignBriefQuestionnaire } from "../../src/core/design/brief/questionnaire.js";

describe("Design Brief Questionnaire", () => {
  describe("parseColorInput", () => {
    it("parses empty string to empty array", () => {
      expect(parseColorInput("")).toEqual([]);
      expect(parseColorInput("   ")).toEqual([]);
    });

    it("parses space separated colors", () => {
      expect(parseColorInput("#ff0000 #00ff00")).toEqual(["#ff0000", "#00ff00"]);
    });

    it("parses comma separated colors", () => {
      expect(parseColorInput("#ff0000, cream, dark blue")).toEqual(["#ff0000", "cream", "dark", "blue"]);
    });
  });

  describe("runDesignBriefQuestionnaire interactive prompts", () => {
    it("handles guided developer choices", async () => {
      const answers = [
        "1", // Q1: Dashboard/Admin
        "1", // Q2: Minimal
        "#2563eb, slate", // Q3: Colors
        "1", // Q4: Trust
        "Y", // Confirmation: Save
      ];

      const rlSpy = vi.spyOn(readline, "createInterface").mockImplementation(() => {
        return {
          question: (_prompt: string, cb: (ans: string) => void) => {
            cb(answers.shift() ?? "");
          },
          close: () => {},
        } as any;
      });

      const brief = await runDesignBriefQuestionnaire("/fake/root");
      expect(brief).not.toBeNull();
      expect(brief?.purpose.value).toBe("Dashboard/Admin");
      expect(brief?.visualDirection.value).toEqual(["minimal"]);
      expect(brief?.brandColors.value).toEqual(["#2563eb", "slate"]);
      expect(brief?.desiredFeeling.value).toEqual(["trust"]);
      expect(brief?.creativeFreedom).toBe("guided");

      rlSpy.mockRestore();
    });

    it("handles creative freedom (surprise me) choices", async () => {
      const answers = [
        "4", // Q1: Developer Tool
        "7", // Q2: Surprise me
        "surprise me", // Q3: Surprise me
        "5", // Q4: Surprise me
        "Y", // Confirm
      ];

      const rlSpy = vi.spyOn(readline, "createInterface").mockImplementation(() => {
        return {
          question: (_prompt: string, cb: (ans: string) => void) => {
            cb(answers.shift() ?? "");
          },
          close: () => {},
        } as any;
      });

      const brief = await runDesignBriefQuestionnaire("/fake/root");
      expect(brief).not.toBeNull();
      expect(brief?.visualDirection.source).toBe("creative-freedom");
      expect(brief?.brandColors.source).toBe("creative-freedom");
      expect(brief?.desiredFeeling.source).toBe("creative-freedom");
      expect(brief?.creativeFreedom).toBe("creative");

      rlSpy.mockRestore();
    });

    it("handles skipped questions gracefully", async () => {
      const answers = [
        "s", // Q1: Skip
        "skip", // Q2: Skip
        "", // Q3: Skip
        "s", // Q4: Skip
        "Y", // Confirm
      ];

      const rlSpy = vi.spyOn(readline, "createInterface").mockImplementation(() => {
        return {
          question: (_prompt: string, cb: (ans: string) => void) => {
            cb(answers.shift() ?? "");
          },
          close: () => {},
        } as any;
      });

      const brief = await runDesignBriefQuestionnaire("/fake/root");
      expect(brief).not.toBeNull();
      expect(brief?.purpose.source).toBe("not-provided");
      expect(brief?.creativeFreedom).toBe("balanced");

      rlSpy.mockRestore();
    });
  });
});
