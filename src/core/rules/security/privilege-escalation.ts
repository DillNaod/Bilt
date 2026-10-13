// ─── Rule SEC-AUTHZ-004: Horizontal / Vertical Privilege Escalation ───────────
// Detects API routes that permit client modification of roles, administrative flags,
// or entitlements without administrative authorization guards.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../registry.js";
import type { QueryFacade } from "../../model/query-facade.js";
import type { Finding } from "../../findings/finding.js";
import { fingerprint } from "../../findings/fingerprint.js";
import { verifyPrivilegeEscalation } from "../../findings/verify.js";

export const secAuthz004: RuleDef = {
  id: "SEC-AUTHZ-004",
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
      const modifiesRole =
        /role\s*:\s*req\.body\.role/i.test(content) ||
        /isAdmin\s*:\s*req\.body\.isAdmin/i.test(content) ||
        /permissions\s*:\s*req\.body\.permissions/i.test(content);

      if (!modifiesRole) continue;

      const hasAdminGuard =
        r.middlewareChain.state === "confirmed" &&
        r.middlewareChain.value.some((m) => m.name.toLowerCase().includes("admin"));

      const hasRoleCheck = /req\.user\??\.role\s*===\s*['"`]admin['"`]/.test(content);

      if (!hasAdminGuard && !hasRoleCheck) {
        const method = r.methods[0] || "PATCH";
        const subject = {
          kind: "endpoint" as const,
          stableKey: `${method} ${r.path}`,
          method,
          route: r.path,
        };

        findings.push({
          ruleId: "SEC-AUTHZ-004",
          title: `Privilege Escalation Risk: Unprotected Role Mutation on ${method} ${r.path}`,
          severity: "critical",
          precision: "high",
          maturity: "stable",
          confidence: "high",
          status: "open",
          subject,
          fingerprint: fingerprint({ ruleId: "SEC-AUTHZ-004", subject }),
          locations: [
            {
              file: r.source.file,
              line: r.source.startLine || 1,
              endLine: r.source.endLine || 1,
              description: `Route permits role/entitlement mutations without administrative guards`,
            },
          ],
          evidence: [
            {
              claim: `${method} ${r.path} accepts client-supplied role/privilege updates without administrative check`,
              file: r.source.file,
              line: r.source.startLine || 1,
            },
            {
              claim: "No admin middleware or server-side role gate dominates this write operation",
              file: r.source.file,
              line: r.source.startLine || 1,
            },
          ],
          whyItMatters:
            "Standard callers can promote their own or other accounts to administrator status directly through the API.",
          mightBeFalsePositive: [],
          searched: [{ file: r.source.file, line: r.source.startLine }],
          agentAction: {
            objective:
              "Require an administrative authorization guard (e.g. requireAdmin, AdminGuard) before allowing role or permission changes",
            acceptance: [
              {
                id: "admin-guard-dominates-role-mutation",
                description: "Administrative authorization guard must dominate role mutations",
                check: "role-guard-dominance",
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

  verify(Q: QueryFacade, before: Finding) {
    return verifyPrivilegeEscalation(Q, before);
  },
};
