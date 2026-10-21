import { describe, it, expect } from "vitest";
import { runRules } from "../../src/core/rules/engine.js";
import { createQueryFacade } from "../../src/core/model/query-facade.js";
import type { ProjectModel } from "../../src/core/model/project-model.js";
import { confirmed, unknown } from "../../src/core/facts/fact.js";
import { registerRule, clearRulesForTesting } from "../../src/core/rules/registry.js";

describe("L7 Rule Execution Engine (runRules)", () => {
  const baseModel: ProjectModel = {
    rootDir: "/test",
    files: [],
    dependencies: [],
    routes: [],
    components: [],
    componentGraph: [],
    apiEndpoints: [],
    entities: [],
    claims: [],
    auth: { detected: false, providers: [], hasMiddleware: false },
    authorization: { detected: false, hasRoleChecks: false, unprotectedRoutesCount: 0 },
    database: { detected: false, hasDirectQueries: false },
    environment: { envFiles: [], missingVarsCount: 0 },
    requirements: [],
    archetype: confirmed("saas-dashboard"),
    coverage: {
      frameworks: [],
      routes: { resolved: 0, unresolved: 0, unresolvedReasons: [] },
      files: { parsed: 0, skipped: { "too-large": 0, binary: 0, "symlink-escape": 0, "depth-limit": 0, "parse-timeout": 0, ignored: 0, "limit-reached": 0 }, parseFailed: [] },
      dynamicConstructs: [],
      rules: [],
    },
    timestamp: new Date().toISOString(),
  };

  it("filters rules via opts.only", () => {
    const Q = createQueryFacade(baseModel);
    const result = runRules(Q, { only: ["NON-EXISTENT-RULE"] });
    expect(result.findings).toHaveLength(0);
    expect(result.coverage).toHaveLength(0);
  });

  it("handles experimental rules when flag is enabled or disabled", () => {
    const testExpRule = {
      id: "RULE-TEST-EXP-001",
      domain: "security" as const,
      category: "auth" as const,
      severity: "low" as const,
      precision: "high" as const,
      maturity: "experimental" as const,
      detect: () => [],
    };

    registerRule(testExpRule);

    const Q = createQueryFacade(baseModel);

    // Disabled experimental flag
    const resDisabled = runRules(Q, { only: ["RULE-TEST-EXP-001"], experimental: false });
    expect(resDisabled.coverage.some((c) => c.id === "RULE-TEST-EXP-001" && c.status === "disabled")).toBe(true);

    // Enabled experimental flag
    const resEnabled = runRules(Q, { only: ["RULE-TEST-EXP-001"], experimental: true });
    expect(resEnabled.coverage.some((c) => c.id === "RULE-TEST-EXP-001" && c.status === "ran")).toBe(true);
  });

  it("degrades rules when required rendered facts or unknown facts are encountered", () => {
    const testRenderedRule = {
      id: "RULE-TEST-RENDERED-001",
      domain: "design" as const,
      category: "visual" as const,
      severity: "low" as const,
      precision: "high" as const,
      maturity: "stable" as const,
      needs: "rendered" as const,
      detect: () => [],
    };

    const testUnknownFactRule = {
      id: "RULE-TEST-UNKNOWN-FACT-001",
      domain: "security" as const,
      category: "auth" as const,
      severity: "medium" as const,
      precision: "high" as const,
      maturity: "stable" as const,
      requiredFacts: () => [unknown({ kind: "parse-failed", at: { file: "broken.ts" } })],
      detect: () => [],
    };

    registerRule(testRenderedRule);
    registerRule(testUnknownFactRule);

    const Q = createQueryFacade(baseModel);
    const result = runRules(Q, {
      only: ["RULE-TEST-RENDERED-001", "RULE-TEST-UNKNOWN-FACT-001"],
    });

    const renderedCov = result.coverage.find((c) => c.id === "RULE-TEST-RENDERED-001");
    expect(renderedCov?.status).toBe("degraded");
    expect(renderedCov?.because).toContain("rendered pass unavailable");

    const unknownCov = result.coverage.find((c) => c.id === "RULE-TEST-UNKNOWN-FACT-001");
    expect(unknownCov?.status).toBe("degraded");
    expect(unknownCov?.because).toContain("parse-failed at broken.ts");
  });

  it("finalizes findings with default agentAction and fingerprint", () => {
    const testFindingRule = {
      id: "RULE-TEST-FINDING-001",
      domain: "security" as const,
      category: "auth" as const,
      severity: "critical" as const,
      precision: "high" as const,
      maturity: "stable" as const,
      detect: () => [
        {
          ruleId: "RULE-TEST-FINDING-001",
          title: "Test Security Finding",
          description: "Something is insecure",
          category: "auth" as const,
          locations: [{ file: "src/auth.ts", line: 15 }],
        } as any,
      ],
    };

    registerRule(testFindingRule);

    const Q = createQueryFacade(baseModel);
    const result = runRules(Q, { only: ["RULE-TEST-FINDING-001"] });

    expect(result.findings).toHaveLength(1);
    const f = result.findings[0]!;
    expect(f.severity).toBe("critical");
    expect(f.fingerprint).toBeDefined();
    expect(f.agentAction).toBeDefined();
    expect(f.agentAction?.objective).toContain("RULE-TEST-FINDING-001");
  });
});
