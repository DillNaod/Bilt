import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { applyOverridesAndFilter } from "../../src/commands/scan/filter.js";
import { reportScanResult, type ReportScanOptions } from "../../src/commands/scan/reporter.js";
import { runPluginsStep } from "../../src/commands/scan/steps/plugins.js";
import type { ScanFinding, ScanResult } from "../../src/types/index.js";
import { DEFAULT_CONFIG } from "../../src/config/config.js";

describe("Scan Orchestration, Reporter & Filter Depth", () => {
  let tmpDir: string;
  let logs: string[] = [];
  const origLog = console.log;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-scan-depth-"));
    logs = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
    process.exitCode = undefined;
  });

  afterEach(async () => {
    console.log = origLog;
    process.exitCode = undefined;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("applyOverridesAndFilter", () => {
    const sampleFindings: ScanFinding[] = [
      { id: "1", file: "a.ts", category: "secret-detected", severity: "critical", message: "m1", ruleId: "SEC-001" },
      { id: "2", file: "b.ts", category: "env-missing", severity: "warning", message: "m2", ruleId: "ENV-001" },
      { id: "3", file: "c.ts", category: "design-system", severity: "info", message: "m3", ruleId: "DS-001" },
    ];

    it("should apply configuration severity overrides by ruleId", () => {
      const config = {
        severityOverrides: {
          "ENV-001": "critical",
          "SEC-001": "warning",
        },
      };

      const result = applyOverridesAndFilter([...sampleFindings], config);
      expect(result.find((f) => f.ruleId === "ENV-001")?.severity).toBe("critical");
      expect(result.find((f) => f.ruleId === "SEC-001")?.severity).toBe("warning");
    });

    it("should filter findings by minimum severity 'critical'", () => {
      const result = applyOverridesAndFilter([...sampleFindings], {}, "critical");
      expect(result.length).toBe(1);
      expect(result[0]!.severity).toBe("critical");
    });

    it("should filter findings by minimum severity 'warning'", () => {
      const result = applyOverridesAndFilter([...sampleFindings], {}, "warning");
      expect(result.length).toBe(2);
      expect(result.every((f) => f.severity === "critical" || f.severity === "warning")).toBe(true);
    });

    it("should include all findings when minimum severity is 'info'", () => {
      const result = applyOverridesAndFilter([...sampleFindings], {}, "info");
      expect(result.length).toBe(3);
    });

    it("should return findings unchanged when no overrides or minSeverity provided", () => {
      const result = applyOverridesAndFilter([...sampleFindings], {});
      expect(result.length).toBe(3);
    });
  });

  describe("reportScanResult Formats & Exit Codes", () => {
    const makeResult = (findings: ScanFinding[]): ScanResult => ({
      findings,
      healthScore: findings.some((f) => f.severity === "critical") ? 50 : 100,
      grade: findings.some((f) => f.severity === "critical") ? "C" : "A+",
      stats: { totalFiles: 10, totalChecks: 25 },
      frameworks: ["express"],
      envSummary: { totalKeys: 5, missingKeys: 0 },
    });

    it("should format as agent JSON and set clean exit code (0) on passing scan", async () => {
      const result = makeResult([]);
      const opts: ReportScanOptions = {
        result,
        findings: [],
        options: { format: "agent" },
        config: DEFAULT_CONFIG,
        rootDir: tmpDir,
        isJson: false,
        isQuiet: false,
        isSilent: false,
      };

      await reportScanResult(opts);
      const jsonLog = logs.find((l) => l.trim().startsWith("{"));
      expect(jsonLog).toBeDefined();

      const parsed = JSON.parse(jsonLog!);
      expect(parsed.schema_version).toBe("1.0.0");
      expect(parsed.status).toBe("pass");
      expect(process.exitCode).toBe(0);
    });

    it("should format as agent JSON and set failure exit code (1) when critical high-precision stable findings exist", async () => {
      const findings: ScanFinding[] = [
        {
          id: "sec-1",
          file: "src/secret.ts",
          category: "secret-detected",
          ruleId: "RULE-SEC-001",
          severity: "critical",
          message: "Stripe leak",
        },
      ];
      const result = makeResult(findings);
      const opts: ReportScanOptions = {
        result,
        findings,
        options: { format: "agent" },
        config: DEFAULT_CONFIG,
        rootDir: tmpDir,
        isJson: false,
        isQuiet: false,
        isSilent: false,
      };

      await reportScanResult(opts);
      const jsonLog = logs.find((l) => l.trim().startsWith("{"));
      const parsed = JSON.parse(jsonLog!);
      expect(parsed.status).toBe("fail");
      expect(process.exitCode).toBe(1);
    });

    it("should format as agent JSON and set review exit code (2) for medium-precision findings", async () => {
      const findings: ScanFinding[] = [
        {
          id: "idor-1",
          file: "src/api.ts",
          category: "api-scan",
          severity: "warning",
          precision: "medium",
          maturity: "experimental",
          message: "Potential IDOR parameter query",
        },
      ];
      const result = makeResult(findings);
      const opts: ReportScanOptions = {
        result,
        findings,
        options: { format: "agent" },
        config: DEFAULT_CONFIG,
        rootDir: tmpDir,
        isJson: false,
        isQuiet: false,
        isSilent: false,
      };

      await reportScanResult(opts);
      const jsonLog = logs.find((l) => l.trim().startsWith("{"));
      const parsed = JSON.parse(jsonLog!);
      expect(parsed.status).toBe("needs_review");
      expect(process.exitCode).toBe(2);
    });

    it("should format as valid SARIF 2.1.0 JSON and set exit code", async () => {
      const findings: ScanFinding[] = [
        { id: "sec-sarif", file: "src/leak.ts", category: "secret-detected", severity: "critical", message: "API key leaked" },
      ];
      const result = makeResult(findings);
      const opts: ReportScanOptions = {
        result,
        findings,
        options: { format: "sarif" },
        config: DEFAULT_CONFIG,
        rootDir: tmpDir,
        isJson: false,
        isQuiet: false,
        isSilent: false,
      };

      await reportScanResult(opts);
      const jsonLog = logs.find((l) => l.includes('"version": "2.1.0"'));
      expect(jsonLog).toBeDefined();

      const parsed = JSON.parse(jsonLog!);
      expect(parsed.version).toBe("2.1.0");
      expect(parsed.runs.length).toBeGreaterThan(0);
      expect(process.exitCode).toBe(1);
    });

    it("should format as raw JSON when format: 'json' or isJson is true", async () => {
      const result = makeResult([]);
      const opts: ReportScanOptions = {
        result,
        findings: [],
        options: {},
        config: DEFAULT_CONFIG,
        rootDir: tmpDir,
        isJson: true,
        isQuiet: false,
        isSilent: false,
      };

      await reportScanResult(opts);
      const jsonLog = logs.find((l) => l.trim().startsWith("{"));
      const parsed = JSON.parse(jsonLog!);
      expect(parsed.healthScore).toBe(100);
      expect(parsed.grade).toBe("A+");
    });

    it("should render quiet mode without stdout output and set exit code on critical findings", async () => {
      const findings: ScanFinding[] = [
        { id: "sec-quiet", file: "src/leak.ts", category: "secret-detected", severity: "critical", message: "Secret" },
      ];
      const result = makeResult(findings);
      const opts: ReportScanOptions = {
        result,
        findings,
        options: {},
        config: DEFAULT_CONFIG,
        rootDir: tmpDir,
        isJson: false,
        isQuiet: true,
        isSilent: false,
      };

      await reportScanResult(opts);
      expect(logs.length).toBe(0);
      expect(process.exitCode).toBe(1);
    });

    it("should render human summary with issue counts when not silent", async () => {
      const findings: ScanFinding[] = [
        { id: "w-1", file: "app.ts", category: "env-missing", severity: "warning", message: "Var missing" },
      ];
      const result = makeResult(findings);
      const opts: ReportScanOptions = {
        result,
        findings,
        options: { details: false },
        config: DEFAULT_CONFIG,
        rootDir: tmpDir,
        isJson: false,
        isQuiet: false,
        isSilent: false,
      };

      await reportScanResult(opts);
      expect(logs.join("\n")).toContain("1 issue");
      expect(logs.join("\n")).toContain("bilt fix");
    });
  });

  describe("runPluginsStep", () => {
    it("should return empty findings when no custom plugins are configured", async () => {
      const findings = await runPluginsStep({
        rootDir: tmpDir,
        config: DEFAULT_CONFIG,
        options: {},
      });

      expect(Array.isArray(findings)).toBe(true);
      expect(findings).toHaveLength(0);
    });

    it("should safely handle plugin check exceptions without crashing", async () => {
      const customConfig = {
        ...DEFAULT_CONFIG,
        plugins: ["non-existent-plugin-module-404"],
      };

      const findings = await runPluginsStep({
        rootDir: tmpDir,
        config: customConfig,
        options: {},
      });

      expect(Array.isArray(findings)).toBe(true);
      expect(findings).toHaveLength(0);
    });
  });
});
