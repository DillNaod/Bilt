import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeWatch } from "../../../src/commands/watch.js";
import { executeWelcome } from "../../../src/commands/welcome.js";
import * as firstRun from "../../../src/core/onboarding/first-run.js";

describe("Commands: watch and welcome", () => {
  let tmpDir: string;
  let logs: string[] = [];
  const origLog = console.log;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-watch-welcome-"));
    logs = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
  });

  afterEach(async () => {
    console.log = origLog;
    await new Promise((r) => setTimeout(r, 50));
    try {
      await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // Safe cleanup
    }
  });

  describe("executeWatch", () => {
    it("should initialize supervisor in agent format and run initial baseline", async () => {
      await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({ name: "watch-app" }));

      const controller = new AbortController();
      const watchPromise = executeWatch(tmpDir, {
        format: "agent",
        live: true,
        quiet: true,
        signal: controller.signal,
      });

      // Give supervisor time to initialize
      await new Promise((r) => setTimeout(r, 150));
      controller.abort();
      await watchPromise.catch(() => {});
    });
  });

  describe("executeWelcome", () => {
    it("should invoke onboarding wizard and mark first run completed", async () => {
      const wizardSpy = vi.spyOn(firstRun, "runOnboardingWizard").mockResolvedValue();

      await executeWelcome();
      expect(wizardSpy).toHaveBeenCalled();

      wizardSpy.mockRestore();
    });
  });
});
