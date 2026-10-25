import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeDoctor, getOWASPMapping } from "../../../src/commands/doctor.js";
import { executeCheck } from "../../../src/commands/check.js";
import type { ScanFinding } from "../../../src/types/index.js";

describe("Commands: doctor and check", () => {
  let tmpDir: string;
  let logs: string[] = [];
  const origLog = console.log;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-doc-check-"));
    logs = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
  });

  afterEach(async () => {
    console.log = origLog;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("executeDoctor", () => {
    it("should run health doctor on clean project and print report", async () => {
      await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({ name: "doc-test", version: "1.0.0" }));
      await executeDoctor(tmpDir);

      const output = logs.join("\n");
      expect(output).toContain("Repository Health Report");
      expect(output).toContain("Secret Detection");
      expect(output).toContain("Dependencies");
    });

    it("should generate health card image when card option is enabled", async () => {
      await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({ name: "card-app" }));
      await executeDoctor(tmpDir, { card: true });

      const cardPngExists = await fs.access(path.join(tmpDir, "bilt-health-card.png")).then(() => true).catch(() => false);
      const cardSvgExists = await fs.access(path.join(tmpDir, "bilt-health-card.svg")).then(() => true).catch(() => false);
      expect(cardPngExists || cardSvgExists).toBe(true);
    });

    it("should map various finding categories to OWASP Top 10 categories", () => {
      const secretFinding: ScanFinding = {
        id: "1",
        category: "secret-detected",
        severity: "critical",
        message: "Secret found",
        file: "a.ts",
      };
      expect(getOWASPMapping(secretFinding).id).toBe("A02:2021");

      const apiFinding: ScanFinding = {
        id: "2",
        category: "api-mass-assignment",
        severity: "critical",
        message: "Mass assignment",
        file: "b.ts",
      };
      expect(getOWASPMapping(apiFinding).id).toBe("A01:2021");

      const depFinding: ScanFinding = {
        id: "3",
        category: "dep-vulnerable",
        severity: "warning",
        message: "Old dep",
        file: "package.json",
      };
      expect(getOWASPMapping(depFinding).id).toBe("A06:2021");
    });
  });

  describe("executeCheck", () => {
    it("should execute readiness check in agent format and return exit code 1 on blocking missing lockfile", async () => {
      await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test-app", version: "1.0.0" }));

      const code = await executeCheck(tmpDir, { format: "agent" });
      expect(code).toBe(1);

      const parsed = JSON.parse(logs.join("\n"));
      expect(parsed.schemaVersion).toBe("1");
      expect(parsed.status).toBe("fail");
      expect(parsed.allowedToContinue).toBe(false);
      expect(parsed.findings.some((f: any) => f.title.includes("lockfile"))).toBe(true);
    });

    it("should filter checks by category when categories option is provided", async () => {
      await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test-app" }));
      await fs.writeFile(path.join(tmpDir, "package-lock.json"), "{}");

      logs = [];
      const code = await executeCheck(tmpDir, {
        format: "agent",
        categories: "secrets-and-env",
      });

      const parsed = JSON.parse(logs.join("\n"));
      expect(code).toBe(0);
      expect(parsed.status).toBe("pass");
      expect(parsed.findings.every((f: any) => f.category === "secrets-and-env")).toBe(true);
    });
  });
});
