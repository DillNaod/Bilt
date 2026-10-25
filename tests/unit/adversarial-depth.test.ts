import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeScan } from "../../src/commands/scan.js";
import { runChecks } from "../../src/core/readiness/check-runner.js";
import { buildProjectModel } from "../../src/core/project-model/builder.js";
import { parseEnvFile } from "../../src/core/scan/env.js";
import { validateProjectDirectory, isPathContained } from "../../src/core/safety/index.js";
import { recordSessionIteration, getOrStartSession, resetSession } from "../../src/core/agent/session.js";
import { detectTampering, analyzeConfigDiff } from "../../src/core/trust/tamper.js";
import { stripAnsi } from "../../src/ui/theme.js";

describe("Adversarial Depth & Edge-Case Robustness", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-adversarial-depth-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("Empty Projects", () => {
    it("should handle empty project across model, scan, and readiness checks", async () => {
      const model = await buildProjectModel(tmpDir);
      expect(model.totalFilesScanned).toBe(0);
      expect(model.routes.length).toBe(0);
      expect(model.components.length).toBe(0);
      expect(model.framework).toBeUndefined();

      const scanResult = await executeScan(tmpDir, { silent: true });
      expect(scanResult.findings).toEqual([]);
      expect(scanResult.healthScore).toBe(100);
      expect(scanResult.grade).toBe("A+");

      const checkResult = await runChecks({ dir: tmpDir, format: "agent" });
      expect(checkResult).toBeDefined();
    });
  });

  describe("Malformed Files & Corrupt Syntax", () => {
    it("should handle unclosed multiline quotes and null bytes in .env files", () => {
      const corruptEnv = 'UNCLOSED="this quote is never closed\nNEXT_VAR=123\n\x00NULL_BYTE=bad\n=NO_KEY\n';
      const parsed = parseEnvFile(corruptEnv, ".env");
      expect(parsed.entries.size).toBeGreaterThanOrEqual(1);
    });

    it("should handle corrupt JSON in .biltrc.json and loop state gracefully", async () => {
      const biltDir = path.join(tmpDir, ".bilt");
      await fs.mkdir(biltDir, { recursive: true });
      await fs.writeFile(path.join(tmpDir, ".biltrc.json"), "{ invalid json: true, ");
      await fs.writeFile(path.join(biltDir, "loop.json"), "NOT JSON AT ALL!!!");

      const scanResult = await executeScan(tmpDir, { silent: true });
      expect(scanResult).toBeDefined();
      expect(scanResult.findings).toBeDefined();
    });

    it("should recover from a corrupt session.json in .bilt/state", async () => {
      const stateDir = path.join(tmpDir, ".bilt", "state");
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(path.join(stateDir, "session.json"), "{{{CORRUPT DATA");

      const session = await getOrStartSession(tmpDir);
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.iteration).toBe(0);
    });
  });

  describe("Large Files & File Size Bounds", () => {
    it("should safely skip files exceeding 1MB during secret scanning", async () => {
      // 1.5MB file containing a secret pattern
      const largeContent = "const apiKey = 'sk_live_" + "x".repeat(1_500_000) + "';\n";
      await fs.writeFile(path.join(tmpDir, "huge.ts"), largeContent);

      const scanResult = await executeScan(tmpDir, { silent: true });
      // The huge file is skipped due to the > 1MB safety guard
      const foundInHuge = scanResult.findings.some((f) => f.file === "huge.ts");
      expect(foundInHuge).toBe(false);
    });
  });

  describe("Binary Files & Hostile Content", () => {
    it("should safely process binary files (.png, .wasm, .bin) without encoding crash", async () => {
      const binaryPayload = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00]);
      await fs.writeFile(path.join(tmpDir, "app.bin"), binaryPayload);
      await fs.writeFile(path.join(tmpDir, "logo.png"), binaryPayload);

      const scanResult = await executeScan(tmpDir, { silent: true });
      expect(scanResult).toBeDefined();
    });

    it("should strip ANSI control sequences and terminal injection strings", () => {
      const hostileAnsi = "\x1b[31;1mINJECTION_ATTACK\x1b[0m \x1b]0;Evil Title\x07";
      const cleaned = stripAnsi(hostileAnsi);
      expect(cleaned).toContain("INJECTION_ATTACK");
      expect(cleaned).not.toContain("\x1b[31;1m");
    });
  });

  describe("Symlinks & Broken Symlinks", () => {
    it("should gracefully handle broken symlinks without crashing", async () => {
      const nonExistentTarget = path.join(tmpDir, "does-not-exist.ts");
      const brokenLink = path.join(tmpDir, "broken-symlink.ts");

      try {
        await fs.symlink(nonExistentTarget, brokenLink);
      } catch {
        return; // Skip on platforms without symlink permission
      }

      const scanResult = await executeScan(tmpDir, { silent: true });
      expect(scanResult).toBeDefined();
    });
  });

  describe("Path Traversal & Filesystem Containment", () => {
    it("should detect path traversal attempts escaping the project root", () => {
      expect(isPathContained(path.resolve(tmpDir, "../outside.txt"), tmpDir)).toBe(false);
      expect(isPathContained(path.resolve(tmpDir, "sub/deep/file.txt"), tmpDir)).toBe(true);
    });

    it("should throw error when validating nonexistent project directory", async () => {
      await expect(validateProjectDirectory("/path/that/definitely/does/not/exist/99999")).rejects.toThrow();
    });
  });

  describe("Loop Escalation & Regression Detection", () => {
    it("should escalate when findings remain unchanged for consecutive iterations", async () => {
      await resetSession(tmpDir);

      const findings = ["fp-security-leak-1", "fp-security-leak-2"];

      // Iteration 1
      const iter1 = await recordSessionIteration(tmpDir, findings, { noProgressThreshold: 3 });
      expect(iter1.escalation).toBeUndefined();

      // Iteration 2: same findings
      const iter2 = await recordSessionIteration(tmpDir, findings, { noProgressThreshold: 3 });
      expect(iter2.escalation).toBeUndefined();

      // Iteration 3: same findings -> exceeds threshold -> escalate!
      const iter3 = await recordSessionIteration(tmpDir, findings, { noProgressThreshold: 3 });
      expect(iter3.escalation).toBeDefined();
      expect(iter3.escalation?.reason).toBe("no-progress");
      expect(iter3.session.status).toBe("escalated");
    });

    it("should detect regression when a previously solved finding re-appears", async () => {
      await resetSession(tmpDir);

      const fpA = "fingerprint-issue-a";
      const fpB = "fingerprint-issue-b";

      // Iteration 1: fpA and fpB present
      await recordSessionIteration(tmpDir, [fpA, fpB]);

      // Iteration 2: fpA resolved! Only fpB remains
      const iter2 = await recordSessionIteration(tmpDir, [fpB]);
      expect(iter2.delta.resolved).toContain(fpA);
      expect(iter2.delta.regressions).toHaveLength(0);

      // Iteration 3: fpA re-appears (regression!)
      const iter3 = await recordSessionIteration(tmpDir, [fpA, fpB]);
      expect(iter3.delta.regressions).toContain(fpA);
      expect(iter3.session.regressions).toContain(fpA);
    });
  });

  describe("Configuration Tamper Detection", () => {
    it("should detect dangerous ignore rules and severity downgrades", () => {
      const maliciousDiff = `
+    "*",
+    "src/**",
+  "severityOverrides": {
+    "SEC-AUTH-001": "off"
+  }
`;
      const analysis = analyzeConfigDiff(maliciousDiff);
      expect(analysis.addedIgnores).toContain("*");
      expect(analysis.addedIgnores).toContain("src/**");
      expect(analysis.severityDowngrades.some((d) => d.ruleId === "SEC-AUTH-001" && d.to === "off")).toBe(true);
    });
  });
});
