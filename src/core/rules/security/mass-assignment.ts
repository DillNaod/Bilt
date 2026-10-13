// ─── Rule SEC-INPUT-002: Mass Assignment via Unvalidated Payload ───────────────
// Detects request payloads (req.body) flowing directly into ORM mutations without
// schema validation or explicit field allowlisting.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../registry.js";
import type { QueryFacade } from "../../model/query-facade.js";
import type { Finding } from "../../findings/finding.js";
import { fingerprint } from "../../findings/fingerprint.js";
import { verifyMassAssignment } from "../../findings/verify.js";

export const secInput002: RuleDef = {
  id: "SEC-INPUT-002",
  category: "security",
  mode: "automated",
  severity: "high",
  precision: "high",
  maturity: "stable",
  needs: "static",
  consumes: ["routes", "dataflow"],

  detect(Q: QueryFacade): Finding[] {
    const findings: Finding[] = [];
    const unsafeFlows = Q.dataflow("req.body", "orm-write").filter(
      (p) => p.sanitizers.length === 0
    );

    for (const flow of unsafeFlows) {
      const flowLine = flow.source.at.startLine || 1;
      const matchingRoute =
        Q.routes({ kind: "api" }).find(
          (r) =>
            r.source.file === flow.source.at.file &&
            (r.source.startLine === undefined ||
              (flowLine >= r.source.startLine &&
                flowLine <= (r.source.endLine || 999999)))
        ) || Q.routes({ kind: "api" }).find((r) => r.source.file === flow.source.at.file);

      const method = matchingRoute?.methods[0] || "PUT";
      const routePath = matchingRoute?.path || "";

      const subject = {
        kind: "endpoint" as const,
        stableKey: `${method} ${routePath || flow.source.at.file}`,
        method,
        route: routePath,
        file: flow.source.at.file,
      };

      findings.push({
        ruleId: "SEC-INPUT-002",
        title: "Mass Assignment Vulnerability in Persistence Write",
        severity: "high",
        precision: "high",
        maturity: "stable",
        confidence: "high",
        status: "open",
        subject,
        fingerprint: fingerprint({ ruleId: "SEC-INPUT-002", subject }),
        locations: [
          {
            file: flow.source.at.file,
            line: flow.source.at.startLine || 1,
            endLine: flow.sink.at.endLine || flow.source.at.startLine || 1,
            description: "Direct request body flow to ORM mutation without field picking or schema validation",
          },
        ],
        evidence: [
          {
            claim: `Direct taint flow from request payload (${flow.source.kind} at line ${flow.source.at.startLine}) into database mutation (${flow.sink.callee} at line ${flow.sink.at.startLine})`,
            file: flow.source.at.file,
            line: flow.source.at.startLine,
          },
          {
            claim: "Zero schema validation boundaries or field picking mechanisms dominate this write path",
            file: flow.sink.at.file,
            line: flow.sink.at.startLine,
          },
        ],
        whyItMatters:
          "Attackers can supply unexpected parameters (e.g. role: 'admin', balance: 9999, isVerified: true) to overwrite internal model fields.",
        mightBeFalsePositive: [
          "Field allowlisting is handled inside a custom DB repository wrapper",
        ],
        searched: [{ file: flow.source.at.file, line: flow.source.at.startLine }],
        agentAction: {
          objective:
            "Pass input through a strict Zod/Joi schema or explicitly destructure allowed fields before database write",
          acceptance: [
            {
              id: "schema-validates-payload",
              description: "Validator must run on the incoming body before the persistence sink",
              check: "schema-validation-dominance",
            },
          ],
          doNot: [
            "Do not validate dummy copies while passing raw req.body to the database",
            "Do not delete the route",
          ],
          safeToAutoFix: false,
        },
      });
    }

    return findings;
  },

  verify(Q: QueryFacade, before: Finding) {
    return verifyMassAssignment(Q, before);
  },
};
