// ─── Phase 2 Exit Gate Test Suite ─────────────────────────────────────────────
// Validates:
// 1. Framework adapters (Express, Next.js, NestJS) model the same endpoint identically.
// 2. Style inventory is identical across authoring methods (Tailwind, CSS vars, styled-components).
// 3. Scale analysis flags near-duplicates and off-scale values on sloppy scales.
// 4. OKLab Euclidean color distance detects near-duplicate colors.
// 5. Interprocedural taint engine traces dataflow and recognizes Zod sanitization.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { walkRepo } from "../../src/core/ingest/walker.js";
import { CoverageRecorder } from "../../src/core/facts/coverage.js";
import { createExtractCtx } from "../../src/core/facts/extractor.js";
import { buildModel, createRepoIndex } from "../../src/core/model/builder.js";
import { analyzeScale, nearDuplicateColors } from "../../src/core/style/scale-analysis.js";
import { solveTaint } from "../../src/core/flow/taint.js";
import { guardsFor } from "../../src/core/flow/middleware.js";
import { buildApiSecurityModel } from "../../src/core/flow/api-security.js";
import type { RouteModel } from "../../src/core/model/project-model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/phase2");

async function loadFixtureModel(subpath: string) {
  const root = path.join(FIXTURES_DIR, subpath);
  const files = [];
  for await (const f of walkRepo(root, () => false)) {
    files.push(f);
  }
  const repo = createRepoIndex(root, files);
  const cov = new CoverageRecorder();
  const ctx = createExtractCtx(cov);
  return await buildModel(repo, ctx);
}

describe("Phase 2 Exit Gate: Framework Endpoint Normalization", () => {
  it("models GET /api/users/:id identically across Express, Next.js, and NestJS", async () => {
    const expressModel = await loadFixtureModel("framework-endpoints/express-app");
    const nextModel = await loadFixtureModel("framework-endpoints/next-app");
    const nestModel = await loadFixtureModel("framework-endpoints/nest-app");

    // Each framework must yield exactly one endpoint for users by id
    const expressRoute = expressModel.routes.find((r) => r.path === "/api/users/:id");
    const nextRoute = nextModel.routes.find((r) => r.path === "/api/users/:id");
    const nestRoute = nestModel.routes.find((r) => r.path === "/api/users/:id");

    expect(expressRoute).toBeDefined();
    expect(nextRoute).toBeDefined();
    expect(nestRoute).toBeDefined();

    // 1. Path identity
    expect(expressRoute!.path).toBe("/api/users/:id");
    expect(nextRoute!.path).toBe("/api/users/:id");
    expect(nestRoute!.path).toBe("/api/users/:id");

    // 2. HTTP Method identity
    expect(expressRoute!.methods).toEqual(["GET"]);
    expect(nextRoute!.methods).toEqual(["GET"]);
    expect(nestRoute!.methods).toEqual(["GET"]);

    // 3. Route parameters identity
    expect(expressRoute!.params).toEqual(["id"]);
    expect(nextRoute!.params).toEqual(["id"]);
    expect(nestRoute!.params).toEqual(["id"]);

    // 4. Route kind identity
    expect(expressRoute!.kind).toBe("api");
    expect(nextRoute!.kind).toBe("api");
    expect(nestRoute!.kind).toBe("api");

    // 5. Auth protection / public status identity
    expect(expressRoute!.isPublic.state).toBe("confirmed");
    expect(expressRoute!.isPublic.value).toBe(false);

    expect(nextRoute!.isPublic.state).toBe("confirmed");
    expect(nextRoute!.isPublic.value).toBe(false);

    expect(nestRoute!.isPublic.state).toBe("confirmed");
    expect(nestRoute!.isPublic.value).toBe(false);

    // 6. Middleware presence
    expect(expressRoute!.middlewareChain.state).toBe("confirmed");
    expect(expressRoute!.middlewareChain.value.some((m) => m.name.toLowerCase().includes("auth"))).toBe(true);

    expect(nextRoute!.middlewareChain.state).toBe("confirmed");
    expect(nextRoute!.middlewareChain.value.some((m) => m.name.toLowerCase().includes("auth"))).toBe(true);

    expect(nestRoute!.middlewareChain.state).toBe("confirmed");
    expect(nestRoute!.middlewareChain.value.some((m) => m.name.toLowerCase().includes("guard") || m.name.toLowerCase().includes("auth"))).toBe(true);
  });
});

