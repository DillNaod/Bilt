import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  evaluateConfigFile,
  staticEvalConfig,
  evalNode,
} from "../../../src/core/ingest/static-eval.js";
import {
  checkAstDepth,
  safeParseAst,
} from "../../../src/core/ingest/sandbox.js";
import { CoverageRecorder } from "../../../src/core/facts/coverage.js";
import {
  confirmed,
  absent,
  unknown,
  allConfirmed,
  chainConfidence,
  makeProvenance,
} from "../../../src/core/facts/fact.js";

describe("Ingest, Static Evaluation, Sandboxing, and Fact System", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-ingest-facts-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("Static Config Evaluator (static-eval.ts)", () => {
    it("should evaluate literal values, arrays, and objects with spreads", () => {
      const code = `
        const baseColors = ["#000", "#fff"];
        const sharedConfig = { darkMode: true, count: 42, empty: null };
        export default {
          ...sharedConfig,
          colors: [...baseColors, "#ff0000"],
          siteName: \`My App \${"v2"}\`,
          nested: {
            theme: {
              active: true
            }
          }
        };
      `;

      const result = evaluateConfigFile(code);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          darkMode: true,
          count: 42,
          empty: null,
          colors: ["#000", "#fff", "#ff0000"],
          siteName: "My App v2",
          nested: {
            theme: {
              active: true,
            },
          },
        });
      }
    });

    it("should evaluate module.exports with member expression lookups and pure calls", () => {
      const code = `
        const paths = {
          assets: "static/assets",
        };
        module.exports = {
          outDir: path.join("dist", paths.assets),
          resolvedDir: path.resolve("public"),
        };
      `;

      const result = evaluateConfigFile(code);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          outDir: "dist/static/assets",
          resolvedDir: "/public",
        });
      }
    });

    it("should evaluate pure helper calls 'join' and 'resolve' directly", () => {
      const code = `
        export default {
          joined: join("a", "b", "c"),
          resolved: resolve("root", "dir"),
        };
      `;

      const result = evaluateConfigFile(code);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          joined: "a/b/c",
          resolved: "/root/dir",
        });
      }
    });

    it("should reject dynamic unallowlisted function calls", () => {
      const code = `
        export default {
          computed: getSecret(),
        };
      `;

      const result = evaluateConfigFile(code);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("dynamic-call");
      }
    });

    it("should report unresolved-identifier when referencing undeclared variable", () => {
      const code = `
        export default {
          port: UNDECLARED_PORT,
        };
      `;

      const result = evaluateConfigFile(code);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("unresolved-identifier");
      }
    });

    it("should handle syntax errors gracefully", () => {
      const code = `export default { invalid JSON syntax !!!`;
      const result = evaluateConfigFile(code);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("parse-error");
      }
    });

    it("should handle files with no export default or module.exports", () => {
      const code = `const a = 1; const b = 2;`;
      const result = evaluateConfigFile(code);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("unsupported-node");
      }
    });

    it("should evaluate real config files on disk via staticEvalConfig", async () => {
      const configPath = path.join(tmpDir, "tailwind.config.js");
      await fs.writeFile(
        configPath,
        `module.exports = { content: ["./src/**/*.{js,ts,jsx,tsx}"], theme: { extend: {} } };`,
      );

      const fact = await staticEvalConfig(configPath);
      expect(fact.state).toBe("confirmed");
      if (fact.state === "confirmed") {
        expect(fact.value).toEqual({
          content: ["./src/**/*.{js,ts,jsx,tsx}"],
          theme: { extend: {} },
        });
      }
    });

    it("should return unknown with config-unreadable for missing file in staticEvalConfig", async () => {
      const fact = await staticEvalConfig(path.join(tmpDir, "nonexistent.config.js"));
      expect(fact.state).toBe("unknown");
      if (fact.state === "unknown") {
        expect(fact.reason.kind).toBe("config-unreadable");
      }
    });

    it("should return unknown with static-eval reason when file has dynamic code", async () => {
      const dynamicConfigPath = path.join(tmpDir, "dynamic.config.js");
      await fs.writeFile(dynamicConfigPath, `module.exports = { dynamic: require("os").cpus() };`);

      const fact = await staticEvalConfig(dynamicConfigPath);
      expect(fact.state).toBe("unknown");
      if (fact.state === "unknown") {
        expect(fact.reason.kind).toBe("static-eval-dynamic-call");
      }
    });
  });

  describe("Sandbox & AST Depth Bounds (sandbox.ts)", () => {
    it("should pass AST depth check on normal programs", () => {
      const outcome = safeParseAst("const x = { a: { b: { c: 1 } } };", "test.ts");
      expect(outcome.ok).toBe(true);
      expect(outcome.ast).toBeDefined();
    });

    it("should flag parse-failed on syntax error", () => {
      const outcome = safeParseAst("function ( {", "invalid.ts");
      expect(outcome.ok).toBe(false);
      expect(outcome.error).toBe("parse-failed");
    });

    it("should reject AST exceeding maxAstDepth limit", () => {
      // Build a nested tree artificially exceeding depth 400
      let nested: any = { type: "Identifier", name: "leaf" };
      for (let i = 0; i < 450; i++) {
        nested = { type: "ObjectExpression", child: nested };
      }
      expect(checkAstDepth(nested)).toBe(false);
    });
  });

  describe("Coverage Recorder (coverage.ts)", () => {
    it("should track frameworks, routes, skipped files, and rule statuses", () => {
      const recorder = new CoverageRecorder();

      recorder.frameworkDetected("nextjs", true, "14.2.0");
      recorder.frameworkUnsupported("angular");
      recorder.routeResolved();
      recorder.routeUnresolved({ kind: "dynamic-import" });

      recorder.fileParsed();
      recorder.fileSkipped("binary");
      recorder.fileSkipped("too-large");
      recorder.fileSkipped("depth-limit");
      recorder.parseFailed("corrupt.ts");

      recorder.skipDynamic("eval", { file: "app.ts", startLine: 10, endLine: 10 });
      recorder.ruleRan("SEC-AUTH-001");
      recorder.ruleDegraded("SEC-TENANT-001", "missing route handlers");
      recorder.ruleDisabled("SEC-CRY-001", "framework not supported");

      const snap = recorder.snapshot();
      expect(snap.frameworks).toHaveLength(2);
      expect(snap.frameworks[0]?.name).toBe("nextjs");
      expect(snap.frameworks[0]?.supported).toBe(true);
      expect(snap.frameworks[1]?.name).toBe("angular");
      expect(snap.frameworks[1]?.supported).toBe(false);

      expect(snap.routes.resolved).toBe(1);
      expect(snap.routes.unresolved).toBe(1);
      expect(snap.files.parsed).toBe(1);
      expect(snap.files.skipped.binary).toBe(1);
      expect(snap.files.skipped["too-large"]).toBe(1);
      expect(snap.files.parseFailed).toContain("corrupt.ts");
      expect(snap.dynamicConstructs[0]?.kind).toBe("eval");

      expect(snap.rules.find((r) => r.id === "SEC-AUTH-001")?.status).toBe("ran");
      expect(snap.rules.find((r) => r.id === "SEC-TENANT-001")?.status).toBe("degraded");
      expect(snap.rules.find((r) => r.id === "SEC-CRY-001")?.status).toBe("disabled");
    });
  });

  describe("Tri-State Fact Model (fact.ts)", () => {
    it("should create provenance records with snippet hashing", () => {
      const provWithHash = makeProvenance("src/index.ts", 10, 15, "ts-ast", "const x = 1;");
      expect(provWithHash.file).toBe("src/index.ts");
      expect(provWithHash.snippetHash).toBeDefined();
      expect(provWithHash.snippetHash?.length).toBe(64);

      const provWithoutSnippet = makeProvenance("src/main.ts");
      expect(provWithoutSnippet.snippetHash).toBe("");
    });

    it("should evaluate allConfirmed across fact arrays", () => {
      const f1 = confirmed("val1");
      const f2 = confirmed("val2");
      const fAbsent = absent([{ file: "a.ts" }]);
      const fUnknown = unknown({ kind: "dynamic-import" });

      expect(allConfirmed(f1, f2)).toBe("confirmed");
      expect(allConfirmed(f1, fAbsent)).toBe("absent");
      expect(allConfirmed(f1, fUnknown, fAbsent)).toBe("unknown");
    });

    it("should determine chain confidence based on precision and fact state", () => {
      const highFact = confirmed("token");
      const unknownFact = unknown({ kind: "needs-rendered-pass" });

      const confidenceHigh = chainConfidence([
        { precision: "high", fact: highFact },
        { precision: "high", fact: highFact },
      ]);
      expect(confidenceHigh).toBe("high");

      const confidenceMed = chainConfidence([
        { precision: "high", fact: highFact },
        { precision: "medium", fact: highFact },
      ]);
      expect(confidenceMed).toBe("medium");

      const confidenceDegraded = chainConfidence([
        { precision: "high", fact: highFact },
        { precision: "high", fact: unknownFact },
      ]);
      expect(confidenceDegraded).toBe("low");
    });
  });
});
