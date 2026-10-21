import { describe, it, expect } from "vitest";
import {
  verifySensitiveExposure,
  verifyPrivilegeEscalation,
  verifyMassAssignment,
  verifyAuthz,
} from "../../src/core/findings/verify.js";
import { createQueryFacade } from "../../src/core/model/query-facade.js";
import type { ProjectModel } from "../../src/core/model/project-model.js";
import { confirmed } from "../../src/core/facts/fact.js";
import type { Finding } from "../../src/core/findings/finding.js";

describe("Anti-Gaming Verification Engine (L8)", () => {
  function makeMockModel(routePath: string, method: string, code: string, hasAdminGuard = false): ProjectModel {
    return {
      rootDir: "/app",
      files: [{ path: "src/api.ts", absolutePath: "/app/src/api.ts", size: 100, content: code }],
      dependencies: [],
      routes: [
        {
          id: "r1",
          path: routePath,
          kind: "api",
          methods: [method],
          handler: { name: "handler", file: "src/api.ts" },
          middlewareChain: confirmed(hasAdminGuard ? [{ name: "requireAdmin" }] : []),
          params: [],
          isPublic: confirmed(false),
          source: { file: "src/api.ts", line: 1 },
        },
      ],
      components: [],
      componentGraph: [],
      apiEndpoints: [],
      entities: [],
      claims: [],
      auth: { detected: true, providers: [], hasMiddleware: true },
      authorization: { detected: true, hasRoleChecks: true, unprotectedRoutesCount: 0 },
      database: { detected: true, hasDirectQueries: false },
      environment: { envFiles: [], missingVarsCount: 0 },
      requirements: [],
      archetype: confirmed("saas-dashboard"),
      coverage: {
        frameworks: [],
        routes: { resolved: 1, unresolved: 0, unresolvedReasons: [] },
        files: { parsed: 1, skipped: { "too-large": 0, binary: 0, "symlink-escape": 0, "depth-limit": 0, "parse-timeout": 0, ignored: 0, "limit-reached": 0 }, parseFailed: [] },
        dynamicConstructs: [],
        rules: [],
      },
      timestamp: new Date().toISOString(),
    };
  }

  const dummyFinding: Finding = {
    ruleId: "TEST",
    title: "Test",
    severity: "high",
    precision: "high",
    maturity: "stable",
    confidence: "high",
    fingerprint: "fp",
    locations: [{ file: "src/api.ts", line: 1 }],
    subject: { route: "/api/profile", method: "GET" },
    agentAction: { objective: "Fix", acceptance: [], doNot: [], safeToAutoFix: false },
    status: "open",
  };

  describe("verifySensitiveExposure", () => {
    it("detects route deletion evasion", () => {
      const emptyModel = makeMockModel("/other/path", "GET", "");
      const Q = createQueryFacade(emptyModel);
      const res = verifySensitiveExposure(Q, dummyFinding);
      expect(res.status).toBe("unresolved");
      if (res.status === "unresolved") {
        expect(res.reasons).toContain("route-or-feature-deleted");
      }
    });

    it("detects sensitive fields leaked in res.json response", () => {
      const code = `app.get('/api/profile', (req, res) => { res.json({ name: user.name, passwordHash: user.passwordHash }); });`;
      const Q = createQueryFacade(makeMockModel("/api/profile", "GET", code));
      const res = verifySensitiveExposure(Q, dummyFinding);
      expect(res.status).toBe("unresolved");
      if (res.status === "unresolved") {
        expect(res.reasons).toContain("check-does-not-dominate-sink");
      }
    });

    it("verifies proper exclusion of sensitive fields", () => {
      const code = `app.get('/api/profile', (req, res) => { res.json({ name: user.name, email: user.email }); });`;
      const Q = createQueryFacade(makeMockModel("/api/profile", "GET", code));
      const res = verifySensitiveExposure(Q, dummyFinding);
      expect(res.status).toBe("resolved");
    });
  });

  describe("verifyPrivilegeEscalation", () => {
    const privFinding: Finding = {
      ...dummyFinding,
      subject: { route: "/api/admin/roles", method: "PATCH" },
    };

    it("detects route deletion evasion", () => {
      const Q = createQueryFacade(makeMockModel("/other", "GET", ""));
      const res = verifyPrivilegeEscalation(Q, privFinding);
      expect(res.status).toBe("unresolved");
    });

    it("detects unresolved privilege escalation when no admin guard or role check is present", () => {
      const code = `app.patch('/api/admin/roles', (req, res) => { db.updateRole(req.body); });`;
      const Q = createQueryFacade(makeMockModel("/api/admin/roles", "PATCH", code, false));
      const res = verifyPrivilegeEscalation(Q, privFinding);
      expect(res.status).toBe("unresolved");
    });

    it("verifies fix via role check", () => {
      const code = `app.patch('/api/admin/roles', (req, res) => { if (req.user?.role === 'admin') db.updateRole(req.body); });`;
      const Q = createQueryFacade(makeMockModel("/api/admin/roles", "PATCH", code, false));
      const res = verifyPrivilegeEscalation(Q, privFinding);
      expect(res.status).toBe("resolved");
    });

    it("verifies fix via admin guard middleware", () => {
      const code = `app.patch('/api/admin/roles', (req, res) => { db.updateRole(req.body); });`;
      const Q = createQueryFacade(makeMockModel("/api/admin/roles", "PATCH", code, true));
      const res = verifyPrivilegeEscalation(Q, privFinding);
      expect(res.status).toBe("resolved");
    });
  });
});