describe("Phase 2 Exit Gate: Style Inventory Invariance Across Authoring Methods", () => {
  it("extracts identical radius and spacing inventories across Tailwind, CSS vars, and styled-components", async () => {
    const tailwindModel = await loadFixtureModel("style-authoring/tailwind-app");
    const cssvarsModel = await loadFixtureModel("style-authoring/cssvars-app");
    const styledModel = await loadFixtureModel("style-authoring/styled-app");

    expect(tailwindModel.styles).toBeDefined();
    expect(cssvarsModel.styles).toBeDefined();
    expect(styledModel.styles).toBeDefined();

    const twRadius = tailwindModel.styles!.inventory.radius;
    const cssRadius = cssvarsModel.styles!.inventory.radius;
    const styledRadius = styledModel.styles!.inventory.radius;

    // Radius values must be [4, 8, 16] across all three authoring paradigms
    const twValues = twRadius.map((r) => r.value);
    const cssValues = cssRadius.map((r) => r.value);
    const styledValues = styledRadius.map((r) => r.value);

    expect(twValues).toEqual([4, 8, 16]);
    expect(cssValues).toEqual([4, 8, 16]);
    expect(styledValues).toEqual([4, 8, 16]);

    // Usage counts must be identical (1 use of each radius)
    const twCounts = twRadius.map((r) => r.count);
    const cssCounts = cssRadius.map((r) => r.count);
    const styledCounts = styledRadius.map((r) => r.count);

    expect(twCounts).toEqual([1, 1, 1]);
    expect(cssCounts).toEqual([1, 1, 1]);
    expect(styledCounts).toEqual([1, 1, 1]);

    // Spacing inventories must also match: 16px (count 3)
    const twSpacing = tailwindModel.styles!.inventory.spacing;
    const cssSpacing = cssvarsModel.styles!.inventory.spacing;
    const styledSpacing = styledModel.styles!.inventory.spacing;

    expect(twSpacing.map((s) => s.value)).toEqual([16]);
    expect(cssSpacing.map((s) => s.value)).toEqual([16]);
    expect(styledSpacing.map((s) => s.value)).toEqual([16]);

    expect(twSpacing.map((s) => s.count)).toEqual([3]);
    expect(cssSpacing.map((s) => s.count)).toEqual([3]);
    expect(styledSpacing.map((s) => s.count)).toEqual([3]);
  });
});

describe("Phase 2: Scale Analysis & Coherence", () => {
  it("confirms clean scale and flags sloppy scale with near-duplicates and off-scale values", async () => {
    const cleanModel = await loadFixtureModel("style-authoring/tailwind-app");
    const sloppyModel = await loadFixtureModel("style-authoring/sloppy-scale");

    const declaredScale = [4, 8, 16];

    // Clean scale analysis
    const cleanReport = analyzeScale(cleanModel.styles!.inventory.radius, declaredScale);
    expect(cleanReport.followsDeclaredScale).toBe(true);
    expect(cleanReport.nearDuplicates).toHaveLength(0);
    expect(cleanReport.offScale).toHaveLength(0);

    // Sloppy scale analysis (contains 4, 8, 12, 13, 17, 23)
    const sloppyReport = analyzeScale(sloppyModel.styles!.inventory.radius, declaredScale);
    expect(sloppyReport.followsDeclaredScale).toBe(false);

    // Detects 12 vs 13 as near-duplicate within tolerance (1.5)
    expect(sloppyReport.nearDuplicates).toEqual([[12, 13]]);

    // Identifies off-scale values not on the declared scale [4, 8, 16]
    const offValues = sloppyReport.offScale.map((o) => o.value);
    expect(offValues).toContain(12);
    expect(offValues).toContain(13);
    expect(offValues).toContain(18);
    expect(offValues).toContain(23);
  });
});

describe("Phase 2: OKLab Color Distance", () => {
  it("detects near-duplicate colors and distinguishes contrasting ones", () => {
    // Subtle variation of dark gray/slate
    expect(nearDuplicateColors("#111827", "#121928")).toBe(true);

    // Distant colors should not be near-duplicates
    expect(nearDuplicateColors("#111827", "#ffffff")).toBe(false);
    expect(nearDuplicateColors("#ef4444", "#3b82f6")).toBe(false);

    // Identical color is not a "near"-duplicate
    expect(nearDuplicateColors("#3b82f6", "#3b82f6")).toBe(false);
  });
});

describe("Phase 2: Interprocedural Taint Flow & Sanitizers", () => {
  it("traces req.body to DB write and distinguishes unvalidated from Zod-validated flows", async () => {
    const dataflowModel = await loadFixtureModel("dataflow");

    // The dataflow directory contains unvalidated.ts and zod-validated.ts
    const root = path.join(FIXTURES_DIR, "dataflow");
    const files = [];
    for await (const f of walkRepo(root, () => false)) {
      files.push(f);
    }
    const repo = createRepoIndex(root, files);
    const paths = solveTaint(repo);

    expect(paths.length).toBeGreaterThanOrEqual(2);

    const unvalidatedPath = paths.find(
      (p) => p.sink.callee === "db.create" && p.source.kind === "req.body"
    );
    expect(unvalidatedPath).toBeDefined();
    expect(unvalidatedPath!.sanitizers).toHaveLength(0);

    const validatedPath = paths.find(
      (p) => p.sink.callee === "db.update" && p.source.kind === "req.body"
    );
    expect(validatedPath).toBeDefined();
    expect(
      validatedPath!.sanitizers.some((s) => s.kind === "schema-validate" && s.library === "zod")
    ).toBe(true);
  });
});

describe("Phase 2: Middleware & Endpoint Security Synthesis", () => {
  it("extracts guards and builds API security facts", async () => {
    const expressModel = await loadFixtureModel("framework-endpoints/express-app");
    const route = expressModel.routes.find((r) => r.path === "/api/users/:id")!;

    const guardEv = guardsFor(route);
    expect(guardEv.state).toBe("confirmed");
    expect(guardEv.value.some((g) => g.kind === "authn")).toBe(true);

    const ep = expressModel.apiEndpoints.find((e) => e.path === "/api/users/:id")!;
    expect(ep.securityModel).toBeDefined();
    expect(ep.securityModel!.state).toBe("confirmed");
    expect(ep.securityModel!.value.hasAuth.value).toBe(true);
    // Since no ownership check was found on :id, ownership check is absent (tri-state fact model)
    expect(ep.securityModel!.value.hasOwnershipCheck.state).toBe("absent");
  });
});
