// ─── Rule SEC-TENANT-001: Multi-Tenant Query Isolation ───────────────────────
// Detects database operations on tenant-scoped entities where queries do not
// enforce tenant scoping from the authenticated session.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../registry.js";
import type { QueryFacade } from "../../model/query-facade.js";
import type { Finding } from "../../findings/finding.js";
import { fingerprint } from "../../findings/fingerprint.js";

export const secTenant001: RuleDef = {
  id: "SEC-TENANT-001",
  category: "security",
  mode: "automated",
  severity: "critical",
  precision: "high",
  maturity: "stable",
  needs: "static",
  consumes: ["routes", "files"],

  detect(Q: QueryFacade): Finding[] {
    const findings: Finding[] = [];

    for (const r of Q.routes({ kind: "api" })) {
      const file = Q.files().find((f) => f.path === r.source.file);
      if (!file) continue;

      const content = file.content;
      // Look for tenant/organization resources queried without tenant scoping
      const isTenantResource = /\/(?:orgs?|organizations?|tenants?|workspaces?)\b/i.test(r.path);
      if (!isTenantResource) continue;

      const hasTenantGuard =
        r.middlewareChain.state === "confirmed" &&
        r.middlewareChain.value.some((m) =>
          m.name.toLowerCase().includes("tenant") || m.name.toLowerCase().includes("org")
        );

      const hasTenantScopingInQuery =
        /tenantId\s*:\s*req\.user/i.test(content) ||
        /orgId\s*:\s*req\.user/i.test(content) ||
        /organizationId\s*:\s*req\.user/i.test(content);

      if (!hasTenantGuard && !hasTenantScopingInQuery) {
        const method = r.methods[0] || "GET";
        const subject = {
          kind: "endpoint" as const,
          stableKey: `${method} ${r.path}`,
          method,
          route: r.path,
        };

        findings.push({
          ruleId: "SEC-TENANT-001",
          title: `Missing Multi-Tenant Isolation on ${method} ${r.path}`,
          severity: "critical",
          precision: "high",
          maturity: "stable",
          confidence: "high",
          status: "open",
          subject,
          fingerprint: fingerprint({ ruleId: "SEC-TENANT-001", subject }),
          locations: [
            {
              file: r.source.file,
              line: r.source.startLine || 1,
              endLine: r.source.endLine || 1,
              description: "Tenant resource accessed without session-derived tenant ID isolation",
            },
          ],
          evidence: [
            {
              claim: `${method} ${r.path} accesses tenant-scoped entity without tenant scoping`,
              file: r.source.file,
              line: r.source.startLine || 1,
            },
          ],
          whyItMatters:
            "Cross-tenant data leakage occurs when queries do not enforce tenant ID boundaries from authenticated sessions.",
          mightBeFalsePositive: [],
          searched: [{ file: r.source.file, line: r.source.startLine }],
          agentAction: {
            objective: "Enforce tenantId scoping on all database queries for multi-tenant entities",
            acceptance: [
              {
                id: "tenant-isolation",
                description: "Queries must scope by session-derived tenant ID",
                check: "tenant-scoping",
              },
            ],
            doNot: ["Do not suppress", "Do not delete the route"],
            safeToAutoFix: false,
          },
        });
      }
    }

    return findings;
  },
};
