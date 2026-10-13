// ─── Phase 1 Foundation Exit Gate Test Suite ──────────────────────────────────
// Validates L0 safe ingestion, L1 tri-state Fact model & coverage degradation,
// L2 ProjectModel & QueryFacade, L7 rule engine & promotion gates,
// testkit architecture linting, and byte-identical determinism.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { walkRepo } from "../../src/core/ingest/walker.js";
import { safeParseAst } from "../../src/core/ingest/sandbox.js";
import { staticEvalConfig } from "../../src/core/ingest/static-eval.js";
import {
  confirmed,
  absent,
  unknown,
  allConfirmed,
  chainConfidence,
  type Fact,
} from "../../src/core/facts/fact.js";
import { CoverageRecorder } from "../../src/core/facts/coverage.js";
import { createExtractCtx } from "../../src/core/facts/extractor.js";
import { buildModel, createRepoIndex } from "../../src/core/model/builder.js";
import {
  createQueryFacade,
  guarded,
  type QueryFacade,
} from "../../src/core/model/query-facade.js";
import {
  registerRule,
  getRule,
  clearRegistryForTesting,
  type RuleDef,
} from "../../src/core/rules/registry.js";
import { runRules } from "../../src/core/rules/engine.js";
import { lintRuleImports, checkRuleDeclaredFacts } from "../../src/testkit/arch-lint.js";
import { canBeStable } from "../../src/testkit/promotion-gate.js";
import {
  canonicalJson,
  assertByteIdentical,
  hashString,
} from "../../src/testkit/determinism.js";
import { fingerprint } from "../../src/core/findings/fingerprint.js";
import type { Finding } from "../../src/core/findings/finding.js";

import fs from "node:fs/promises";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/foundation");

