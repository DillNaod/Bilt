import { describe, it, expect } from "vitest";
import { formatHumanOutput } from "../../src/core/readiness/formatters/human.js";
import { formatAgentDesignOutput } from "../../src/core/design/formatters/agent.js";
import { formatHumanDesignOutput } from "../../src/core/design/formatters/human.js";
import type { CheckResult } from "../../src/core/readiness/check-runner.js";
import type { DesignCheckResult } from "../../src/core/design/types.js";

describe("Formatters", () => {
  describe("Readiness Human Formatter (formatHumanOutput)", () => {
    it("formats production-ready result", () => {
      const result: CheckResult = {
        gate: {
          status: "production-ready",
          summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, needsReview: 0, acceptedRisk: 0 },
        },
        findings: [],
        coverage: {
          frameworks: [],
          routes: { resolved: 1, unresolved: 0, unresolvedReasons: [] },
          files: { parsed: 5, skipped: { "too-large": 0, binary: 0, "symlink-escape": 0, "depth-limit": 0, "parse-timeout": 0, ignored: 0, "limit-reached": 0 }, parseFailed: [] },
          dynamicConstructs: [],
          rules: [],
        },
        durationMs: 50,
      };

      const output = formatHumanOutput(result);
      expect(output).toContain("BILT PRODUCTION READINESS");
      expect(output).toContain("PRODUCTION READY");
      expect(output).toContain("All automated security checks passed");
      expect(output).toContain("automated readiness check, not a certified security audit");
    });

    it("formats not-ready-needs-review and blocking results with findings", () => {
      const result: CheckResult = {
        gate: {
          status: "not-ready-needs-review",
          summary: { critical: 1, high: 1, medium: 1, low: 0, info: 0, needsReview: 1, acceptedRisk: 0 },
        },
        findings: [
          {
            id: "F1",
            category: "secrets-and-env",
            ruleId: "SEC-001",
            title: "Hardcoded Stripe Key",
            severity: "critical",
            status: "fail",
            description: "A secret is hardcoded",
            file: "server.ts",
            line: 12,
            preview: "const key = 'sk_live_123'",
            suggestedAction: "Move to .env",
          },
          {
            id: "F2",
            category: "auth",
            ruleId: "AUTH-001",
            title: "Missing Auth Middleware",
            severity: "high",
            status: "fail",
            description: "Route lacks auth",
            file: "src/api.ts",
            line: 45,
            suggestedAction: "Add authenticate() middleware",
          },
          {
            id: "F3",
            category: "monitoring-rollback",
            ruleId: "OBS-001",
            title: "Error Monitoring Setup",
            severity: "medium",
            status: "needs-review",
            description: "No Sentry found",
            suggestedAction: "Configure error reporting",
          },
        ],
        coverage: {
          frameworks: [],
          routes: { resolved: 0, unresolved: 0, unresolvedReasons: [] },
          files: { parsed: 0, skipped: { "too-large": 0, binary: 0, "symlink-escape": 0, "depth-limit": 0, "parse-timeout": 0, ignored: 0, "limit-reached": 0 }, parseFailed: [] },
          dynamicConstructs: [],
          rules: [],
        },
        durationMs: 120,
      };

      const output = formatHumanOutput(result);
      expect(output).toContain("NOT READY (NEEDS REVIEW)");
      expect(output).toContain("CRITICAL (1)");
      expect(output).toContain("Hardcoded Stripe Key");
      expect(output).toContain("HIGH (1)");
      expect(output).toContain("Missing Auth Middleware");
      expect(output).toContain("NEEDS REVIEW (1)");
    });
  });

  describe("Design Check Human Formatter (formatHumanDesignOutput)", () => {
    it("formats pass status", () => {
      const result: DesignCheckResult = {
        status: "pass",
        findings: [],
        summary: { high: 0, medium: 0, low: 0, total: 0 },
        fixedCount: 2,
        suppressed: [{ ruleId: "DESIGN-001", title: "Test", reason: "Brand requirement" }],
      };

      const output = formatHumanDesignOutput(result);
      expect(output).toContain("All clear");
      expect(output).toContain("applied 2 safe fix(es)");
      expect(output).toContain("Suppressed findings");
    });

    it("formats escalate status", () => {
      const result: DesignCheckResult = {
        status: "escalate",
        findings: [],
        summary: { high: 1, medium: 0, low: 0, total: 1 },
        escalationMessage: "Stuck in 3 consecutive identical loops",
      };

      const output = formatHumanDesignOutput(result);
      expect(output).toContain("ESCALATE (EXIT CODE 4)");
      expect(output).toContain("Stuck in 3 consecutive identical loops");
    });

    it("formats findings with high and medium severities", () => {
      const result: DesignCheckResult = {
        status: "needs_review",
        findings: [
          {
            id: "D1",
            ruleId: "DESIGN-001",
            title: "Uniform Card Grid",
            severity: "high",
            confidence: "high",
            category: "layout",
            file: "src/Home.tsx",
            line: 25,
            message: "Cards are visually identical",
            suggestedFix: "Vary card emphasis",
            locations: [{ file: "src/Home.tsx", line: 25 }],
            evidence: ["3 identical card elements detected"],
            fingerprint: "fp-12345678",
          },
        ],
        summary: { high: 1, medium: 0, low: 0, total: 1 },
      };

      const output = formatHumanDesignOutput(result);
      expect(output).toContain("Needs Improvement");
      expect(output).toContain("[HIGH]");
      expect(output).toContain("Uniform Card Grid");
      expect(output).toContain("3 identical card elements");
    });
  });

  describe("Design Check Agent Formatter (formatAgentDesignOutput)", () => {
    it("formats agent output without design brief (checkpoint prompt)", () => {
      const result: DesignCheckResult = {
        status: "needs_review",
        findings: [
          {
            id: "D1",
            ruleId: "DESIGN-001",
            title: "Template Tropes",
            severity: "high",
            confidence: "high",
            category: "visual",
            file: "src/App.tsx",
            line: 10,
            message: "Generic SaaS hero",
            suggestedFix: "Use domain authentic hierarchy",
            evidence: ["hero pattern"],
            fingerprint: "fp-87654321",
          },
        ],
        summary: { high: 1, medium: 0, low: 0, total: 1 },
      };

      const formatted: any = formatAgentDesignOutput(result, { hasDesignBrief: false });
      expect(formatted.schemaVersion).toBe("1");
      expect(formatted.status).toBe("needs_review");
      expect(formatted.nextAction.type).toBe("fix");
      expect(formatted.nextAction.instruction).toContain("MANDATORY DESIGN INTENT CHECKPOINT");
    });

    it("formats agent output with design brief configured", () => {
      const result: DesignCheckResult = {
        status: "pass",
        findings: [],
        summary: { high: 0, medium: 0, low: 0, total: 0 },
      };

      const formatted: any = formatAgentDesignOutput(result, { hasDesignBrief: true });
      expect(formatted.status).toBe("pass");
      expect(formatted.nextAction.type).toBe("stop");
    });

    it("formats agent output on escalate status", () => {
      const result: DesignCheckResult = {
        status: "escalate",
        findings: [],
        summary: { high: 0, medium: 0, low: 0, total: 0 },
        escalationMessage: "Consecutive identical attempts",
      };

      const formatted: any = formatAgentDesignOutput(result, { hasDesignBrief: true });
      expect(formatted.status).toBe("escalate");
      expect(formatted.nextAction.type).toBe("escalate");
    });
  });
});
