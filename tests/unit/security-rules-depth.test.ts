import { describe, it, expect } from "vitest";
import { SecretAnalyzer } from "../../src/core/security-engine/secret-analyzer.js";
import { SecurityRuleEngine } from "../../src/core/security-engine/rule-engine.js";
import { SecurityRulesEngine } from "../../src/core/engine/wrappers/security-rules-engine.js";
import { DEFAULT_CONFIG } from "../../src/config/config.js";

describe("Security Rules & Behavioral Verification In-Depth", () => {
  describe("SecretAnalyzer Classification: Positive, Negative & Public Configurations", () => {
    it("should accept public client configuration variables without flagging as secrets", () => {
      const publicConfigs = [
        { key: "NEXT_PUBLIC_API_URL", val: "https://api.example.com" },
        { key: "VITE_PUBLIC_SUPABASE_URL", val: "https://xyz.supabase.co" },
        { key: "PUBLIC_ANALYTICS_ID", val: "UA-12345678-1" },
        { key: "REACT_APP_PUBLIC_STRIPE_KEY", val: "pk_test_51Abcdef1234567890" },
        { key: "EXPO_PUBLIC_APP_ENV", val: "staging" },
      ];

      for (const { key, val } of publicConfigs) {
        const result = SecretAnalyzer.classifyKey(key, val);
        expect(result.isSafe).toBe(true);
        expect(result.isSecret).toBe(false);
        expect(result.type).toBe("client_public_var");
      }
    });

    it("should accept safe publishable keys without flagging as secret leaks", () => {
      const safeKeys = [
        { key: "STRIPE_PUBLISHABLE_KEY", val: "pk_test_4eC39HqLyjWDarjtT1zdp7dc" },
        { key: "NEXT_PUBLIC_STRIPE_PK", val: "pk_live_4eC39HqLyjWDarjtT1zdp7dc" },
        { key: "SUPABASE_ANON_KEY", val: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
      ];

      for (const { key, val } of safeKeys) {
        const result = SecretAnalyzer.classifyKey(key, val);
        expect(result.isSafe).toBe(true);
      }
    });

    it("should classify unsafe secret patterns with high confidence", () => {
      const dangerousPatterns = [
        { key: "SUPABASE_SERVICE_ROLE_KEY", val: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.supersecretadmin" },
        { key: "DATABASE_URL", val: "postgres://admin:SuperSecretPassword123@db.cloud.io:5432/main" },
        { key: "AWS_SECRET_ACCESS_KEY", val: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" },
        { key: "JWT_SECRET", val: "super-secure-production-jwt-signing-secret" },
        { key: "STRIPE_SECRET_KEY", val: ["sk", "test", "51H1a2b3c4d5e6f7g8h9i0jkl"].join("_") },
        { key: "GITHUB_TOKEN", val: "ghp_1234567890abcdefghijklmnopqrstuvwxyz" },
      ];

      for (const { key, val } of dangerousPatterns) {
        const result = SecretAnalyzer.classifyKey(key, val);
        expect(result.isSafe).toBe(false);
        expect(result.isSecret).toBe(true);
        expect(result.confidence).toBe("high");
      }
    });

    it("should scan raw text and extract embedded secrets while ignoring public values", () => {
      const syntheticStripe = ["sk", "test", "51H1a2b3c4d5e6f7g8h9i0jkl"].join("_");
      const text = `
        const pub = "pk_test_4eC39HqLyjWDarjtT1zdp7dc";
        const priv = "${syntheticStripe}";
        const db = "postgres://root:p4ssw0rd@localhost:5432/prod";
      `;

      const findings = SecretAnalyzer.scanTextForSecrets(text, "src/config.ts");
      expect(findings.length).toBeGreaterThanOrEqual(2);
      expect(findings.some((f) => f.type === "stripe_secret")).toBe(true);
      expect(findings.some((f) => f.type === "database_password")).toBe(true);
      // Publishable key pk_test_ must not be reported as a secret finding
      expect(findings.some((f) => f.type === "publishable_key")).toBe(false);
    });
  });

  describe("SecurityRuleEngine: Rule Detection Positive vs Negative Fixtures", () => {
    const engine = new SecurityRuleEngine();

    describe("SEC-AUTHZ-001: Client-Supplied Privilege Flag", () => {
      it("POSITIVE: should detect client-supplied privilege flags in request body", () => {
        const code = `
          app.post("/users", (req, res) => {
            const isAdmin = req.body.isAdmin;
            if (isAdmin) {
              grantPrivileges();
            }
          });
        `;
        const findings = engine.analyzeFile("src/routes/users.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-AUTHZ-001");
        expect(match).toBeDefined();
        expect(match?.severity).toBe("critical");
      });

      it("NEGATIVE: should accept authorization roles derived from verified server session", () => {
        const code = `
          app.post("/users", (req, res) => {
            const isAdmin = req.session?.user?.role === "admin";
            if (isAdmin) {
              grantPrivileges();
            }
          });
        `;
        const findings = engine.analyzeFile("src/routes/users.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-AUTHZ-001");
        expect(match).toBeUndefined();
      });
    });

    describe("SEC-AUTHZ-002: Missing Resource Ownership Verification (IDOR)", () => {
      it("POSITIVE: should detect route parameter queries without owner/user isolation", () => {
        const code = `
          app.get("/api/documents/:id", async (req, res) => {
            const doc = await db.findById(req.params.id);
            res.json(doc);
          });
        `;
        const findings = engine.analyzeFile("src/routes/documents.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-AUTHZ-002");
        expect(match).toBeDefined();
        expect(match?.severity).toBe("warning");
      });

      it("NEGATIVE: should accept queries scoped by user/session ownership", () => {
        const code = `
          app.get("/api/documents/:id", async (req, res) => {
            const doc = await db.findById({ id: req.params.id, userId: req.session.userId });
            res.json(doc);
          });
        `;
        const findings = engine.analyzeFile("src/routes/documents.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-AUTHZ-002");
        expect(match).toBeUndefined();
      });
    });

    describe("SEC-INP-001: Dangerous Dynamic Code Execution (eval)", () => {
      it("POSITIVE: should detect dynamic eval call with variable expression", () => {
        const code = `
          function calculate(expression) {
            return eval(expression);
          }
        `;
        const findings = engine.analyzeFile("src/utils/calc.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-INP-001");
        expect(match).toBeDefined();
        expect(match?.severity).toBe("critical");
      });

      it("NEGATIVE: should accept safe JSON parsing", () => {
        const code = `
          function parseData(jsonStr) {
            return JSON.parse(jsonStr);
          }
        `;
        const findings = engine.analyzeFile("src/utils/calc.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-INP-001");
        expect(match).toBeUndefined();
      });
    });

    describe("SEC-INP-002: Shell Command Injection", () => {
      it("POSITIVE: should detect variable concatenation in child_process exec", () => {
        const code = `
          import { exec } from "child_process";
          app.get("/ping", (req, res) => {
            exec("ping -c 1 " + req.query.host);
          });
        `;
        const findings = engine.analyzeFile("src/routes/ping.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-INP-002");
        expect(match).toBeDefined();
        expect(match?.severity).toBe("critical");
      });

      it("NEGATIVE: should accept parameterized execFile with arguments array", () => {
        const code = `
          import { execFile } from "child_process";
          app.get("/ping", (req, res) => {
            execFile("ping", ["-c", "1", String(req.query.host)]);
          });
        `;
        const findings = engine.analyzeFile("src/routes/ping.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-INP-002");
        expect(match).toBeUndefined();
      });
    });

    describe("SEC-INP-003: SQL Injection via String Concatenation", () => {
      it("POSITIVE: should detect SQL queries constructed with string concatenation", () => {
        const code = `
          async function findUser(req) {
            return db.query("SELECT * FROM users WHERE email = '" + req.body.email + "'");
          }
        `;
        const findings = engine.analyzeFile("src/models/user.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-INP-003");
        expect(match).toBeDefined();
        expect(match?.severity).toBe("critical");
      });

      it("NEGATIVE: should accept parameterized SQL query bindings", () => {
        const code = `
          async function findUser(email) {
            return db.query("SELECT * FROM users WHERE email = $1", [email]);
          }
        `;
        const findings = engine.analyzeFile("src/models/user.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-INP-003");
        expect(match).toBeUndefined();
      });
    });

    describe("SEC-CFG-001: Verbose Error Details or Stack Trace Exposed", () => {
      it("POSITIVE: should detect error stack trace in API response", () => {
        const code = `
          app.use((err, req, res, next) => {
            res.status(500).json({ error: err.message, stack: err.stack });
          });
        `;
        const findings = engine.analyzeFile("src/middleware/error.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-CFG-001");
        expect(match).toBeDefined();
        expect(match?.severity).toBe("warning");
      });

      it("NEGATIVE: should accept generic sanitized error response", () => {
        const code = `
          app.use((err, req, res, next) => {
            logger.error(err);
            res.status(500).json({ error: "An unexpected error occurred" });
          });
        `;
        const findings = engine.analyzeFile("src/middleware/error.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-CFG-001");
        expect(match).toBeUndefined();
      });
    });

    describe("SEC-CFG-002: Missing Helmet Security Headers", () => {
      it("POSITIVE: should flag Express app without helmet middleware", () => {
        const code = `
          import express from "express";
          const app = express();
          app.listen(3000);
        `;
        const findings = engine.analyzeFile("src/server.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-CFG-002");
        expect(match).toBeDefined();
      });

      it("NEGATIVE: should accept Express app with helmet registered", () => {
        const code = `
          import express from "express";
          import helmet from "helmet";
          const app = express();
          app.use(helmet());
          app.listen(3000);
        `;
        const findings = engine.analyzeFile("src/server.ts", code);
        const match = findings.find((f) => f.ruleId === "SEC-CFG-002");
        expect(match).toBeUndefined();
      });
    });
  });

  describe("SecurityRulesEngine Wrapper Integration", () => {
    it("should analyze project files and emit ScanFinding objects with aiExplanation", async () => {
      const wrapper = new SecurityRulesEngine();
      expect(wrapper.id).toBe("security-rules");

      const filePayloads = [
        {
          path: "src/api/auth.ts",
          content: 'const isAdmin = req.body.isAdmin;\nif (eval("true")) {}',
        },
      ];

      const findings = await wrapper.analyze({
        rootDir: "/app",
        config: DEFAULT_CONFIG,
        files: filePayloads,
      });

      expect(findings.length).toBeGreaterThan(0);
      const finding = findings[0]!;
      expect(finding.category).toBe("framework-warning");
      expect(finding.aiExplanation).toBeDefined();
      expect(finding.aiExplanation?.whatIsIt).toBeDefined();
      expect(finding.aiExplanation?.howToFix).toBeDefined();
    });
  });
});
