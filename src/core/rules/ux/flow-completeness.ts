// ─── Rule UX-FLOW-001: User Flow Missing Critical Stages ───────────────────────
// Detects finite state flow templates (upload, checkout, delete, login) that lack
// essential stages such as error handling, retry mechanisms, or confirmation.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../registry.js";
import type { QueryFacade } from "../../model/query-facade.js";
import type { Finding } from "../../findings/finding.js";
import { fingerprint } from "../../findings/fingerprint.js";

export const uxFlow001: RuleDef = {
  id: "UX-FLOW-001",
  category: "ux",
  mode: "automated",
  severity: "high",
  precision: "high",
  maturity: "stable",
  needs: "static",
  consumes: ["flows"],

  detect(Q: QueryFacade): Finding[] {
    const findings: Finding[] = [];

    for (const flow of Q.flows()) {
      for (const missingStage of flow.stagesMissing) {
        const subject = {
          kind: "flow" as const,
          stableKey: `${flow.template}:${flow.file}:${missingStage}`,
          flow: flow.template,
          missingStage,
        };

        findings.push({
          ruleId: "UX-FLOW-001",
          title: `User Flow '${flow.name}' Missing Critical '${missingStage}' Stage`,
          severity: missingStage === "error" ? "high" : "medium",
          precision: "high",
          maturity: "stable",
          confidence: "high",
          status: "open",
          subject,
          fingerprint: fingerprint({ id: "UX-FLOW-001" }, subject),
          locations: [
            {
              file: flow.file,
              line: flow.line,
              description: `Workflow '${flow.name}' is declared here without '${missingStage}' handling`,
            },
          ],
          evidence: [
            {
              claim: `Workflow '${flow.name}' in ${flow.file} lacks handling for required stage '${missingStage}'`,
              file: flow.file,
              line: flow.line,
            },
            {
              claim: `Stages found: [${flow.stagesFound.join(", ")}]; stages required: [${missingStage}]`,
              file: flow.file,
              line: flow.line,
            },
          ],
          whyItMatters:
            "Workflows without failure or retry stages trap users in stalled states upon network degradation or server errors.",
          mightBeFalsePositive: [
            "A global notification banner or external boundary intercepts unhandled exceptions for this specific flow",
          ],
          searched: [{ file: flow.file, line: flow.line }],
          agentAction: {
            objective: `Implement explicit '${missingStage}' state handling in '${flow.file}'`,
            acceptance: [
              {
                id: `flow-handles-${missingStage}`,
                description: `Add user-visible feedback and transition for stage '${missingStage}'`,
                check: `stage-${missingStage}-rendered`,
              },
            ],
            doNot: ["do not delete the flow", "do not suppress the warning"],
            safeToAutoFix: false,
          },
        });
      }
    }

    return findings;
  },
};
