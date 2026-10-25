import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";

describe("npm Packaging & Distribution Behavior Depth", () => {
  const rootDir = path.resolve(".");

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

  it("should execute npm pack --dry-run and verify essential artifacts are packaged without sensitive files", () => {
    const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: rootDir,
      encoding: "utf-8",
    });

    const parsed = JSON.parse(output.trim());
    expect(Array.isArray(parsed)).toBe(true);
    const tarballInfo = parsed[0];
    expect(tarballInfo.name).toBe("bilt-toolkit");

    const fileList: string[] = tarballInfo.files.map((f: any) => f.path);

    // Essential files present
    expect(fileList.some((p) => p === "bin/bilt.js")).toBe(true);
    expect(fileList.some((p) => p.startsWith("dist/"))).toBe(true);
    expect(fileList.some((p) => p === "package.json")).toBe(true);
    expect(fileList.some((p) => p === "README.md")).toBe(true);

    // No tests, test fixtures, coverage, or local secrets packaged
    expect(fileList.some((p) => p.startsWith("tests/"))).toBe(false);
    expect(fileList.some((p) => p.startsWith("coverage/"))).toBe(false);
    expect(fileList.some((p) => p.startsWith(".env"))).toBe(false);
    expect(fileList.some((p) => p.startsWith(".git/"))).toBe(false);
  });
});
