import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { SecretsEngine } from "../../src/core/engine/wrappers/secrets-engine.js";
import { EnvGitignoreEngine } from "../../src/core/engine/wrappers/env-gitignore-engine.js";
import { DEFAULT_CONFIG } from "../../src/config/config.js";

describe("Engine Wrappers", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-engine-wrappers-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("SecretsEngine detects secrets and respects options", async () => {
    const engine = new SecretsEngine();
    expect(engine.id).toBe("secrets");

    // Create a file with a synthetic test secret
    await fs.writeFile(
      path.join(tmpDir, "config.ts"),
      "export const stripe = 'sk_test_51MzXYZ1234567890abcdef1234567890';",
    );

    const context = {
      rootDir: tmpDir,
      config: {
        ...DEFAULT_CONFIG,
        ignore: ["node_modules/**"],
        entropyThreshold: 4.5,
        historyDepth: 5,
      },
      options: {
        noVerify: true,
      },
    };

    const findings = await engine.analyze(context);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.category).toBe("secret-detected");
    expect(findings[0]!.verificationState).toBe("unverified");
  });

  it("EnvGitignoreEngine scans env files and gitignore hygiene", async () => {
    const engine = new EnvGitignoreEngine();
    expect(engine.id).toBe("env-gitignore");

    await fs.writeFile(path.join(tmpDir, ".env"), "DATABASE_URL=postgres://localhost:5432/db");

    const context = {
      rootDir: tmpDir,
      config: {
        ...DEFAULT_CONFIG,
        ignore: [],
        historyDepth: 1,
      },
    };

    const findings = await engine.analyze(context);
    expect(Array.isArray(findings)).toBe(true);
  });
});
