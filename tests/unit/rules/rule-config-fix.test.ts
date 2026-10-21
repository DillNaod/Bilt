import { describe, it, expect } from "vitest";
import { apiConfigRules } from "../../../src/core/security-engine/rules/api-config-rules.js";
import type { AstContext } from "../../../src/core/security-engine/types.js";

describe("API Configuration Rules & safeAutoFix", () => {
  const cfg001 = apiConfigRules.find((r) => r.id === "SEC-CFG-001")!;
  const cfg002 = apiConfigRules.find((r) => r.id === "SEC-CFG-002")!;

  it("should detect exposed err.stack in responses (SEC-CFG-001)", () => {
    const code = `
      app.get('/api/users', (req, res) => {
        try {
          doWork();
        } catch (err) {
          res.status(500).json({ error: err.message, stack: err.stack });
        }
      });
    `;

    const ctx: AstContext = {
      filePath: "src/server.ts",
      fileContent: code,
      fileLines: code.split("\n"),
    };

    const findings = cfg001.match(ctx);
    expect(findings.length).toBe(1);
    expect(findings[0]!.ruleId).toBe("SEC-CFG-001");
    expect(findings[0]!.severity).toBe("warning");
  });

  it("should apply safeAutoFix for SEC-CFG-001", () => {
    const code = `res.json({ error: err.message, stack: err.stack });`;
    expect(cfg001.safeAutoFix).toBeDefined();

    const fixResult = cfg001.safeAutoFix!(code, {} as any, { filePath: "src/server.ts", fileContent: code, fileLines: [code] });
    expect(fixResult).not.toBeNull();
    expect(fixResult?.modifiedContent).toContain("process.env.NODE_ENV === 'development' ? err.stack : undefined");

    const noStack = `res.json({ error: err.message });`;
    expect(cfg001.safeAutoFix!(noStack, {} as any, { filePath: "src/server.ts", fileContent: noStack, fileLines: [noStack] })).toBeNull();
  });

  it("should detect missing helmet middleware in Express apps (SEC-CFG-002)", () => {
    const code = `
      import express from 'express';
      const app = express();
      app.listen(3000);
    `;

    const ctx: AstContext = {
      filePath: "src/index.ts",
      fileContent: code,
      fileLines: code.split("\n"),
    };

    const findings = cfg002.match(ctx);
    expect(findings.length).toBe(1);
    expect(findings[0]!.ruleId).toBe("SEC-CFG-002");
  });

  it("should apply safeAutoFix for SEC-CFG-002 on TypeScript files", () => {
    const code = `import express from 'express';\nconst app = express();\napp.listen(3000);`;
    expect(cfg002.safeAutoFix).toBeDefined();

    const ctx: AstContext = {
      filePath: "src/app.ts",
      fileContent: code,
      fileLines: code.split("\n"),
    };

    const fixResult = cfg002.safeAutoFix!(code, {} as any, ctx);
    expect(fixResult).not.toBeNull();
    expect(fixResult?.modifiedContent).toContain("import helmet from 'helmet';");
    expect(fixResult?.modifiedContent).toContain("app.use(helmet());");
  });

  it("should apply safeAutoFix for SEC-CFG-002 on CommonJS files", () => {
    const code = `const express = require('express');\nconst app = express();\napp.listen(3000);`;

    const ctx: AstContext = {
      filePath: "src/app.js",
      fileContent: code,
      fileLines: code.split("\n"),
    };

    const fixResult = cfg002.safeAutoFix!(code, {} as any, ctx);
    expect(fixResult).not.toBeNull();
    expect(fixResult?.modifiedContent).toContain("const helmet = require('helmet');");
    expect(fixResult?.modifiedContent).toContain("app.use(helmet());");
  });
});
