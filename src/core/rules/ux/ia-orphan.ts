// ─── Rule IA-ORPHAN-001: Orphan Route Lacks Inbound Navigation ──────────────────
// Detects page routes with no inbound links or navigation paths from any reachable
// page in the application's Information Architecture graph.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../registry.js";
import type { QueryFacade } from "../../model/query-facade.js";
import type { Finding } from "../../findings/finding.js";
import { fingerprint } from "../../findings/fingerprint.js";
import { computeReachable } from "../../product/ia-graph.js";

export const iaOrphan001: RuleDef = {
  id: "IA-ORPHAN-001",
  category: "ux",
  mode: "automated",
  severity: "medium",
  precision: "high",
  maturity: "stable",
  needs: "static",
  consumes: ["routes", "iaGraph"],

  detect(Q: QueryFacade): Finding[] {
    const findings: Finding[] = [];
    const graph = Q.iaGraph();
    const reachable = computeReachable(graph);

    for (const r of Q.routes({ kind: "page" })) {
      // 1. Root route is never an orphan
      if (r.path === "/" || r.path === "") continue;

      // 2. Dynamic routes whose inbound links are computed at runtime become unknown, not orphans
      const isDynamic =
        r.params.length > 0 || r.path.includes(":") || r.path.includes("[");
      if (isDynamic) continue;

      // 3. Auth callbacks, error pages, not-found pages are exempt
      const isExempt =
        /auth\/callback|oauth|404|500|not-found|error/i.test(r.path) ||
        r.source.file.includes("not-found") ||
        r.source.file.includes("error.");
      if (isExempt) continue;

      // 4. Check if reachable in IA graph
      if (!reachable.has(r.path)) {
        const subject = {
          kind: "route" as const,
          stableKey: r.path,
          route: r.path,
        };

        findings.push({
          ruleId: "IA-ORPHAN-001",
          title: `Orphan Page Route '${r.path}' Unreachable from Navigation`,
          severity: "medium",
          precision: "high",
          maturity: "stable",
          confidence: "high",
          status: "open",
          subject,
          fingerprint: fingerprint({ id: "IA-ORPHAN-001" }, subject),
          locations: [
            {
              file: r.source.file,
              line: r.source.startLine || 1,
              description: `Page route '${r.path}' is defined here but has no incoming links`,
            },
          ],
          evidence: [
            {
              claim: `Page route '${r.path}' has 0 inbound navigation edges from the application roots: [${graph.roots.join(", ")}]`,
              file: r.source.file,
              line: r.source.startLine || 1,
            },
          ],
          whyItMatters:
            "Orphan pages cannot be discovered by end users through natural navigation and often indicate abandoned features or dead routes.",
          mightBeFalsePositive: [
            "Route is intended exclusively for deep-linking from transactional emails or third-party webhooks",
          ],
          searched: [{ file: r.source.file, line: r.source.startLine || 1 }],
          agentAction: {
            objective: `Add a link to '${r.path}' from the application navigation or relevant parent view`,
            acceptance: [
              {
                id: "route-is-reachable",
                description: `Add an inbound <Link href="${r.path}"> from navigation or dashboard`,
                check: "ia-reachability-verified",
              },
            ],
            doNot: ["do not delete the page route", "do not add fake links"],
            safeToAutoFix: false,
          },
        });
      }
    }

    return findings;
  },
};
