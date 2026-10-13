// ─── Rule SEC-DATA-003: Sensitive Data Exposure in API Response ────────────────
// Detects API routes returning sensitive model attributes (password hashes, secrets,
// tokens, SSNs) directly into HTTP response payloads without DTO boundaries.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../registry.js";
import type { QueryFacade } from "../../model/query-facade.js";
import type { Finding } from "../../findings/finding.js";
import { fingerprint } from "../../findings/fingerprint.js";
import { verifySensitiveExposure } from "../../findings/verify.js";

const SENSITIVE_FIELDS_REGEX = /\b(passwordHash|password_hash|secretKey|secret_key|apiSecret|api_token|accessToken|refreshToken|ssn|stripeSecret)\b/i;

export const secData003: RuleDef = {
  id: "SEC-DATA-003",
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
      const jsonMatch = /res\.json\s*\(\s*\{?([\s\S]*?)\}?\s*\)/g;
      let match: RegExpExecArray | null;

      while ((match = jsonMatch.exec(content)) !== null) {
        const bodySnippet = match[1]!;
        const hasLeak = SENSITIVE_FIELDS_REGEX.test(bodySnippet);

        if (hasLeak) {
          const method = r.methods[0] || "GET";
          const line = content.slice(0, match.index).split("\n").length;
          const subject = {
            kind: "endpoint" as const,
            stableKey: `${method} ${r.path}`,
            method,
            route: r.path,
          };

          findings.push({
            ruleId: "SEC-DATA-003",
            title: `Sensitive Field Exposure in API Response on ${method} ${r.path}`,
            severity: "critical",
            precision: "high",
            maturity: "stable",
            confidence: "high",
            status: "open",
            subject,
            fingerprint: fingerprint({ ruleId: "SEC-DATA-003", subject }),
            locations: [
              {
                file: r.source.file,
                line,
                endLine: line,
                description: `Sensitive model attribute returned in HTTP response at line ${line}`,
              },
            ],
            evidence: [
              {
                claim: `${method} ${r.path} serializes sensitive internal attributes directly into client response`,
                file: r.source.file,
                line,
                snippet: match[0].slice(0, 100),
              },
              {
                claim: "No DTO boundary or Prisma select projection omits sensitive credentials before serialization",
                file: r.source.file,
                line,
              },
            ],
            whyItMatters:
              "Exposing password hashes, tokens, or private secrets enables account takeover and violates privacy regulations.",
            mightBeFalsePositive: [],
            searched: [{ file: r.source.file, line }],
            agentAction: {
              objective:
                "Use an explicit response DTO or Prisma select/omit clause to exclude sensitive internal fields before returning JSON",
              acceptance: [
                {
                  id: "dto-filters-sensitive-fields",
                  description: "Sensitive attributes must not appear in serialized response objects",
                  check: "response-field-exclusion",
                },
              ],
              doNot: ["Do not suppress", "Do not delete the route"],
              safeToAutoFix: false,
            },
          });
        }
      }
    }

    return findings;
  },

  verify(Q: QueryFacade, before: Finding) {
    return verifySensitiveExposure(Q, before);
  },
};
