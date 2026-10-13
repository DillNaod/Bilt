// ─── Phase 3 Exit Gate Test Suite ─────────────────────────────────────────────
// Validates:
// 1. Every security fixture produces exactly 1 finding with file:line path.
// 2. Every patched twin fixture produces 0 findings.
// 3. Every wrong-fix fixture is rejected by verify() with specific evasion reasons.
// 4. Correct fixes are accepted by verify() with evidence.
// 5. Corpus false-positive budget (FP_BUDGET.high <= 0.02) is strictly met.
// 6. Architecture lint verifies rules only access QueryFacade.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { walkRepo } from "../../src/core/ingest/walker.js";
import { CoverageRecorder } from "../../src/core/facts/coverage.js";
import { createExtractCtx } from "../../src/core/facts/extractor.js";
import { buildModel, createRepoIndex } from "../../src/core/model/builder.js";
import { createQueryFacade, guarded } from "../../src/core/model/query-facade.js";

import { secAuthz001 } from "../../src/core/rules/security/authz-idor.js";
import { secInput002 } from "../../src/core/rules/security/mass-assignment.js";
import { secData003 } from "../../src/core/rules/security/sensitive-exposure.js";
import { secAuthz004 } from "../../src/core/rules/security/privilege-escalation.js";

import { verifyAuthz, verifyMassAssignment } from "../../src/core/findings/verify.js";
import { measureFpRate, type CorpusProject } from "../../src/testkit/fp-corpus.js";
import { lintRuleImports, checkRuleDeclaredFacts } from "../../src/testkit/arch-lint.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/phase3");

async function loadFixtureFacade(subpath: string) {
  const root = path.join(FIXTURES_DIR, subpath);
  const files = [];
  for await (const f of walkRepo(root, () => false)) {
    files.push(f);
  }
  const repo = createRepoIndex(root, files);
  const cov = new CoverageRecorder();
  const ctx = createExtractCtx(cov);
  const model = await buildModel(repo, ctx);
  return createQueryFacade(model);
}

describe("Phase 3 Exit Gate: Security Fixtures and Twins", () => {
  it("detects IDOR vulnerability on vulnerable fixture and passes clean twin", async () => {
    const vulnFacade = await loadFixtureFacade("idor/vulnerable");
    const findings = secAuthz001.detect(guarded(vulnFacade, secAuthz001));

    expect(findings).toHaveLength(1);
    expect(findings[0]!.ruleId).toBe("SEC-AUTHZ-001");
    expect(findings[0]!.severity).toBe("high");
    expect(findings[0]!.locations[0]!.file).toContain("src/routes.ts");
    expect(findings[0]!.locations[0]!.line).toBeGreaterThanOrEqual(1);

    const fixedFacade = await loadFixtureFacade("idor/twin-fixed");
    const fixedFindings = secAuthz001.detect(guarded(fixedFacade, secAuthz001));
    expect(fixedFindings).toHaveLength(0);
  });

  it("detects Mass Assignment vulnerability on vulnerable fixture and passes clean twin", async () => {
    const vulnFacade = await loadFixtureFacade("mass-assignment/vulnerable");
    const findings = secInput002.detect(guarded(vulnFacade, secInput002));

    expect(findings).toHaveLength(1);
    expect(findings[0]!.ruleId).toBe("SEC-INPUT-002");
    expect(findings[0]!.severity).toBe("high");
    expect(findings[0]!.locations[0]!.file).toContain("src/routes.ts");

    const fixedFacade = await loadFixtureFacade("mass-assignment/twin-fixed");
    const fixedFindings = secInput002.detect(guarded(fixedFacade, secInput002));
    expect(fixedFindings).toHaveLength(0);
  });

  it("detects Sensitive Data Exposure on vulnerable fixture and passes clean twin", async () => {
    const vulnFacade = await loadFixtureFacade("sensitive-response/vulnerable");
    const findings = secData003.detect(guarded(vulnFacade, secData003));

    expect(findings).toHaveLength(1);
    expect(findings[0]!.ruleId).toBe("SEC-DATA-003");
    expect(findings[0]!.severity).toBe("critical");
    expect(findings[0]!.locations[0]!.file).toContain("src/routes.ts");

    const fixedFacade = await loadFixtureFacade("sensitive-response/twin-fixed");
    const fixedFindings = secData003.detect(guarded(fixedFacade, secData003));
    expect(fixedFindings).toHaveLength(0);
  });

  it("detects Privilege Escalation on vulnerable fixture and passes clean twin", async () => {
    const vulnFacade = await loadFixtureFacade("privilege-escalation/vulnerable");
    const findings = secAuthz004.detect(guarded(vulnFacade, secAuthz004));

    expect(findings).toHaveLength(1);
    expect(findings[0]!.ruleId).toBe("SEC-AUTHZ-004");
    expect(findings[0]!.severity).toBe("critical");
    expect(findings[0]!.locations[0]!.file).toContain("src/routes.ts");

    const fixedFacade = await loadFixtureFacade("privilege-escalation/twin-fixed");
    const fixedFindings = secAuthz004.detect(guarded(fixedFacade, secAuthz004));
    expect(fixedFindings).toHaveLength(0);
  });
});

