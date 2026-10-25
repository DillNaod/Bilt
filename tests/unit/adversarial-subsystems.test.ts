import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeScan } from "../../src/commands/scan.js";
import { buildProjectModel } from "../../src/core/project-model/builder.js";
import { loadConfig } from "../../src/config/config.js";
import { loadBaseline } from "../../src/core/scoping/baseline.js";
import { listSnapshots, restoreSnapshot } from "../../src/core/fix/snapshot.js";
import { checkLoopProgress } from "../../src/core/loop/state.js";
import { recordSessionIteration, resetSession } from "../../src/core/agent/session.js";
import { isPathContained } from "../../src/core/safety/index.js";

describe("Adversarial Subsystems & Defensive Resilience", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-adversarial-subsystems-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("Malicious Filenames & Unusual Paths", () => {
    it("should safely process filenames with spaces, quotes, emojis, and shell metacharacters", async () => {
      const complexNames = [
        "file with spaces.ts",
        "file-with-'single'-quotes.js",
        'file-with-"double"-quotes.ts',
        "file with (parentheses) & [brackets].tsx",
        "file_with_emoji_🔥_🚀.ts",
        "file;semicolon&ampersand.js",
      ];

      for (const name of complexNames) {
        await fs.writeFile(path.join(tmpDir, name), "export const val = 123;\n", "utf-8");
      }

      const model = await buildProjectModel(tmpDir);
      expect(model.totalFilesScanned).toBeGreaterThanOrEqual(complexNames.length);

      const scanResult = await executeScan(tmpDir, { silent: true });
      expect(scanResult).toBeDefined();
      expect(scanResult.healthScore).toBe(100);
    });

    it("should safely process zero-byte empty files without division by zero or index crash", async () => {
      await fs.writeFile(path.join(tmpDir, "empty.ts"), "");
      await fs.writeFile(path.join(tmpDir, ".env"), "");
      await fs.writeFile(path.join(tmpDir, "empty.json"), "");

      const model = await buildProjectModel(tmpDir);
      expect(model).toBeDefined();

      const scanResult = await executeScan(tmpDir, { silent: true });
      expect(scanResult.findings).toBeDefined();
    });

    it("should traverse deeply nested empty directory trees safely", async () => {
      const deepDir = path.join(tmpDir, "a/b/c/d/e/f/g/h/i/j");
      await fs.mkdir(deepDir, { recursive: true });

      const model = await buildProjectModel(tmpDir);
      expect(model.totalFilesScanned).toBe(0);

      const scanResult = await executeScan(tmpDir, { silent: true });
      expect(scanResult.healthScore).toBe(100);
    });
  });

  describe("Corrupt State Resilience", () => {
    it("should recover from corrupt or truncated baseline JSON file", async () => {
      const biltDir = path.join(tmpDir, ".bilt");
      await fs.mkdir(biltDir, { recursive: true });
      // Write truncated/malformed JSON
      await fs.writeFile(path.join(biltDir, "baseline.json"), '{"version": 1, "fingerprints": [');

      const baseline = await loadBaseline(tmpDir);
      expect(baseline).toBeNull();

      // Scan should run cleanly without throwing on corrupt baseline
      const scanResult = await executeScan(tmpDir, { silent: true });
      expect(scanResult).toBeDefined();
    });

    it("should recover from corrupt or malformed snapshot files during undo listing", async () => {
      const snapshotDir = path.join(tmpDir, ".bilt", "snapshots");
      await fs.mkdir(snapshotDir, { recursive: true });
      await fs.writeFile(path.join(snapshotDir, "snap-corrupt-1.json"), "NOT VALID JSON");
      await fs.writeFile(path.join(snapshotDir, "snap-empty.json"), "");

      const snapshots = await listSnapshots(tmpDir);
      // Corrupt snapshot files should be skipped, returning empty or valid array without crashing
      expect(Array.isArray(snapshots)).toBe(true);

      // Attempting to restore nonexistent or invalid snapshot returns false
      const restored = await restoreSnapshot(tmpDir, "non-existent-snap-id");
      expect(restored).toBe(false);
    });

    it("should fallback gracefully when .biltrc.json has invalid property types", async () => {
      const badConfig = {
        ignore: 12345, // Should be string array
        sound: "not-a-boolean",
        severityOverrides: 999,
      };
      await fs.writeFile(path.join(tmpDir, ".biltrc.json"), JSON.stringify(badConfig));

      const config = await loadConfig(tmpDir);
      expect(config).toBeDefined();
      expect(Array.isArray(config.ignore)).toBe(true);
    });
  });

  describe("Symlink Traversal & Confinement", () => {
    it("should verify path containment correctly prevents traversal outside workspace", () => {
      const outside = path.resolve(tmpDir, "../secret-outside.txt");
      expect(isPathContained(outside, tmpDir)).toBe(false);

      const inside = path.resolve(tmpDir, "src/components/Button.tsx");
      expect(isPathContained(inside, tmpDir)).toBe(true);

      const dotDotInside = path.resolve(tmpDir, "src/../src/components/Button.tsx");
      expect(isPathContained(dotDotInside, tmpDir)).toBe(true);
    });

    it("should handle circular symlinks without infinite recursion", async () => {
      const dirA = path.join(tmpDir, "dirA");
      const dirB = path.join(tmpDir, "dirB");
      await fs.mkdir(dirA, { recursive: true });
      await fs.mkdir(dirB, { recursive: true });

      try {
        await fs.symlink(dirB, path.join(dirA, "linkToB"));
        await fs.symlink(dirA, path.join(dirB, "linkToA"));
      } catch {
        return; // Skip on platforms without symlink permission
      }

      // Scanner must terminate cleanly without stack overflow
      const scanResult = await executeScan(tmpDir, { silent: true });
      expect(scanResult).toBeDefined();
    });
  });

  describe("Loop Escalation & Regression Tracking Subsystems", () => {
    it("checkLoopProgress should report loop progression and trigger escalation on identical iterations", async () => {
      const mockFingerprints = ["fp-alpha-123", "fp-beta-456"];

      // Iteration 1
      const res1 = await checkLoopProgress(tmpDir, mockFingerprints, { maxIterations: 3 });
      expect(res1.iteration).toBe(1);
      expect(res1.shouldEscalate).toBe(false);

      // Iteration 2: identical findings
      const res2 = await checkLoopProgress(tmpDir, mockFingerprints, { maxIterations: 3 });
      expect(res2.iteration).toBe(2);
      expect(res2.shouldEscalate).toBe(false);

      // Iteration 3: identical findings -> triggers escalation!
      const res3 = await checkLoopProgress(tmpDir, mockFingerprints, { maxIterations: 3 });
      expect(res3.iteration).toBe(3);
      expect(res3.shouldEscalate).toBe(true);
      expect(res3.escalationReason).toContain("Loop escalated: no progress");
    });

    it("session tracking should correctly record regressions and resolution delta", async () => {
      await resetSession(tmpDir);

      const issue1 = "finding-issue-1";
      const issue2 = "finding-issue-2";

      // 1. Initial run: issue1 and issue2 found
      const iter1 = await recordSessionIteration(tmpDir, [issue1, issue2]);
      expect(iter1.session.iteration).toBe(1);

      // 2. Fix issue1: only issue2 remains
      const iter2 = await recordSessionIteration(tmpDir, [issue2]);
      expect(iter2.delta.resolved).toContain(issue1);
      expect(iter2.delta.regressions).toHaveLength(0);

      // 3. Regression: issue1 is re-introduced!
      const iter3 = await recordSessionIteration(tmpDir, [issue1, issue2]);
      expect(iter3.delta.regressions).toContain(issue1);
      expect(iter3.session.regressions).toContain(issue1);
    });
  });
});
