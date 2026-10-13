// ─── Rule UI-FAKE-METRIC-001: Hardcoded Metric Presented Without Data Source ──
// Detects hardcoded numeric metrics (e.g. "10,000+ active users", "99.9% uptime")
// presented as live measurements without any backend query, API call, or prop.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../registry.js";
import type { QueryFacade } from "../../model/query-facade.js";
import type { Finding } from "../../findings/finding.js";
import { fingerprint } from "../../findings/fingerprint.js";

export const uiFakeMetric001: RuleDef = {
  id: "UI-FAKE-METRIC-001",
  category: "ux",
  mode: "automated",
  severity: "medium",
  precision: "high",
  maturity: "stable",
  needs: "static",
  consumes: ["metricDisplays"],

  detect(Q: QueryFacade): Finding[] {
    const findings: Finding[] = [];

    for (const m of Q.metricDisplays()) {
      if (!m.hasDataSource) {
        const subject = {
          kind: "component" as const,
          stableKey: `${m.at.file}:${m.at.startLine || 1}:${m.literal}`,
          literal: m.literal,
          label: m.labeledAs,
        };

        findings.push({
          ruleId: "UI-FAKE-METRIC-001",
          title: `Hardcoded Product Metric '${m.literal} ${m.labeledAs}' Lacks Data Source`,
          severity: "medium",
          precision: "high",
          maturity: "stable",
          confidence: "high",
          status: "open",
          subject,
          fingerprint: fingerprint({ id: "UI-FAKE-METRIC-001" }, subject),
          locations: [
            {
              file: m.at.file,
              line: m.at.startLine || 1,
              description: `Metric '${m.literal} ${m.labeledAs}' is hardcoded in JSX text without dynamic data source`,
            },
          ],
          evidence: [
            {
              claim: `UI displays hardcoded literal '${m.literal}' with measure label '${m.labeledAs}'`,
              file: m.at.file,
              line: m.at.startLine || 1,
            },
            {
              claim: "No corresponding database query, API fetch, or dynamic state hook feeds this metric",
              file: m.at.file,
              line: m.at.startLine || 1,
            },
          ],
          whyItMatters:
            "Hardcoded product statistics erode user trust and convey mock template quality rather than authentic production software.",
          mightBeFalsePositive: [
            "Metric is static marketing copy on a public brochure page rather than application UI",
          ],
          searched: [{ file: m.at.file, line: m.at.startLine || 1 }],
          agentAction: {
            objective: `Connect '${m.labeledAs}' to a real telemetry/analytics API endpoint or remove mock metric`,
            acceptance: [
              {
                id: "metric-is-dynamic",
                description: `Fetch metric from real telemetry query or remove placeholder '${m.literal}'`,
                check: "dynamic-source-dominates",
              },
            ],
            doNot: ["do not fabricate randomized placeholder numbers in mock state"],
            safeToAutoFix: false,
          },
        });
      }
    }

    return findings;
  },
};
