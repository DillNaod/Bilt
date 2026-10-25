import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeVerify } from "../../../src/commands/verify.js";
import { executeUndo } from "../../../src/commands/undo.js";
import { createSnapshot } from "../../../src/core/fix/snapshot.js";
import { simpleGit } from "simple-git";

describe("Commands: verify and undo", () => {
  let tmpDir: string;
  let logs: string[] = [];
  const origLog = console.log;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-verify-undo-"));
    logs = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
  });

  afterEach(async () => {
    console.log = origLog;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("executeVerify", () => {
    it("should verify a clean git repository against base commit and return pass exit code 0", async () => {
      const git = simpleGit(tmpDir);
      await git.init();
      await git.addConfig("user.name", "Test User");
      await git.addConfig("user.email", "test@example.com");

      await fs.writeFile(path.join(tmpDir, "README.md"), "# Initial Commit\n");
      await git.add(".");
      await git.commit("Initial commit");

      await fs.writeFile(path.join(tmpDir, "index.ts"), "export const a = 1;\n");
      await git.add(".");
      await git.commit("Add clean code");

      const { output, exitCode } = await executeVerify(tmpDir, {
        base: "HEAD~1",
        format: "agent",
      });

      expect(exitCode).toBe(0);
      expect(output.status).toBe("pass");
      expect(output.summary.introduced_findings).toBe(0);
    });

    it("should output SARIF format when format: sarif is passed", async () => {
      const git = simpleGit(tmpDir);
      await git.init();
      await git.addConfig("user.name", "Test User");
      await git.addConfig("user.email", "test@example.com");

      await fs.writeFile(path.join(tmpDir, "README.md"), "# Initial Commit\n");
      await git.add(".");
      await git.commit("Initial commit");

      await executeVerify(tmpDir, {
        base: "HEAD",
        format: "sarif",
      });

      const parsedSarif = JSON.parse(logs.join("\n"));
      expect(parsedSarif.version).toBe("2.1.0");
      expect(parsedSarif.runs).toBeDefined();
    });

    it("should output human summary when format is text/human", async () => {
      const git = simpleGit(tmpDir);
      await git.init();
      await git.addConfig("user.name", "Test User");
      await git.addConfig("user.email", "test@example.com");

      await fs.writeFile(path.join(tmpDir, "README.md"), "# Initial Commit\n");
      await git.add(".");
      await git.commit("Initial commit");

      const { exitCode } = await executeVerify(tmpDir, {
        base: "HEAD",
        format: "text" as any,
      });

      expect(exitCode).toBe(0);
      expect(logs.join("\n")).toContain("Verification Passed");
    });
  });

  describe("executeUndo", () => {
    it("should list snapshots history when --list is requested", async () => {
      await executeUndo(tmpDir, { list: true });
      expect(logs.join("\n")).toContain("No snapshots found.");

      // Create a snapshot
      const testFile = path.join(tmpDir, "file.txt");
      await fs.writeFile(testFile, "content v1");
      await createSnapshot([testFile], "Backup test", tmpDir);

      logs = [];
      await executeUndo(tmpDir, { list: true });
      expect(logs.join("\n")).toContain("Backup test");
    });

    it("should inform user when nothing to undo", async () => {
      await executeUndo(tmpDir);
      expect(logs.join("\n")).toContain("No snapshots found. Nothing to undo.");
    });
  });
});
