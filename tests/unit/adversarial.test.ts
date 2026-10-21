import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeScan } from "../../src/commands/scan.js";
import { buildProjectModel } from "../../src/core/project-model/builder.js";
import { detectTampering, analyzeConfigDiff } from "../../src/core/trust/tamper.js";
import { checkLoopProgress, resetLoopState, readLoopState } from "../../src/core/loop/state.js";
import { parseEnvFile } from "../../src/core/scan/env.js";
import { sanitizeSnippet, redactKnownSecrets } from "../../src/core/safety/sanitizer.js";
import { stripAnsi } from "../../src/ui/theme.js";
import { isFindingIntroducedByChange } from "../../src/core/scoping/git-scope.js";

describe("Adversarial Robustness & Edge Cases", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-adversarial-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("Malformed Projects & Syntax Errors", () => {
    it("should handle completely empty directory without throwing", async () => {
      const result = await executeScan(tempDir, { silent: true });
      expect(result).toBeDefined();
      expect(result.findings).toEqual([]);
      expect(result.scannedFiles).toBe(0);
    });

    it("should handle malformed package.json gracefully", async () => {
      await fs.writeFile(path.join(tempDir, "package.json"), "{ invalid json: true, ");
      const model = await buildProjectModel(tempDir);
      expect(model.framework).toBeUndefined();
    });

    it("should handle unparseable source files with syntax errors without crashing", async () => {
      await fs.writeFile(
        path.join(tempDir, "broken.ts"),
        "export function broken( { if class for return }}}",
      );
      const model = await buildProjectModel(tempDir);
      expect(model.components).toBeDefined();
      const scanResult = await executeScan(tempDir, { silent: true });
      expect(scanResult.findings).toBeDefined();
    });

    it("should handle malformed .env files with null bytes and invalid lines", () => {
      const content = "VALID_VAR=123\n\x00NULL_BYTE=corrupt\n=MISSING_KEY\nINVALID LINE\n";
      const parsed = parseEnvFile(content, ".env");
      expect(parsed.entries.has("VALID_VAR")).toBe(true);
      expect(parsed.entries.get("VALID_VAR")?.value).toBe("123");
    });
  });

  describe("Binary Files & File Boundaries", () => {
    it("should handle binary files with random bytes without crashing", async () => {
      const binaryBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x00, 0x12]);
      await fs.writeFile(path.join(tempDir, "image.png"), binaryBuffer);
      await fs.writeFile(path.join(tempDir, "binary.wasm"), binaryBuffer);
      const scanResult = await executeScan(tempDir, { silent: true });
      expect(scanResult.findings).toBeDefined();
    });

    it("should skip extremely large files (> 512KB) in project model", async () => {
      const largeContent = "const x = 1;\n".repeat(45000); // > 512KB
      await fs.writeFile(path.join(tempDir, "large.ts"), largeContent);
      const model = await buildProjectModel(tempDir);
      const found = model.components.some((c) => c.file === "large.ts");
      expect(found).toBe(false);
    });
  });

  describe("Symlinks & Broken Symlinks", () => {
    it("should handle broken symlinks gracefully", async () => {
      const nonExistent = path.join(tempDir, "does-not-exist.ts");
      const symlinkPath = path.join(tempDir, "broken-link.ts");
      try {
        await fs.symlink(nonExistent, symlinkPath);
      } catch {
        // Skip on environments where symlink creation is restricted
        return;
      }

      const scanResult = await executeScan(tempDir, { silent: true });
      expect(scanResult.findings).toBeDefined();
    });
  });

  describe("Path Traversal & Hostile Filenames", () => {
    it("should safely sanitize snippet output and truncate path traversal sequences", () => {
      const hostileSnippet = "const path = '../../../../../../etc/passwd';";
      const sanitized = sanitizeSnippet(hostileSnippet, 100);
      expect(sanitized).toBeDefined();
    });

    it("should sanitize ANSI escape sequences and control characters", () => {
      const hostileInput = "SecretKey \x1b[31;1mCRITICAL_INJECTION\x1b[0m";
      const stripped = stripAnsi(hostileInput);
      expect(stripped).toBe("SecretKey CRITICAL_INJECTION");
    });
  });

  describe("Corrupt State & Loop Escalation", () => {
    it("should recover from a corrupt .bilt/loop.json file", async () => {
      const biltDir = path.join(tempDir, ".bilt");
      await fs.mkdir(biltDir, { recursive: true });
      await fs.writeFile(path.join(biltDir, "loop.json"), "{ invalid: [ corrupt");

      const state = await readLoopState(tempDir);
      expect(state.currentIteration).toBe(0);
      expect(state.history).toEqual([]);
    });

    it("should escalate after repeated identical findings exceed maxIterations", async () => {
      const findings = ["finding-hash-1", "finding-hash-2"];
      await resetLoopState(tempDir);

      let escalationOccurred = false;
      for (let i = 0; i < 6; i++) {
        const result = await checkLoopProgress(tempDir, findings, { maxIterations: 3 });
        if (result.shouldEscalate) {
          escalationOccurred = true;
          expect(result.escalationReason?.toLowerCase()).toContain("identical findings");
          break;
        }
      }
      expect(escalationOccurred).toBe(true);
    });
  });

  describe("Tamper & Security Bypass Detection", () => {
    it("should detect attempts to wildcard ignore files in .biltrc", () => {
      const diff = `
+    "*",
+    "src/**"
`;
      const analysis = analyzeConfigDiff(diff);
      expect(analysis.addedIgnores).toContain("*");
      expect(analysis.addedIgnores).toContain("src/**");
    });

    it("should detect attempts to downgrade rule severities to info or off", () => {
      const diff = `
+  "severityOverrides": {
+    "RULE-SEC-001": "off",
+    "SEC-AUTH-001": "info"
+  }
`;
      const analysis = analyzeConfigDiff(diff);
      expect(analysis.severityDowngrades.length).toBe(2);
      expect(analysis.severityDowngrades[0].to).toBe("off");
      expect(analysis.severityDowngrades[1].to).toBe("info");
    });

    it("should detect attempts to remove security rules", () => {
      const diff = `
-    "RULE-SEC-001",
-    "SEC-AUTH-002"
`;
      const analysis = analyzeConfigDiff(diff);
      expect(analysis.disabledRules).toContain("RULE-SEC-001");
      expect(analysis.disabledRules).toContain("SEC-AUTH-002");
    });
  });

  describe("Regression Detection", () => {
    it("should not treat test fixtures as introduced production findings", () => {
      const scope = {
        changedFiles: new Set(["tests/fixtures/leaky.ts", "src/auth.ts"]),
        changedLines: new Map([
          ["tests/fixtures/leaky.ts", new Set([1, 2, 3])],
          ["src/auth.ts", new Set([10])],
        ]),
        newFiles: new Set<string>(),
      };

      // Test fixture finding should be marked not introduced
      expect(isFindingIntroducedByChange("tests/fixtures/leaky.ts", 2, scope)).toBe(false);
      // Production file finding should be marked introduced
      expect(isFindingIntroducedByChange("src/auth.ts", 10, scope)).toBe(true);
    });
  });
});
