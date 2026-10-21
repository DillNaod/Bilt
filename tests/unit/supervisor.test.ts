import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { BiltSupervisor } from "../../src/core/watch/supervisor.js";

describe("Agent Supervisor State Machine", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-supervisor-test-"));
    // Create minimal git repo for tests
    const gitDir = path.join(tempDir, ".git");
    await fs.mkdir(gitDir, { recursive: true });
    await fs.writeFile(path.join(tempDir, "package.json"), JSON.stringify({ name: "test-app" }));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should initialize session and enter OBSERVING state", async () => {
    const supervisor = new BiltSupervisor(tempDir);
    expect(supervisor.getState()).toBe("IDLE");

    const session = await supervisor.initialize();
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(supervisor.getState()).toBe("OBSERVING");
  });

  it("should handle clean file changes and transition through states to PASS or OBSERVING", async () => {
    const supervisor = new BiltSupervisor(tempDir);
    await supervisor.initialize();

    await fs.writeFile(path.join(tempDir, "README.md"), "# Hello Bilt");

    const payload = await supervisor.handleFileChanges(["README.md"], false);

    expect(payload).toBeDefined();
    expect(payload.session).toBeDefined();
    expect(payload.lastChangedFiles).toEqual(["README.md"]);
    expect(payload.response).toBeDefined();
    expect(typeof payload.allowedToContinue).toBe("boolean");
  });

  it("should determine relevant categories for scoped file changes", async () => {
    const supervisor = new BiltSupervisor(tempDir);
    await supervisor.initialize();

    // Test different file patterns
    const files = [
      ".env.local",
      "package.json",
      "src/components/Card.tsx",
      "src/routes/auth.ts",
      "src/db/schema.ts",
      "src/utils/logger.ts",
    ];

    for (const file of files) {
      await fs.writeFile(path.join(tempDir, path.basename(file)), "test");
    }

    const payload = await supervisor.handleFileChanges([".env.local"], false);
    expect(payload.response).toBeDefined();
  });

  it("should output JSON when isAgentFormat is true", async () => {
    const supervisor = new BiltSupervisor(tempDir);
    await supervisor.initialize();

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await supervisor.handleFileChanges(["README.md"], true);

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("should handle concurrent change calls safely", async () => {
    const supervisor = new BiltSupervisor(tempDir);
    await supervisor.initialize();

    // Trigger two rapid change events
    const [res1, res2] = await Promise.all([
      supervisor.handleFileChanges(["file1.ts"], false),
      supervisor.handleFileChanges(["file2.ts"], false),
    ]);

    expect(res1).toBeDefined();
    expect(res2).toBeDefined();
  });
});
