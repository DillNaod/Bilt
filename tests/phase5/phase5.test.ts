// ─── Phase 5 Exit Gate Test Suite ─────────────────────────────────────────────
// Validates:
// 1. Generic SaaS landing fixture yields 1 strong composition finding (DESIGN-STRUCTURE-001)
//    with >= 5 motifs across >= 4 families.
// 2. Distinctive editorial fixture yields 0 findings.
// 3. Marketplace data-driven grid fixture yields 0 findings.
// 4. Single-gradient fixture yields 0 findings (proves resistance to false positives).
// 5. Component tree normalization and structural similarity correctly map trees.
// 6. Architecture lint verifies rules only access QueryFacade and honor declared fact dependencies.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { walkRepo } from "../../src/core/ingest/walker.js";
import { CoverageRecorder } from "../../src/core/facts/coverage.js";
import { createExtractCtx } from "../../src/core/facts/extractor.js";
import { buildModel, createRepoIndex } from "../../src/core/model/builder.js";
import { createQueryFacade, guarded } from "../../src/core/model/query-facade.js";

import { designStructure001 } from "../../src/core/rules/design/composition-rule.js";
import { normalizeComponentTree, shapeKey, structuralSimilarity } from "../../src/core/design/normalize.js";

import { lintRuleImports, checkRuleDeclaredFacts } from "../../src/testkit/arch-lint.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

async function loadFixtureFacade(rootPath: string) {
  const files = [];
  for await (const f of walkRepo(rootPath, () => false)) {
    files.push(f);
  }
  const repo = createRepoIndex(rootPath, files);
  const cov = new CoverageRecorder();
  const ctx = createExtractCtx(cov);
  const model = await buildModel(repo, ctx);
  return createQueryFacade(model);
}

describe("Phase 5 Exit Gate: Component Tree Normalization", () => {
  it("normalizes JSX structures into canonical shape keys regardless of class names", () => {
    const jsx1 = `<div><h2>Feature One</h2><p>Description text</p><button>Get Started</button></div>`;
    const jsx2 = `<div className="p-8 bg-neutral-900"><h3 className="text-xl">Fast Sync</h3><p className="text-sm">Realtime data</p><a href="/signup" className="btn-primary">Learn More</a></div>`;

    const tree1 = normalizeComponentTree(jsx1);
    const tree2 = normalizeComponentTree(jsx2);

    expect(shapeKey(tree1)).toBe(shapeKey(tree2));
    expect(structuralSimilarity(tree1, tree2)).toBe(1.0);
  });

  it("distinguishes structurally different components", () => {
    const cardJsx = `<div><h3>Feature</h3><p>Detail</p><button>Action</button></div>`;
    const navJsx = `<nav><ul><li>Link 1</li><li>Link 2</li><li>Link 3</li></ul></nav>`;

    const cardTree = normalizeComponentTree(cardJsx);
    const navTree = normalizeComponentTree(navJsx);

    expect(shapeKey(cardTree)).not.toBe(shapeKey(navTree));
    expect(structuralSimilarity(cardTree, navTree)).toBeLessThan(1.0);
  });
});

describe("Phase 5 Exit Gate: Generic SaaS Landing Composition (DESIGN-STRUCTURE-001)", () => {
  it("detects clustered generic template moves (>= 5 motifs across >= 4 families) on generic SaaS landing", async () => {
    const facade = await loadFixtureFacade(path.join(FIXTURES_DIR, "generic-saas-landing"));
    const findings = designStructure001.detect(guarded(facade, designStructure001));

    expect(findings).toHaveLength(1);
    const finding = findings[0]!;
    expect(finding.ruleId).toBe("DESIGN-STRUCTURE-001");
    expect(finding.severity).toBe("low");
    expect(designStructure001.mode).toBe("advisory");

    const subject = finding.subject as any;
    expect(subject.motifsCount).toBeGreaterThanOrEqual(5);
    expect(subject.familiesCount).toBeGreaterThanOrEqual(4);
    expect(finding.evidence.length).toBeGreaterThanOrEqual(5);
  });

  it("yields zero findings on distinctive editorial layout", async () => {
    const facade = await loadFixtureFacade(path.join(FIXTURES_DIR, "distinctive-editorial"));
    const findings = designStructure001.detect(guarded(facade, designStructure001));

    expect(findings).toHaveLength(0);
  });

  it("yields zero findings on data-driven marketplace grid", async () => {
    const facade = await loadFixtureFacade(path.join(FIXTURES_DIR, "phase5/marketplace-grid"));
    const findings = designStructure001.detect(guarded(facade, designStructure001));

    expect(findings).toHaveLength(0);
  });

  it("yields zero findings on page with a single purple gradient element", async () => {
    const facade = await loadFixtureFacade(path.join(FIXTURES_DIR, "phase5/single-gradient"));
    const findings = designStructure001.detect(guarded(facade, designStructure001));

    expect(findings).toHaveLength(0);
  });
});

describe("Phase 5: Architecture Lint & Fact Contracts", () => {
  it("verifies designStructure001 only accesses QueryFacade and honor declared fact dependencies", async () => {
    const sampleFacade = await loadFixtureFacade(path.join(FIXTURES_DIR, "phase5/single-gradient"));
    const check = checkRuleDeclaredFacts(designStructure001, sampleFacade);
    expect(check.undeclared).toHaveLength(0);

    const designViolations = await lintRuleImports(
      path.resolve(__dirname, "../../src/core/rules/design")
    );
    expect(designViolations).toHaveLength(0);
  });
});