describe("Phase 3 Exit Gate: Anti-Gaming verify() Rejects Wrong-Fix Fixtures", () => {
  it("rejects wrong fixes for IDOR: dead branch, late check, and deleted route", async () => {
    const vulnFacade = await loadFixtureFacade("idor/vulnerable");
    const originalFinding = secAuthz001.detect(vulnFacade)[0]!;

    // 1. Dead branch evasion
    const deadFacade = await loadFixtureFacade("idor/wrong-fix-dead");
    const deadResult = verifyAuthz(deadFacade, originalFinding);
    expect(deadResult.status).toBe("unresolved");
    if (deadResult.status === "unresolved") {
      expect(deadResult.reasons).toContain("check-on-dead-branch");
    }

    // 2. Late check evasion
    const lateFacade = await loadFixtureFacade("idor/wrong-fix-late");
    const lateResult = verifyAuthz(lateFacade, originalFinding);
    expect(lateResult.status).toBe("unresolved");
    if (lateResult.status === "unresolved") {
      expect(lateResult.reasons).toContain("check-after-sink");
    }

    // 3. Deleted route evasion
    const deletedFacade = await loadFixtureFacade("idor/wrong-fix-deleted");
    const deletedResult = verifyAuthz(deletedFacade, originalFinding);
    expect(deletedResult.status).toBe("unresolved");
    if (deletedResult.status === "unresolved") {
      expect(deletedResult.reasons).toContain("route-or-feature-deleted");
    }

    // 4. Correct fix is accepted
    const fixedFacade = await loadFixtureFacade("idor/twin-fixed");
    const correctResult = verifyAuthz(fixedFacade, originalFinding);
    expect(correctResult.status).toBe("resolved");
    if (correctResult.status === "resolved") {
      expect(correctResult.evidence.length).toBeGreaterThan(0);
    }
  });

  it("rejects wrong fix for Mass Assignment (dummy validation)", async () => {
    const vulnFacade = await loadFixtureFacade("mass-assignment/vulnerable");
    const originalFinding = secInput002.detect(vulnFacade)[0]!;

    const dummyFacade = await loadFixtureFacade("mass-assignment/wrong-fix-dummy");
    const dummyResult = verifyMassAssignment(dummyFacade, originalFinding);
    expect(dummyResult.status).toBe("unresolved");
    if (dummyResult.status === "unresolved") {
      expect(dummyResult.reasons).toContain("validation-on-different-input");
    }

    const fixedFacade = await loadFixtureFacade("mass-assignment/twin-fixed");
    const correctResult = verifyMassAssignment(fixedFacade, originalFinding);
    expect(correctResult.status).toBe("resolved");
  });
});

describe("Phase 3 Exit Gate: False-Positive Corpus Budget", () => {
  it("enforces false-positive rate budget across clean twins", async () => {
    const corpus: CorpusProject[] = [
      {
        name: "idor-fixed",
        facade: await loadFixtureFacade("idor/twin-fixed"),
        expectedFindings: [],
      },
      {
        name: "mass-assignment-fixed",
        facade: await loadFixtureFacade("mass-assignment/twin-fixed"),
        expectedFindings: [],
      },
      {
        name: "sensitive-response-fixed",
        facade: await loadFixtureFacade("sensitive-response/twin-fixed"),
        expectedFindings: [],
      },
      {
        name: "privilege-escalation-fixed",
        facade: await loadFixtureFacade("privilege-escalation/twin-fixed"),
        expectedFindings: [],
      },
    ];

    const rules = [secAuthz001, secInput002, secData003, secAuthz004];
    for (const rule of rules) {
      const measurement = measureFpRate(rule, corpus);
      expect(measurement.falsePositives).toBe(0);
      expect(measurement.falsePositiveRate).toBe(0);
      expect(measurement.withinBudget).toBe(true);
    }
  });
});

describe("Phase 3: Architecture Lint & Fact Contracts", () => {
  it("verifies security rules do not import forbidden packages and honor declared consumes", async () => {
    const rulesDir = path.resolve(__dirname, "../../src/core/rules/security");
    const importViolations = await lintRuleImports(rulesDir);
    expect(importViolations).toHaveLength(0);

    const sampleFacade = await loadFixtureFacade("idor/twin-fixed");
    const rules = [secAuthz001, secInput002, secData003, secAuthz004];
    for (const rule of rules) {
      // Check fact consumes declaration
      const check = checkRuleDeclaredFacts(rule, sampleFacade);
      expect(check.undeclared).toHaveLength(0);
    }
  });
});
