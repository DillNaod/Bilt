import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeExplain } from "../../../src/commands/explain.js";

describe("Commands: explain", () => {
  let logs: string[] = [];
  let errors: string[] = [];
  const origLog = console.log;
  const origError = console.error;

  beforeEach(() => {
    logs = [];
    errors = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
    console.error = (...args: any[]) => errors.push(args.join(" "));
  });

  afterEach(() => {
    console.log = origLog;
    console.error = origError;
  });

  it("should print category catalog when no target argument is passed", async () => {
    const code = await executeExplain();
    expect(code).toBe(0);
    const output = logs.join("\n");
    expect(output).toContain("BILT PRODUCTION READINESS CONCEPTS");
    expect(output).toContain("auth");
    expect(output).toContain("database");
  });

  it("should explain a known taxonomy category in formatted text", async () => {
    const code = await executeExplain("auth");
    expect(code).toBe(0);
    const output = logs.join("\n");
    expect(output).toContain("Authentication");
  });

  it("should explain a known taxonomy category in JSON format", async () => {
    const code = await executeExplain("database", { json: true });
    expect(code).toBe(0);
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.category).toBe("database");
    expect(parsed.title).toBeDefined();
  });

  it("should support category aliases like 'db' and 'env'", async () => {
    const codeDb = await executeExplain("db", { json: true });
    expect(codeDb).toBe(0);
    const parsedDb = JSON.parse(logs.join("\n"));
    expect(parsedDb.category).toBe("database");

    logs = [];
    const codeEnv = await executeExplain("env", { json: true });
    expect(codeEnv).toBe(0);
    const parsedEnv = JSON.parse(logs.join("\n"));
    expect(parsedEnv.category).toBe("secrets-and-env");
  });

  it("should explain a static security rule by ID", async () => {
    const code = await executeExplain("SEC-CRY-001");
    expect(code).toBe(0);
    const output = logs.join("\n");
    expect(output).toContain("BILT STATIC SECURITY RULE");
    expect(output).toContain("SEC-CRY-001");
  });

  it("should return code 1 and error message on unknown rule ID", async () => {
    const code = await executeExplain("NONEXISTENT-RULE-XYZ");
    expect(code).toBe(1);
    const errOutput = errors.join("\n");
    expect(errOutput).toContain("Unknown category or rule ID: 'NONEXISTENT-RULE-XYZ'");
  });
});
