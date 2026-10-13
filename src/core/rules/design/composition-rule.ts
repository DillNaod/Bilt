// ─── Rule DESIGN-STRUCTURE-001: Generic SaaS Landing Composition ───────────────
// Detects template-driven product design: repeated structures and a co-occurring
// stack of generic moves across >= 4 distinct design families.
// A single signal (e.g. a purple gradient alone) never triggers this rule.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../registry.js";
import type { QueryFacade } from "../../model/query-facade.js";
import type { Finding } from "../../findings/finding.js";
import { fingerprint } from "../../findings/fingerprint.js";
import { detectTemplateMotifs } from "../../design/motifs.js";

export const designStructure001: RuleDef = {
  id: "DESIGN-STRUCTURE-001",
  category: "design",
  mode: "advisory",
  severity: "low",
  precision: "medium",
  maturity: "stable",
  needs: "static",
  consumes: ["files"],

  detect(Q: QueryFacade): Finding[] {
    const findings: Finding[] = [];

    for (const file of Q.files()) {
      // Analyze landing or home pages
      const isPage =
        /page\.[jt]sx?|App\.[jt]sx?|Home\.[jt]sx?|index\.[jt]sx?/i.test(file.path) &&
        !file.path.includes("test") &&
        !file.path.includes("spec");

      if (!isPage) continue;

      const comp = detectTemplateMotifs(file.path, file.content);

      // Strict gating: only fire when >= 5 motifs co-occur across >= 4 distinct families
      if (comp.strong) {
        const subject = {
          kind: "component" as const,
          stableKey: file.path,
          motifsCount: comp.motifs.length,
          familiesCount: comp.families.length,
        };

        findings.push({
          ruleId: "DESIGN-STRUCTURE-001",
          title: "Template-Driven SaaS Composition on Landing Page",
          severity: "low",
          precision: "medium",
          maturity: "stable",
          confidence: "medium",
          status: "open",
          subject,
          fingerprint: fingerprint({ id: "DESIGN-STRUCTURE-001" }, subject),
          locations: [
            {
              file: file.path,
              line: 1,
              description: "Page layout exhibits clustered generic template patterns",
            },
          ],
          evidence: comp.motifs.map((m) => ({
            claim: `[${m.family.toUpperCase()}] ${m.evidence}`,
            file: file.path,
            line: m.line,
          })),
          whyItMatters:
            "Assembling pages from the same cluster of generic template tropes (glow orbs, 3-card icon grids, generic CTAs) makes products indistinguishable from generic AI boilerplate.",
          mightBeFalsePositive: [
            "Project is intentionally styled as a classic B2B SaaS landing page template",
          ],
          searched: [{ file: file.path, line: 1 }],
          agentAction: {
            objective:
              "Refactor template tropes into authentic, domain-specific UI inspired by actual product workflows and real data density",
            acceptance: [
              {
                id: "composition-distinctive",
                description: "Replace repetitive 3-card grids and decorative orbs with real interface elements",
                check: "motifs-reduced-below-threshold",
              },
            ],
            doNot: ["do not just change color from purple to blue", "do not keep the same structure with different icons"],
            safeToAutoFix: false,
          },
        });
      }
    }

    return findings;
  },
};
