import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeDesignCheck } from "../../../src/commands/design-check.js";
import { executeDesignBrief } from "../../../src/commands/design-brief.js";
import { readDesignBrief } from "../../../src/core/design/brief/storage.js";

describe("Commands: design-check and design-brief", () => {
  let tmpDir: string;
  let logs: string[] = [];
  const origLog = console.log;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-design-cmds-"));
    logs = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
  });

  afterEach(async () => {
    console.log = origLog;
    process.exitCode = undefined;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("executeDesignCheck", () => {
    it("should pass with code 0 on a clean project without UI findings", async () => {
      await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({ name: "clean-ui" }));
      const code = await executeDesignCheck(tmpDir, { format: "agent" });
      expect(code).toBe(0);

      const jsonLog = logs.find((l) => l.trim().startsWith("{")) || logs.join("\n");
      const parsed = JSON.parse(jsonLog);
      expect(parsed.schemaVersion).toBe("1");
      expect(parsed.status).toBe("pass");
    });

    it("should return code 1 and flag generic landing page tropes", async () => {
      const pageDir = path.join(tmpDir, "src", "app");
      await fs.mkdir(pageDir, { recursive: true });
      await fs.writeFile(
        path.join(pageDir, "page.tsx"),
        `
        export default function Page() {
          return (
            <div>
              <p className="uppercase tracking-widest text-xs">eyebrow</p>
              <h1 className="text-7xl font-bold">Supercharge your workflow with the future of productivity</h1>
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">AI Driven</div>
              <button className="rounded-full bg-gradient-to-r from-purple-500 to-indigo-500">Get Started</button>
              <div className="grid grid-cols-3">
                <div className="rounded-3xl shadow-2xl p-6">Feature 1</div>
                <div className="rounded-3xl shadow-2xl p-6">Feature 2</div>
                <div className="rounded-3xl shadow-2xl p-6">Feature 3</div>
              </div>
            </div>
          );
        }
        `,
      );

      const code = await executeDesignCheck(tmpDir, { format: "agent" });
      expect(code).toBe(1);

      const jsonLog = logs.find((l) => l.trim().startsWith("{")) || logs.join("\n");
      const parsed = JSON.parse(jsonLog);
      expect(parsed.status).toBe("needs-improvement");
      expect(parsed.findings.length).toBeGreaterThan(0);
    });
  });

  describe("executeDesignBrief", () => {
    it("should report unconfigured brief in questionnaire mode", async () => {
      const code = await executeDesignBrief(tmpDir, "questionnaire", { format: "agent" });
      expect(code).toBe(0);

      const jsonLog = logs.find((l) => l.trim().startsWith("{")) || logs.join("\n");
      const parsed = JSON.parse(jsonLog);
      expect(parsed.configured).toBe(false);
      expect(parsed.questions.length).toBe(4);
      expect(parsed.agentInstruction).toContain("STOP EXECUTION IMMEDIATELY");
    });

    it("should save brief options in set subcommand", async () => {
      const code = await executeDesignBrief(tmpDir, "set", {
        purpose: "Dental clinic patient appointment system",
        visual: "Minimal, Technical",
        colors: "#0f172a, #3b82f6",
        feeling: "Trustworthy, calm",
        format: "agent",
      });
      expect(code).toBe(0);

      const saved = await readDesignBrief(tmpDir);
      expect(saved).not.toBeNull();
      expect(saved?.purpose.value).toContain("Dental clinic");
      expect(saved?.visualDirection.value).toContain("Minimal");
      expect(saved?.brandColors.value).toContain("#0f172a");
    });

    it("should clear an existing brief with clear subcommand", async () => {
      await executeDesignBrief(tmpDir, "set", {
        purpose: "Test",
        visual: "Bold",
        colors: "Blue",
        feeling: "Energetic",
      });

      const before = await readDesignBrief(tmpDir);
      expect(before).not.toBeNull();

      await executeDesignBrief(tmpDir, "clear", { format: "agent" });
      const after = await readDesignBrief(tmpDir);
      expect(after).toBeNull();
    });
  });
});
