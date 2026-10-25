import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeFix } from "../../../src/commands/fix/index.js";
import { generateFixActions } from "../../../src/commands/fix/plan.js";
import {
  createVerificationResult,
  verifyContains,
  verifyMatches,
  verifyNotMatches,
} from "../../../src/commands/fix/verification.js";
import { debugReadFile, debugWriteFile } from "../../../src/commands/fix/apply.js";
import { listSnapshots } from "../../../src/core/fix/snapshot.js";

describe("Commands: fix execution & strategies", () => {
  let tmpDir: string;
  let logs: string[] = [];
  const origLog = console.log;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-fix-cmd-"));
    logs = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
  });

  afterEach(async () => {
    console.log = origLog;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("executeFix", () => {
    it("should report no issues found on clean empty project", async () => {
      await executeFix(tmpDir, { safe: true });
      expect(logs.join("\n")).toContain("No issues found");
    });

    it("should support dry-run preview mode without modifying files", async () => {
      await fs.writeFile(path.join(tmpDir, ".env"), "TEST_SECRET=123\n");
      // Initially no .gitignore exists
      await executeFix(tmpDir, { dryRun: true });

      expect(logs.join("\n")).toContain("(Dry run \u2014 no changes applied)");

      // Verify .gitignore was not created
      const gitignoreExists = await fs.access(path.join(tmpDir, ".gitignore")).then(() => true).catch(() => false);
      expect(gitignoreExists).toBe(false);

      // Verify no snapshot was created in dry-run
      const snapshots = await listSnapshots(tmpDir);
      expect(snapshots.length).toBe(0);
    });

    it("should automatically apply safe fixes in safe mode and save snapshot", async () => {
      await fs.writeFile(path.join(tmpDir, ".env"), "API_KEY=secret_key\n");
      await executeFix(tmpDir, { safe: true });

      // Verify .gitignore was created with .env
      const gitignoreContent = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
      expect(gitignoreContent).toContain(".env");

      // Verify snapshot was created
      const snapshots = await listSnapshots(tmpDir);
      expect(snapshots.length).toBeGreaterThan(0);
    });
  });

  describe("Verification Utilities", () => {
    it("should create verification result", () => {
      expect(createVerificationResult(true, "All good")).toEqual({ passed: true, message: "All good" });
      expect(createVerificationResult(false, "Failed")).toEqual({ passed: false, message: "Failed" });
    });

    it("should verify contains correctly", () => {
      const ok = verifyContains("hello world", "world", "Found", "Missing");
      expect(ok.passed).toBe(true);
      expect(ok.message).toBe("Found");

      const fail = verifyContains("hello world", "foo", "Found", "Missing");
      expect(fail.passed).toBe(false);
      expect(fail.message).toBe("Missing");
    });

    it("should verify matches regex correctly", () => {
      const ok = verifyMatches("const port = 8080;", /\d{4}/, "Matched", "Did not match");
      expect(ok.passed).toBe(true);

      const fail = verifyMatches("no numbers here", /\d+/, "Matched", "Did not match");
      expect(fail.passed).toBe(false);
    });

    it("should verify not matches regex correctly", () => {
      const ok = verifyNotMatches("clean code", /eval\(/, "Clean", "Unsafe eval found");
      expect(ok.passed).toBe(true);

      const fail = verifyNotMatches("eval('1+1')", /eval\(/, "Clean", "Unsafe eval found");
      expect(fail.passed).toBe(false);
    });
  });

  describe("File Debug Helpers", () => {
    it("should debug read file and write file with debugging enabled", async () => {
      const testFile = path.join(tmpDir, "debug-test.txt");
      await fs.writeFile(testFile, "Initial content");

      const read = await debugReadFile(testFile, true);
      expect(read).toBe("Initial content");

      await debugWriteFile(testFile, "New content", "Initial content", true);
      const after = await fs.readFile(testFile, "utf-8");
      expect(after).toBe("New content");
    });

    it("should throw when debug reading nonexistent file", async () => {
      await expect(debugReadFile(path.join(tmpDir, "nonexistent.txt"), true)).rejects.toThrow();
    });
  });
});
