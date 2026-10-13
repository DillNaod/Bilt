// ─── Rule SEC-AUTHZ-001: Parameter Query Lacks Ownership Check (IDOR/BOLA) ───────
// Detects API routes that accept dynamic parameters and perform database operations
// with authentication but without resource ownership or tenancy checks.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../registry.js";
import type { QueryFacade } from "../../model/query-facade.js";
import type { Finding } from "../../findings/finding.js";
import { fingerprint } from "../../findings/fingerprint.js";
import { verifyAuthz } from "../../findings/verify.js";

export const secAuthz001: RuleDef = {
  id: "SEC-AUTHZ-001",
  category: "security",
  mode: "automated",
  severity: "high",
  precision: "high",
  maturity: "stable",
  needs: "static",
  consumes: ["routes", "endpoints", "securityModel"],

  detect(Q: QueryFacade): Finding[] {
    const findings: Finding[] = [];

    for (const r of Q.routes({ kind: "api" })) {
      const hasParam = r.params.length > 0 || r.path.includes(":") || r.path.includes("[");
      if (!hasParam) continue;

      const ep = Q.endpoint(r.methods[0] || "GET", r.path);
      if (!ep) continue;

      const sm = Q.securityModel(ep);
      if (sm.state !== "confirmed") continue;

      const model = sm.value;
      const hasRoleGuard =
        r.middlewareChain.state === "confirmed" &&
        r.middlewareChain.value.some((m) => {
          const n = m.name.toLowerCase();
          return n.includes("admin") || n.includes("role") || n.includes("scope");
        });
      if (hasRoleGuard) continue;

      const isAuthn = model.hasAuth.state === "confirmed" && model.hasAuth.value === true;
      const lacksOwnership = model.hasOwnershipCheck.state === "absent";

      if (isAuthn && lacksOwnership) {
        const method = r.methods[0] || "GET";
        const subject = {
          kind: "endpoint" as const,
          stableKey: `${method} ${r.path}`,
          method,
          route: r.path,
        };

        findings.push({
          ruleId: "SEC-AUTHZ-001",
          title: `IDOR / BOLA Vulnerability on ${method} ${r.path}`,
          severity: "high",
          precision: "high",
          maturity: "stable",
          confidence: "high",
          status: "open",
          subject,
          fingerprint: fingerprint({ ruleId: "SEC-AUTHZ-001", subject }),
          locations: [
            {
              file: r.source.file,
              line: r.source.startLine || 1,
              endLine: r.source.endLine || 1,
              description: `Endpoint ${method} ${r.path} lacks ownership verification`,
            },
          ],
          evidence: [
            {
              claim: `${method} ${r.path} authenticates the caller but lacks resource ownership check`,
              file: r.source.file,
              line: r.source.startLine || 1,
            },
            {
              claim: `Database lookup uses client route parameter (${r.params.join(", ")}) without session ownership scoping`,
              file: r.source.file,
              line: r.source.startLine || 1,
            },
          ],
          whyItMatters:
            "An authenticated caller can supply arbitrary object IDs to inspect or mutate resources belonging to other tenants or users.",
          mightBeFalsePositive: [
            "The resource is intentionally public and unowned",
            "Row-Level Security (RLS) is enforced transparently in the database layer",
          ],
          searched: [{ file: r.source.file, line: r.source.startLine }],
          agentAction: {
            objective:
              "Scope database queries by both resource ID and authenticated user/tenant ID (e.g. where: { id: req.params.id, userId: req.user.id })",
            acceptance: [
              {
                id: "ownership-check-dominates",
                description: "Ownership check must dominate data access on every execution path",
                check: "ownership-dominance",
              },
            ],
            doNot: [
              "Do not suppress with inline comments",
              "Do not delete the route or feature",
              "Do not place checks inside dead branches or after the data sink",
            ],
            safeToAutoFix: false,
          },
        });
      }
    }

    return findings;
  },

  verify(Q: QueryFacade, before: Finding) {
    return verifyAuthz(Q, before);
  },
};