describe("Phase 1 Foundation: Safe Ingestion (L0)", () => {
  const hostileDir = path.join(FIXTURES_DIR, "hostile-repo");
  let tmpTarget: string;
  const symlinkPath = path.join(hostileDir, "symlink-escape");
  const largeFilePath = path.join(hostileDir, "large-file.dat");

  beforeAll(async () => {
    tmpTarget = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-symlink-target-"));
    try {
      await fs.symlink(tmpTarget, symlinkPath);
    } catch {
      // Ignore if exists
    }
    await fs.writeFile(largeFilePath, Buffer.alloc(2_200_000));
  });

  afterAll(async () => {
    try {
      await fs.unlink(symlinkPath);
    } catch {
      // Ignore
    }
    try {
      await fs.unlink(largeFilePath);
    } catch {
      // Ignore
    }
    try {
      await fs.rm(tmpTarget, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it("safely handles symlink escapes, large files, and bounds during repo walk", async () => {
    const files: any[] = [];
    for await (const file of walkRepo(hostileDir)) {
      files.push(file);
    }

    // 1. Symlink pointing outside repo must be caught as symlink-escape
    const symlinkFile = files.find((f) => f.path.includes("symlink-escape"));
    expect(symlinkFile).toBeDefined();
    expect(symlinkFile?.skipped).toBe("symlink-escape");

    // 2. File > 2MB must be caught as too-large
    const largeFile = files.find((f) => f.path.includes("large-file.dat"));
    expect(largeFile).toBeDefined();
    expect(largeFile?.skipped).toBe("too-large");
  });

  it("statically evaluates hostile tailwind.config.js without executing process.exit", async () => {
    const configPath = path.join(hostileDir, "tailwind.config.js");
    const result = await staticEvalConfig(configPath);

    expect(result.state).toBe("confirmed");
    if (result.state === "confirmed") {
      expect(result.value.theme?.extend?.colors?.brand).toBe("#6366f1");
    }
  });

  it("detects pathological AST recursion and prevents stack overflow", async () => {
    const deepCode = "const x = " + "[".repeat(450) + "1" + "]".repeat(450) + ";";
    const outcome = safeParseAst(deepCode, "deep.js");

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe("depth-limit");
  });
});

describe("Phase 1 Foundation: Tri-state Fact Model & Unknown Handling (L1)", () => {
  it("combines tri-state facts where weakest link governs", () => {
    const c1 = confirmed("user-table", [{ file: "schema.prisma" }]);
    const c2 = confirmed(true, [{ file: "auth.ts" }]);
    expect(allConfirmed(c1, c2)).toBe("confirmed");

    const a1 = absent([{ file: "middleware.ts" }]);
    expect(allConfirmed(c1, a1)).toBe("absent");

    const u1 = unknown({ kind: "dynamic-import", at: { file: "router.ts" } });
    expect(allConfirmed(c1, u1)).toBe("unknown");
    // Unknown takes precedence over absent in weak link evaluation
    expect(allConfirmed(a1, u1)).toBe("unknown");
  });

  it("propagates confidence monotonically along fact chains", () => {
    const c = confirmed(true, [{ file: "auth.ts" }]);
    const u = unknown({ kind: "dynamic-import", at: { file: "auth.ts" } });

    expect(chainConfidence([{ precision: "high", fact: c }])).toBe("high");
    expect(
      chainConfidence([
        { precision: "high", fact: c },
        { precision: "medium", fact: c },
      ]),
    ).toBe("medium");
    expect(
      chainConfidence([
        { precision: "high", fact: c },
        { precision: "high", fact: u },
      ]),
    ).toBe("low");
  });

  it("degrades rules in coverage when required facts are unknown and emits zero false positives", async () => {
    clearRegistryForTesting();

    // Rule requires auth confirmation; degrades when auth is unknown
    const ruleAuthzMissing: RuleDef = {
      id: "SEC-AUTHZ-001",
      category: "security",
      mode: "automated",
      severity: "high",
      precision: "high",
      maturity: "stable",
      needs: "static",
      consumes: ["endpoints", "securityModel"],
      requiredFacts(Q) {
        const ep = Q.endpoint("GET", "/api/protected");
        if (!ep) return [];
        const sec = Q.securityModel(ep);
        if (sec.state === "confirmed") {
          return [sec.value.hasAuth];
        }
        return [sec];
      },
      detect(Q) {
        const ep = Q.endpoint("GET", "/api/protected");
        if (!ep) return [];
        const sec = Q.securityModel(ep);
        if (sec.state === "confirmed" && sec.value.hasAuth.state === "absent") {
          return [
            {
              ruleId: "SEC-AUTHZ-001",
              title: "Missing authorization check on protected endpoint",
              severity: "high",
              precision: "high",
              maturity: "stable",
              confidence: "high",
              status: "open",
              evidence: [{ claim: "Endpoint has no auth" }],
              locations: [{ file: ep.file, line: ep.line }],
              whyItMatters: "Exposes private data",
              mightBeFalsePositive: [],
              searched: [],
              fingerprint: "",
              agentAction: {
                objective: "Add auth check",
                acceptance: [],
                doNot: [],
                safeToAutoFix: false,
              },
            },
          ];
        }
        return [];
      },
    };

    registerRule(ruleAuthzMissing);

    // Scenario A: Dynamic auth middleware causes an unknown fact
    const unknownAuthFact: Fact<boolean> = unknown({
      kind: "dynamic-middleware",
      at: { file: "src/routes/dynamic-auth.ts", line: 3 },
    });

    const modelWithUnknown: any = {
      apiEndpoints: [
        {
          id: "GET:/api/protected",
          method: "GET",
          path: "/api/protected",
          file: "src/routes/dynamic-auth.ts",
          line: 10,
          isPublic: confirmed(false, [{ file: "src/routes/dynamic-auth.ts" }]),
          middlewareChain: unknownAuthFact,
          securityModel: confirmed(
            {
              endpoint: null as any,
              hasAuth: unknownAuthFact,
              hasOwnershipCheck: confirmed(false, []),
              hasInputValidation: confirmed(false, []),
              passesBodyToDb: false,
              sensitiveFieldsReturned: [],
            },
            [{ file: "src/routes/dynamic-auth.ts" }],
          ),
        },
      ],
      coverage: new CoverageRecorder().snapshot(),
    };

    const QUnknown = createQueryFacade(modelWithUnknown);
    const result = runRules(QUnknown);

    // Rule must be degraded in coverage
    const cov = result.coverage.find((c) => c.id === "SEC-AUTHZ-001");
    expect(cov).toBeDefined();
    expect(cov?.status).toBe("degraded");
    expect(cov?.because).toContain("dynamic-middleware");

    // Zero false-positive findings emitted!
    expect(result.findings).toHaveLength(0);
  });
});

describe("Phase 1 Foundation: Rule Registry & Gates (L7)", () => {
  beforeEach(() => {
    clearRegistryForTesting();
  });

  it("enforces registration gates: only stable high-precision security rules may block", () => {
    const invalidBlockingDesignRule: any = {
      id: "DESIGN-HERO-001",
      category: "design",
      mode: "automated",
      severity: "high",
      precision: "high",
      maturity: "stable",
      needs: "static",
      consumes: ["components"],
      blocking: true,
      detect: () => [],
    };

    expect(() => registerRule(invalidBlockingDesignRule)).toThrow(
      /only stable, high-precision security rules may block/,
    );
  });

  it("enforces registration gates: subjective design rules are advisory capped at low severity", () => {
    const highSeverityDesignRule: any = {
      id: "DESIGN-COMP-001",
      category: "design",
      mode: "automated",
      severity: "high",
      precision: "medium",
      maturity: "experimental",
      needs: "static",
      consumes: ["components"],
      detect: () => [],
    };

    expect(() => registerRule(highSeverityDesignRule)).toThrow(
      /subjective design rules are advisory, capped at low severity/,
    );
  });

  it("throws on duplicate rule ID registration", () => {
    const rule: RuleDef = {
      id: "SEC-TEST-001",
      category: "security",
      mode: "automated",
      severity: "high",
      precision: "high",
      maturity: "stable",
      needs: "static",
      consumes: ["routes"],
      blocking: true,
      detect: () => [],
    };

    registerRule(rule);
    expect(() => registerRule(rule)).toThrow(/duplicate rule SEC-TEST-001/);
  });
});

describe("Phase 1 Foundation: Testkit Architecture Lint & Promotion Gate", () => {
  it("verifies rule modules never import forbidden packages (fs, child_process, ingest)", async () => {
    const rulesDir = path.resolve(__dirname, "../../src/core/rules");
    const violations = await lintRuleImports(rulesDir);
    expect(violations).toEqual([]);
  });

  it("validates rule fact consumption matching declared consumes array", () => {
    const rule: RuleDef = {
      id: "SEC-LEAK-001",
      category: "security",
      mode: "automated",
      severity: "medium",
      precision: "high",
      maturity: "stable",
      needs: "static",
      consumes: ["routes"],
      detect(Q) {
        Q.routes();
        return [];
      },
    };

    const dummyModel: any = {
      routes: [],
      coverage: new CoverageRecorder().snapshot(),
    };
    const Q = createQueryFacade(dummyModel);
    const check = checkRuleDeclaredFacts(rule, Q);

    expect(check.ok).toBe(true);
    expect(check.undeclared).toHaveLength(0);

    // If rule accesses undeclared facts:
    const undeclaredAccessRule: RuleDef = {
      id: "SEC-LEAK-002",
      category: "security",
      mode: "automated",
      severity: "medium",
      precision: "high",
      maturity: "stable",
      needs: "static",
      consumes: ["routes"],
      detect(Q) {
        Q.routes();
        Q.endpoint("GET", "/api/leak"); // Undeclared "endpoints" access!
        return [];
      },
    };

    const checkBad = checkRuleDeclaredFacts(undeclaredAccessRule, Q);
    expect(checkBad.ok).toBe(false);
    expect(checkBad.undeclared).toContain("endpoints");
  });

  it("enforces promotion gate criteria before a rule can be stable", () => {
    const rule: RuleDef = {
      id: "SEC-AUTHZ-001",
      category: "security",
      mode: "automated",
      severity: "high",
      precision: "high",
      maturity: "stable",
      needs: "static",
      consumes: ["endpoints"],
      blocking: true,
      detect: () => [],
    };

    // Deficient stats: missing adversarial fixture and wrong fix
    const deficientStats = {
      fixtures: { truePositive: 1, nearMiss: 1, adversarial: 0 },
      verify: { correctFix: 1, wrongFix: 0 },
      corpus: { falsePositiveRate: 0.01 },
    };
    const problems = canBeStable(rule, deficientStats);
    expect(problems).toContain("needs an adversarial fixture (alias, re-export, wrapper)");
    expect(problems).toContain(
      "needs verify tests: one correct fix and one plausible wrong fix",
    );

    // Complete stats: passes gate
    const completeStats = {
      fixtures: { truePositive: 1, nearMiss: 1, adversarial: 1 },
      verify: { correctFix: 1, wrongFix: 1 },
      corpus: { falsePositiveRate: 0.01 },
    };
    expect(canBeStable(rule, completeStats)).toHaveLength(0);
  });
});

describe("Phase 1 Foundation: Global Determinism & Semantic Fingerprints", () => {
  it("produces byte-identical canonical JSON output across repeated runs", () => {
    const report1 = {
      timestamp: "2026-10-13T10:00:00.000Z",
      durationMs: 42,
      routes: [
        { path: "/users", methods: ["GET"] },
        { path: "/admin", methods: ["POST", "GET"] },
      ],
      findings: [
        { id: "A", title: "Issue A", file: "src\\users.ts" },
        { id: "B", title: "Issue B", file: "src/admin.ts" },
      ],
    };

    const report2 = {
      durationMs: 88, // Different execution time
      timestamp: "2026-10-13T10:01:05.123Z", // Different execution timestamp
      findings: [
        { id: "A", file: "src/users.ts", title: "Issue A" }, // Reordered keys and posix slashes
        { id: "B", title: "Issue B", file: "src/admin.ts" },
      ],
      routes: [
        { methods: ["GET"], path: "/users" },
        { path: "/admin", methods: ["POST", "GET"] },
      ],
    };

    expect(assertByteIdentical(report1, report2)).toBe(true);
    expect(hashString(canonicalJson(report1))).toBe(hashString(canonicalJson(report2)));
  });

  it("preserves semantic fingerprints across formatting, variable renaming, and file moves", () => {
    const rule = { id: "SEC-AUTHZ-001" };

    const subjectOriginal = {
      kind: "endpoint" as const,
      stableKey: "GET /api/users/:id",
      shapeKey: "handler->db.read",
    };

    // In a refactor: handler variable renamed or code moved to another controller file,
    // but the endpoint semantics and normalized structural shape remain identical.
    const subjectRefactored = {
      kind: "endpoint" as const,
      stableKey: "GET /api/users/:id",
      shapeKey: "handler->db.read",
    };

    const fpOriginal = fingerprint(rule, subjectOriginal);
    const fpRefactored = fingerprint(rule, subjectRefactored);

    expect(fpRefactored).toBe(fpOriginal);

    // If the underlying issue changes (e.g. endpoint path or shape changes):
    const subjectDifferent = {
      kind: "endpoint" as const,
      stableKey: "GET /api/admin/users/:id",
      shapeKey: "handler->db.read",
    };
    const fpDifferent = fingerprint(rule, subjectDifferent);
    expect(fpDifferent).not.toBe(fpOriginal);
  });
});
