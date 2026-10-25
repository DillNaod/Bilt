import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeDesignBrief } from "../../src/commands/design-brief.js";
import { readDesignBrief } from "../../src/core/design/brief/storage.js";
import { getDesignRules, DESIGN_RULES, RULE_CATALOG_VERSION } from "../../src/core/design/catalog.js";

describe("Design Brief Command & Catalog Depth", () => {
  let tmpDir: string;
  let logs: string[] = [];
  let errorLogs: string[] = [];
  const origLog = console.log;
  const origError = console.error;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-design-brief-depth-"));
    logs = [];
    errorLogs = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
    console.error = (...args: any[]) => errorLogs.push(args.join(" "));
  });

  afterEach(async () => {
    console.log = origLog;
    console.error = origError;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("Subcommand: clear", () => {
    it("should clear existing design brief in agent format", async () => {
      // First create a brief
      await executeDesignBrief(tmpDir, "set", {
        purpose: "Developer tool",
        visual: "Minimal",
        colors: "#000000",
        feeling: "Technical",
      });
      const briefBefore = await readDesignBrief(tmpDir);
      expect(briefBefore).not.toBeNull();

      logs = [];
      const code = await executeDesignBrief(tmpDir, "clear", { format: "agent" });
      expect(code).toBe(0);

      const briefAfter = await readDesignBrief(tmpDir);
      expect(briefAfter).toBeNull();

      const jsonLog = logs.find((l) => l.trim().startsWith("{"));
      expect(jsonLog).toBeDefined();
      const parsed = JSON.parse(jsonLog!);
      expect(parsed.configured).toBe(false);
    });

    it("should clear existing design brief in human format", async () => {
      await executeDesignBrief(tmpDir, "set", { purpose: "E-commerce" });
      logs = [];

      const code = await executeDesignBrief(tmpDir, "clear", { format: "human" });
      expect(code).toBe(0);
      expect(logs.join("\n")).toContain("Cleared Bilt Design Brief");
    });
  });

  describe("Subcommand: questionnaire / questions", () => {
    it("should print 4 design intent questions in agent format with blocking instruction", async () => {
      const code = await executeDesignBrief(tmpDir, "questions", { format: "agent" });
      expect(code).toBe(0);

      const jsonLog = logs.find((l) => l.trim().startsWith("{"));
      expect(jsonLog).toBeDefined();
      const parsed = JSON.parse(jsonLog!);
      expect(parsed.schemaVersion).toBe("1");
      expect(parsed.questions.length).toBe(4);
      expect(parsed.agentInstruction).toContain("STOP EXECUTION IMMEDIATELY");
    });

    it("should print formatted questionnaire in human format", async () => {
      const code = await executeDesignBrief(tmpDir, "questionnaire", { format: "human" });
      expect(code).toBe(0);
      expect(logs.join("\n")).toContain("BILT DESIGN INTENT QUESTIONNAIRE");
      expect(logs.join("\n")).toContain("Purpose & Audience");
    });
  });

  describe("Subcommand: set", () => {
    it("should save brief via --json string", async () => {
      const jsonPayload = JSON.stringify({
        purpose: "Medical records app",
        audience: "Doctors",
        visualDirection: ["Minimal", "Technical"],
        brandColors: ["#0066cc"],
        desiredFeeling: ["Trustworthy"],
        creativeFreedom: "strict",
      });

      const code = await executeDesignBrief(tmpDir, "set", { json: jsonPayload });
      expect(code).toBe(0);

      const brief = await readDesignBrief(tmpDir);
      expect(brief).not.toBeNull();
      expect(brief?.purpose.value).toBe("Medical records app");
      expect(brief?.creativeFreedom).toBe("strict");
    });

    it("should return code 1 on malformed JSON payload", async () => {
      const code = await executeDesignBrief(tmpDir, "set", { json: "{ invalid json " });
      expect(code).toBe(1);
      expect(errorLogs.join("\n")).toContain("Invalid JSON");
    });

    it("should handle 'surprise me' creative freedom inputs", async () => {
      const code = await executeDesignBrief(tmpDir, "set", {
        purpose: "Finance dashboard",
        visual: "Surprise me",
        colors: "Surprise me",
        feeling: "Surprise me",
      });
      expect(code).toBe(0);

      const brief = await readDesignBrief(tmpDir);
      expect(brief).not.toBeNull();
      expect(brief?.purpose.source).toBe("developer");
      expect(brief?.purpose.value).toBe("Finance dashboard");
      expect(brief?.visualDirection.source).toBe("creative-freedom");
      expect(brief?.brandColors.source).toBe("creative-freedom");
      expect(brief?.desiredFeeling.source).toBe("creative-freedom");
      // Because surprises (3) > devs (1), freedom mode defaults to 'creative'
      expect(brief?.creativeFreedom).toBe("creative");
    });
  });

  describe("Default Status Display", () => {
    it("should report unconfigured status in agent format when no brief exists", async () => {
      const code = await executeDesignBrief(tmpDir, undefined, { format: "agent" });
      expect(code).toBe(0);

      const jsonLog = logs.find((l) => l.trim().startsWith("{"));
      const parsed = JSON.parse(jsonLog!);
      expect(parsed.configured).toBe(false);
      expect(parsed.agentInstructions).toContain("PAUSE execution immediately");
    });

    it("should report configured summary in human format when brief exists", async () => {
      await executeDesignBrief(tmpDir, "set", {
        purpose: "Developer CLI",
        visual: "Technical",
        colors: "#00ff88",
        feeling: "Energetic",
      });

      logs = [];
      const code = await executeDesignBrief(tmpDir, undefined, { format: "human" });
      expect(code).toBe(0);
      expect(logs.join("\n")).toContain("Developer CLI");
    });
  });

  describe("Rule Catalog & Versioning", () => {
    it("should return v1 catalog rules and match exported constant", () => {
      const rules = getDesignRules("v1");
      expect(rules.length).toBeGreaterThan(0);
      expect(rules).toEqual(DESIGN_RULES);
      expect(RULE_CATALOG_VERSION).toBe("v1");
    });

    it("should fallback to latest v1 rules for unknown catalog version", () => {
      const rules = getDesignRules("v999");
      expect(rules.length).toBe(DESIGN_RULES.length);
    });
  });
});
