import { describe, it, expect } from "vitest";
import { secretsAndEnvChecker } from "../../src/core/readiness/checks/secrets-and-env.js";
import type { CheckContext } from "../../src/core/readiness/check-runner.js";

const fakeStripeLiveKey = "sk_live_" + "51MzXYZ1234567890abcdef1234567890";

describe("Readiness Check: secrets-and-env (secretsAndEnvChecker)", () => {
  it("detects committed .env files with real secret values", async () => {
    const context: CheckContext = {
      rootDir: "/app",
      files: [
        {
          path: ".env",
          content: [
            "# Comment line",
            "EMPTY_VAR=",
            "SAFE_VAR=placeholder",
            "NORMAL_VAR=hello_world",
            `STRIPE_SECRET_KEY=${fakeStripeLiveKey}`,
          ].join("\n"),
        },
      ],
      dependencies: [],
      routes: [],
      components: [],
      packageJson: {},
    };

    const findings = await secretsAndEnvChecker.run(context);

    // Should detect committed secret in .env
    const envFinding = findings.find((f) => f.ruleId === "CHECK-SEC-ENV-001");
    expect(envFinding).toBeDefined();
    expect(envFinding?.severity).toBe("critical");

    // Should detect missing .env.example
    const missingExampleFinding = findings.find((f) => f.ruleId === "CHECK-SEC-ENV-004");
    expect(missingExampleFinding).toBeDefined();
  });

  it("does not flag missing .env.example if .env.example is present", async () => {
    const context: CheckContext = {
      rootDir: "/app",
      files: [
        { path: ".env", content: "PORT=3000\n" },
        { path: ".env.example", content: "PORT=3000\n" },
      ],
      dependencies: [],
      routes: [],
      components: [],
      packageJson: {},
    };

    const findings = await secretsAndEnvChecker.run(context);
    expect(findings.some((f) => f.ruleId === "CHECK-SEC-ENV-004")).toBe(false);
  });

  it("detects hardcoded secrets in source files", async () => {
    const context: CheckContext = {
      rootDir: "/app",
      files: [
        {
          path: "src/api/stripe.ts",
          content: `const key = '${fakeStripeLiveKey}';`,
        },
        {
          path: "src/auth/jwt.ts",
          content: "const secret = '-----BEGIN RSA PRIVATE KEY-----\\nMIIEowIBAAKCAQEA0...';",
        },
      ],
      dependencies: [],
      routes: [],
      components: [],
      packageJson: {},
    };

    const findings = await secretsAndEnvChecker.run(context);
    const sourceFindings = findings.filter((f) => f.ruleId === "CHECK-SEC-ENV-002");
    expect(sourceFindings.length).toBeGreaterThan(0);
  });

  it("detects client-side files exposing secrets", async () => {
    const context: CheckContext = {
      rootDir: "/app",
      files: [
        {
          path: "src/components/Checkout.tsx",
          content: [
            "'use client';",
            "export function Checkout() {",
            `  const STRIPE_SECRET = '${fakeStripeLiveKey}';`,
            "  return <div>Checkout</div>;",
            "}",
          ].join("\n"),
        },
      ],
      dependencies: [],
      routes: [],
      components: [],
      packageJson: {},
    };

    const findings = await secretsAndEnvChecker.run(context);
    expect(findings.some((f) => f.ruleId === "CHECK-SEC-ENV-003")).toBe(true);
  });

  it("skips non-source directories like node_modules and dist", async () => {
    const context: CheckContext = {
      rootDir: "/app",
      files: [
        {
          path: "node_modules/pkg/index.js",
          content: `const key = '${fakeStripeLiveKey}';`,
        },
        {
          path: "dist/bundle.js",
          content: `const key = '${fakeStripeLiveKey}';`,
        },
      ],
      dependencies: [],
      routes: [],
      components: [],
      packageJson: {},
    };

    const findings = await secretsAndEnvChecker.run(context);
    expect(findings).toHaveLength(0);
  });
});
