import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { CallGraph, buildCallGraph } from "../../../src/core/flow/callgraph.js";
import { validateEvidence } from "../../../src/core/readiness/evidence.js";
import { requirementsChecker } from "../../../src/core/readiness/checks/requirements.js";
import { secTenant001 } from "../../../src/core/rules/security/tenancy.js";
import {
  saveAcceptedRisk,
  loadAcceptedRisks,
  loadAllAcceptedRisksRaw,
} from "../../../src/core/readiness/risk-acceptance.js";
import { upsertRequirement } from "../../../src/core/contract/requirements.js";
import type { RepoIndex } from "../../../src/core/model/types.js";
import { createQueryFacade } from "../../../src/core/model/query-facade.js";
import { confirmed } from "../../../src/core/facts/fact.js";

describe("Core Subsystems: Call Graph, Evidence, Requirements, Tenancy, Risk Acceptance", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-subsystems-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("CallGraph & Symbol Resolution", () => {
    it("should build static call graph and resolve callers and callees", () => {
      const repoIndex: RepoIndex = {
        root: "/test",
        files: [
          {
            path: "service.ts",
            extension: ".ts",
            language: "typescript",
            bytes: Buffer.from(`
              function handlePayment(userId, amount) {
                validateUser(userId);
                chargeCard(amount);
              }
              function chargeCard(amount) {
                apiCall("/charge", amount);
              }
            `),
            hash: "123",
            lineCount: 10,
          },
        ],
        manifests: [],
        routes: [],
        configs: [],
      };

      const g = buildCallGraph(repoIndex);
      const edges = g.getEdges();
      expect(edges.length).toBeGreaterThan(0);

      const callees = g.calleesOf("handlePayment");
      expect(callees.some((e) => e.to.state === "confirmed" && e.to.value.name === "validateUser")).toBe(true);
      expect(callees.some((e) => e.to.state === "confirmed" && e.to.value.name === "chargeCard")).toBe(true);

      const callers = g.callersOf("chargeCard");
      expect(callers.length).toBe(1);
      expect(callers[0]?.from.name).toBe("handlePayment");
    });

    it("should handle dynamic computed call properties as unknown facts", () => {
      const repoIndex: RepoIndex = {
        root: "/test",
        files: [
          {
            path: "dynamic.ts",
            extension: ".ts",
            language: "typescript",
            bytes: Buffer.from(`
              function dispatch(handlerName) {
                handlers[handlerName]();
              }
            `),
            hash: "456",
            lineCount: 5,
          },
        ],
        manifests: [],
        routes: [],
        configs: [],
      };

      const g = buildCallGraph(repoIndex);
      const edges = g.getEdges();
      expect(edges.some((e) => e.to.state === "unknown")).toBe(true);
    });
  });

  describe("Guided Evidence Validation", () => {
    it("should validate well-formed evidence with matching ruleId and file:line location", () => {
      const evidence = {
        ruleId: "AUTHZ-CHECK-001",
        evidence_location: "src/api/auth.ts:42",
        authorization_required: true,
      };

      const result = validateEvidence(evidence, "AUTHZ-CHECK-001");
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject evidence with mismatched ruleId or invalid location format", () => {
      const badEvidence = {
        ruleId: "OTHER-RULE",
        evidence_location: "no-line-number.ts",
      };

      const result = validateEvidence(badEvidence, "AUTHZ-CHECK-001");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]).toContain("ruleId does not match");
      expect(result.errors[1]).toContain("evidence_location must be a valid file:line format");
    });

    it("should reject non-object evidence", () => {
      expect(validateEvidence(null, "ANY").valid).toBe(false);
      expect(validateEvidence("string", "ANY").valid).toBe(false);
    });
  });

  describe("Requirements Readiness Check", () => {
    it("should return findings when requirement specifies a missing target file", async () => {
      await upsertRequirement(tmpDir, {
        id: "REQ-AUTH-FLOW",
        description: "User authentication route required",
        type: "authentication",
        priority: "critical",
        source: "developer",
        targetFiles: ["src/auth/login.ts"],
      });

      const context: any = {
        rootDir: tmpDir,
        files: [
          { path: "src/index.ts", content: "" },
        ],
      };

      const findings = await requirementsChecker.run(context);
      expect(findings.length).toBe(1);
      expect(findings[0]?.ruleId).toBe("REQ-MISSING-REQ-AUTH-FLOW");
      expect(findings[0]?.severity).toBe("critical");
      expect(findings[0]?.title).toContain("Unfulfilled Project Requirement");
    });

    it("should pass when target implementation file exists", async () => {
      await upsertRequirement(tmpDir, {
        id: "REQ-AUTH-FLOW",
        description: "User authentication route required",
        type: "authentication",
        priority: "high",
        source: "developer",
        targetFiles: ["src/auth/login.ts"],
      });

      const context: any = {
        rootDir: tmpDir,
        files: [
          { path: "src/auth/login.ts", content: "export const login = () => {};" },
        ],
      };

      const findings = await requirementsChecker.run(context);
      expect(findings.length).toBe(0);
    });
  });

  describe("Multi-Tenant Query Isolation (SEC-TENANT-001)", () => {
    it("should flag tenant endpoint lacking tenantId scoping or guard", () => {
      const mockModel: any = {
        routes: [
          {
            path: "/api/organizations/billing",
            methods: ["GET"],
            kind: "api",
            source: { file: "src/routes/org.ts", startLine: 10, endLine: 25 },
            middlewareChain: confirmed([]),
          },
        ],
        files: [
          {
            path: "src/routes/org.ts",
            content: `
              export async function getBilling(req, res) {
                const billing = await db.query("SELECT * FROM billing WHERE id = ?", [req.params.id]);
                res.json(billing);
              }
            `,
          },
        ],
        framework: "express",
      };

      const Q = createQueryFacade(mockModel);
      const findings = secTenant001.detect(Q);

      expect(findings.length).toBe(1);
      expect(findings[0]?.ruleId).toBe("SEC-TENANT-001");
      expect(findings[0]?.severity).toBe("critical");
      expect(findings[0]?.title).toContain("Missing Multi-Tenant Isolation");
    });

    it("should accept tenant endpoint with req.user.tenantId scoping in query", () => {
      const mockModel: any = {
        routes: [
          {
            path: "/api/organizations/billing",
            methods: ["GET"],
            kind: "api",
            source: { file: "src/routes/org.ts", startLine: 10, endLine: 25 },
            middlewareChain: confirmed([]),
          },
        ],
        files: [
          {
            path: "src/routes/org.ts",
            content: `
              export async function getBilling(req, res) {
                const billing = await db.query("SELECT * FROM billing WHERE id = ?", { tenantId: req.user.tenantId });
                res.json(billing);
              }
            `,
          },
        ],
        framework: "express",
      };

      const Q = createQueryFacade(mockModel);
      const findings = secTenant001.detect(Q);
      expect(findings.length).toBe(0);
    });
  });

  describe("Risk Acceptance Protocol", () => {
    it("should prohibit risk acceptance on mandatory security categories", async () => {
      const result = await saveAcceptedRisk(tmpDir, {
        findingId: "AUTH-001",
        category: "auth",
        reason: "Shipping without auth anyway",
        owner: "developer",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("mandatory production readiness category");
    });

    it("should save and load accepted risk on non-mandatory category", async () => {
      const result = await saveAcceptedRisk(tmpDir, {
        findingId: "OBS-001",
        category: "monitoring-rollback",
        reason: "Pre-launch MVP without Sentry",
        owner: "alice@example.com",
        expires: new Date(Date.now() + 86400000).toISOString(), // expires in 1 day
      });

      expect(result.success).toBe(true);

      const activeRisks = await loadAcceptedRisks(tmpDir);
      expect(activeRisks.length).toBe(1);
      expect(activeRisks[0]?.findingId).toBe("OBS-001");
      expect(activeRisks[0]?.owner).toBe("alice@example.com");
    });

    it("should filter out expired accepted risks", async () => {
      await saveAcceptedRisk(tmpDir, {
        findingId: "EXPIRED-001",
        category: "deploy-config",
        reason: "Old risk acceptance",
        owner: "bob@example.com",
        expires: new Date(Date.now() - 10000).toISOString(), // expired in the past
      });

      const activeRisks = await loadAcceptedRisks(tmpDir);
      expect(activeRisks.length).toBe(0);

      const rawRisks = await loadAllAcceptedRisksRaw(tmpDir);
      expect(rawRisks.length).toBe(1);
      expect(rawRisks[0]?.findingId).toBe("EXPIRED-001");
    });
  });
});
