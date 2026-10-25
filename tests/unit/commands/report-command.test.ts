import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeReport } from "../../../src/commands/report.js";

describe("Commands: report", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-report-cmd-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should generate a default Markdown report file in the project directory", async () => {
    await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({ name: "clean-app", version: "1.0.0" }));
    await executeReport(tmpDir);

    const reportFile = path.join(tmpDir, "bilt-report.md");
    const content = await fs.readFile(reportFile, "utf-8");
    expect(content).toContain("# Bilt Repository Health Report");
    expect(content).toContain("## Domain Health Scores");
    expect(content).toContain("Security");
  });

  it("should generate a JSON report file when requested", async () => {
    await executeReport(tmpDir, { format: "json", output: "custom-report.json" });

    const reportFile = path.join(tmpDir, "custom-report.json");
    const content = await fs.readFile(reportFile, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.healthScore).toBeDefined();
    expect(parsed.domainScores).toBeDefined();
  });

  it("should output to stdout when stdout: true is passed without writing a file", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    try {
      await executeReport(tmpDir, { stdout: true });
      const fullLog = logs.join("\n");
      expect(fullLog).toContain("# Bilt Repository Health Report");

      // Verify no bilt-report.md was created
      const exists = await fs.access(path.join(tmpDir, "bilt-report.md")).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    } finally {
      console.log = origLog;
    }
  });

  it("should block path traversal attempts writing outside project directory", async () => {
    await expect(
      executeReport(tmpDir, { output: "../outside-report.md" }),
    ).rejects.toThrow(/Report output destination must be within the project directory/);
  });
});
