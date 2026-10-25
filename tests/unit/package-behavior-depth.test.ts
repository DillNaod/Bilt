import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";

describe("npm Packaging & Distribution Behavior Depth", () => {
  const rootDir = path.resolve(__dirname, "../..");

  it("should have valid package.json with bin, main, and files declarations", async () => {
    const pkgRaw = await fs.readFile(path.join(rootDir, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw);

    expect(pkg.name).toBe("bilt-toolkit");
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin.bilt).toBe("./bin/bilt.js");
    expect(pkg.main).toBe("dist/cli.js");
    expect(Array.isArray(pkg.files)).toBe(true);
    expect(pkg.files).toContain("dist");
    expect(pkg.files).toContain("bin");
    expect(pkg.files).toContain("templates");
  });

  it("should have executable bin entrypoint file referencing dist/cli.js with shebang", async () => {
    const binPath = path.join(rootDir, "bin", "bilt.js");
    const content = await fs.readFile(binPath, "utf-8");

    expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
    expect(content).toContain("../dist/cli.js");

    const stat = await fs.stat(binPath);
    // On Unix, check executable permissions (mode & 0o111)
    if (process.platform !== "win32") {
      expect((stat.mode & 0o111) > 0).toBe(true);
    }
  });

  it("should verify package manifest files exist on disk without sensitive paths", async () => {
    const pkgRaw = await fs.readFile(path.join(rootDir, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw);

    // Verify all declared distribution paths exist on disk
    for (const declaredFile of pkg.files) {
      const fullPath = path.join(rootDir, declaredFile);
      const exists = await fs.access(fullPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }

    // Verify dist contains compiled CLI entrypoint
    const cliExists = await fs.access(path.join(rootDir, "dist", "cli.js")).then(() => true).catch(() => false);
    expect(cliExists).toBe(true);

    // Verify templates contain required agent prompts
    const templates = await fs.readdir(path.join(rootDir, "templates"));
    expect(templates).toContain("default.md");
    expect(templates).toContain("claude.md");
    expect(templates).toContain("cursor.md");

    // Package manifest must not expose tests, fixtures, or local secrets
    const forbidden = [".env", ".env.local", "coverage", ".git", "tests"];
    for (const item of forbidden) {
      expect(pkg.files).not.toContain(item);
    }
  });
});
