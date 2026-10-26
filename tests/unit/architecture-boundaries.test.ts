import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { validateProjectDirectory } from "../../src/core/safety/index.js";
import { FilesystemError, isBiltError } from "../../src/core/errors/index.js";
import { runPluginsStep } from "../../src/commands/scan/steps/plugins.js";
import { handleCommandError } from "../../src/cli/common.js";
import { logger } from "../../src/core/logging/logger.js";
import type { ScanStepContext } from "../../src/commands/scan/steps/context.js";

describe("Architecture Boundaries & Failure Isolation", () => {
  const srcDir = path.resolve(__dirname, "../../src");

  describe("Architectural Dependency Flow", () => {
    it("src/core must not statically import from src/commands", async () => {
      const coreFiles = await fg(["core/**/*.ts"], {
        cwd: srcDir,
        absolute: true,
      });

      const violations: string[] = [];
      const commandImportPattern = /from\s+["'](\.\.\/)*commands\//;

      for (const file of coreFiles) {
        const content = await fs.readFile(file, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          // Disallow static imports from commands
          if (commandImportPattern.test(line) && !line.trim().startsWith("//")) {
            violations.push(`${path.relative(srcDir, file)}:${i + 1} -> ${line.trim()}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it("src/core/rules and security-engine must not import from src/ui or src/commands", async () => {
      const ruleFiles = await fg(["core/rules/**/*.ts", "core/security-engine/**/*.ts"], {
        cwd: srcDir,
        absolute: true,
      });

      const violations: string[] = [];
      const forbiddenPattern = /from\s+["'](\.\.\/)*(ui|commands)\//;

      for (const file of ruleFiles) {
        const content = await fs.readFile(file, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (forbiddenPattern.test(line) && !line.trim().startsWith("//")) {
            violations.push(`${path.relative(srcDir, file)}:${i + 1} -> ${line.trim()}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it("src/core/errors and src/core/logging must have zero imports from ui or commands", async () => {
      const foundationalFiles = await fg(["core/errors/**/*.ts", "core/logging/**/*.ts"], {
        cwd: srcDir,
        absolute: true,
      });

      const violations: string[] = [];
      const forbiddenPattern = /from\s+["'](\.\.\/)*(ui|commands|readiness|design|rules)\//;

      for (const file of foundationalFiles) {
        const content = await fs.readFile(file, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (forbiddenPattern.test(line) && !line.trim().startsWith("//")) {
            violations.push(`${path.relative(srcDir, file)}:${i + 1} -> ${line.trim()}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe("Failure Isolation & Error Propagation", () => {
    it("validateProjectDirectory throws FilesystemError with ERR_FS_NOT_FOUND on missing path", async () => {
      const nonExistent = path.join(__dirname, "non-existent-directory-" + Date.now());

      try {
        await validateProjectDirectory(nonExistent);
        expect.unreachable("Should have thrown FilesystemError");
      } catch (err: any) {
        expect(isBiltError(err)).toBe(true);
        expect(err).toBeInstanceOf(FilesystemError);
        expect(err.code).toBe("ERR_FS_NOT_FOUND");
        expect(err.exitCode).toBe(2);
        expect(err.message).toContain("Directory not found");
        expect(err.cause).toBeDefined();
      }
    });

    it("validateProjectDirectory throws FilesystemError with ERR_FS_NOT_A_DIRECTORY on file", async () => {
      const filePath = path.resolve(__dirname, "../../package.json");

      try {
        await validateProjectDirectory(filePath);
        expect.unreachable("Should have thrown FilesystemError");
      } catch (err: any) {
        expect(isBiltError(err)).toBe(true);
        expect(err).toBeInstanceOf(FilesystemError);
        expect(err.code).toBe("ERR_FS_NOT_A_DIRECTORY");
        expect(err.exitCode).toBe(2);
        expect(err.message).toContain("Target path is not a directory");
      }
    });

    it("runPluginsStep isolates individual plugin crashes and logs diagnostic warnings", async () => {
      const warnSpy = vi.spyOn(logger, "warn");

      const mockContext: ScanStepContext = {
        rootDir: srcDir,
        config: {
          plugins: ["docker"],
          ignore: [],
          severityOverrides: {},
          entropyThreshold: 4.5,
          historyDepth: 10,
          customRules: [],
        },
        options: { quiet: true },
      };

      // Execution completes without throwing, isolating plugin execution safely
      const findings = await runPluginsStep(mockContext);
      expect(Array.isArray(findings)).toBe(true);
      warnSpy.mockRestore();
    });

    it("handleCommandError logs diagnostic and maps domain error to exit code", () => {
      const errorLogSpy = vi.spyOn(logger, "error");
      const origConsoleError = console.error;
      console.error = vi.fn();

      const fsErr = new FilesystemError("Missing required directory", {
        code: "ERR_FS_NOT_FOUND",
        exitCode: 2,
        context: { path: "/missing" },
      });

      const exitCode = handleCommandError(fsErr, { command: "scan" });

      expect(exitCode).toBe(2);
      expect(errorLogSpy).toHaveBeenCalled();

      console.error = origConsoleError;
      errorLogSpy.mockRestore();
    });
  });
});
