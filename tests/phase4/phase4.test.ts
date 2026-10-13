// ─── Phase 4 Exit Gate Test Suite ─────────────────────────────────────────────
// Validates:
// 1. Upload fixture without error and retry states yields exactly those two missing-stage findings.
// 2. Fully-stated twin upload fixture yields none.
// 3. Orphan /settings/security fixture is reported while dynamic route /users/[id] is not flagged.
// 4. Radix-based dialog passes focus management; unmanaged custom dialog triggers A11Y-MODAL-001.
// 5. Hardcoded metric without data source triggers UI-FAKE-METRIC-001.
// 6. Architecture lint verifies rules only access QueryFacade and declared consumes.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { walkRepo } from "../../src/core/ingest/walker.js";
import { CoverageRecorder } from "../../src/core/facts/coverage.js";
import { createExtractCtx } from "../../src/core/facts/extractor.js";
import { buildModel, createRepoIndex } from "../../src/core/model/builder.js";
import { createQueryFacade, guarded } from "../../src/core/model/query-facade.js";

import { uxFlow001 } from "../../src/core/rules/ux/flow-completeness.js";
import { iaOrphan001 } from "../../src/core/rules/ux/ia-orphan.js";
import { a11yModal001 } from "../../src/core/rules/accessibility/modal-focus.js";
import { uiFakeMetric001 } from "../../src/core/rules/ux/fake-metrics.js";

import { lintRuleImports, checkRuleDeclaredFacts } from "../../src/testkit/arch-lint.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/phase4");

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

describe("Phase 4 Exit Gate: User Flow Completeness (UX-FLOW-001)", () => {
  it("yields exactly two missing-stage findings (error and retry) on incomplete upload flow", async () => {
    const vulnFacade = await loadFixtureFacade("upload/incomplete");
    const findings = uxFlow001.detect(guarded(vulnFacade, uxFlow001));

    expect(findings).toHaveLength(2);
    const missingStages = findings.map((f) => (f.subject as any)?.missingStage).sort();
    expect(missingStages).toEqual(["error", "retry"]);

    expect(findings[0]!.ruleId).toBe("UX-FLOW-001");
    expect(findings[0]!.locations[0]!.file).toContain("UploadModal.tsx");
  });

  it("yields zero findings on fully-stated twin upload fixture", async () => {
    const cleanFacade = await loadFixtureFacade("upload/twin-complete");
    const findings = uxFlow001.detect(guarded(cleanFacade, uxFlow001));

    expect(findings).toHaveLength(0);
  });
});

describe("Phase 4 Exit Gate: Information Architecture & Orphan Routes (IA-ORPHAN-001)", () => {
  it("reports orphan /settings/security while dynamic route /users/[id] is not flagged", async () => {
    const facade = await loadFixtureFacade("ia/orphan");
    const findings = iaOrphan001.detect(guarded(facade, iaOrphan001));

    expect(findings).toHaveLength(1);
    expect(findings[0]!.ruleId).toBe("IA-ORPHAN-001");
    expect((findings[0]!.subject as any)?.route).toBe("/settings/security");

    // Dynamic route /users/[id] should NOT be flagged as orphan
    const flaggedRoutes = findings.map((f) => (f.subject as any)?.route);
    expect(flaggedRoutes).not.toContain("/users/[id]");
  });
});

describe("Phase 4 Exit Gate: Dialog Focus Management (A11Y-MODAL-001)", () => {
  it("passes Radix-based dialog without findings", async () => {
    const radixFacade = await loadFixtureFacade("a11y/radix-dialog");
    const findings = a11yModal001.detect(guarded(radixFacade, a11yModal001));

    expect(findings).toHaveLength(0);
  });

  it("flags unmanaged custom dialog for missing focus trapping and restoration", async () => {
    const customFacade = await loadFixtureFacade("a11y/custom-dialog");
    const findings = a11yModal001.detect(guarded(customFacade, a11yModal001));

    expect(findings).toHaveLength(1);
    expect(findings[0]!.ruleId).toBe("A11Y-MODAL-001");
    expect(findings[0]!.locations[0]!.file).toContain("CustomDialog.tsx");
  });
});

describe("Phase 4 Exit Gate: Claims vs Reality (UI-FAKE-METRIC-001)", () => {
  it("flags hardcoded metrics presented without data sources", async () => {
    const facade = await loadFixtureFacade("claims/fake-metric");
    const findings = uiFakeMetric001.detect(guarded(facade, uiFakeMetric001));

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]!.ruleId).toBe("UI-FAKE-METRIC-001");
    expect(findings[0]!.evidence[0]!.claim).toContain("10,000+");
  });
});

describe("Phase 4: Architecture Lint & Fact Contracts", () => {
  it("verifies rules only access QueryFacade and honor declared fact dependencies", async () => {
    const rules = [uxFlow001, iaOrphan001, a11yModal001, uiFakeMetric001];
    const sampleFacade = await loadFixtureFacade("upload/twin-complete");

    for (const rule of rules) {
      const check = checkRuleDeclaredFacts(rule, sampleFacade);
      expect(check.undeclared).toHaveLength(0);
    }

    const uxViolations = await lintRuleImports(
      path.resolve(__dirname, "../../src/core/rules/ux")
    );
    expect(uxViolations).toHaveLength(0);

    const a11yViolations = await lintRuleImports(
      path.resolve(__dirname, "../../src/core/rules/accessibility")
    );
    expect(a11yViolations).toHaveLength(0);
  });
});
