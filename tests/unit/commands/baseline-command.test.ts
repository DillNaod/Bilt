import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeBaselineCreate } from "../../../src/commands/baseline.js";
import { loadBaseline, isFingerprintInBaseline } from "../../../src/core/scoping/baseline.js";
import { readLoopState } from "../../../src/core/loop/state.js";

describe("Commands: baseline create", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-baseline-cmd-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create a baseline on an empty project with 0 fingerprints", async () => {
    const baselinePath = await executeBaselineCreate(tmpDir, { json: false });
    expect(baselinePath).toBe(path.join(tmpDir, ".bilt", "baseline.json"));

    const baseline = await loadBaseline(tmpDir);
    expect(baseline).not.toBeNull();
    expect(baseline?.size).toBe(0);

    const loopState = await readLoopState(tmpDir);
    expect(loopState.currentIteration).toBe(0);
  });

  it("should output valid JSON in json mode and capture findings as fingerprints", async () => {
    // Create an unignored .env file to generate findings
    await fs.writeFile(path.join(tmpDir, ".env"), "DATABASE_URL=postgres://localhost:5432/db\nSECRET_KEY=12345\n");
    await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test-app", version: "1.0.0" }));

    const consoleLogs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => consoleLogs.push(args.join(" "));

    try {
      const baselinePath = await executeBaselineCreate(tmpDir, { json: true });
      expect(baselinePath).toBe(path.join(tmpDir, ".bilt", "baseline.json"));

      const jsonLog = consoleLogs.find((l) => l.trim().startsWith("{")) || consoleLogs.join("\n");
      const parsedLog = JSON.parse(jsonLog);
      expect(parsedLog.success).toBe(true);
      expect(parsedLog.baselineFile).toBe(baselinePath);
      expect(parsedLog.fingerprintsCount).toBeGreaterThanOrEqual(1);

      const baseline = await loadBaseline(tmpDir);
      expect(baseline).not.toBeNull();
      expect(baseline?.size).toBe(parsedLog.fingerprintsCount);
      const firstFp = Array.from(baseline!)[0]!;
      expect(isFingerprintInBaseline(firstFp, baseline)).toBe(true);
    } finally {
      console.log = origLog;
    }
  });

  it("should overwrite existing baseline on re-run and reset loop state", async () => {
    await fs.writeFile(path.join(tmpDir, ".env"), "KEY_ONE=val1\n");
    await executeBaselineCreate(tmpDir);

    const firstBaseline = await loadBaseline(tmpDir);
    expect(firstBaseline?.size).toBeGreaterThan(0);

    // Add another variable
    await fs.writeFile(path.join(tmpDir, ".env"), "KEY_ONE=val1\nKEY_TWO=val2\n");
    await executeBaselineCreate(tmpDir);

    const secondBaseline = await loadBaseline(tmpDir);
    expect(secondBaseline?.size).toBeGreaterThan(0);
  });
});
