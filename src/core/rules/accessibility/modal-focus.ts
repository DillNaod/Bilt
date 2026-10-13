// ─── Rule A11Y-MODAL-001: Dialog Lacks Focus Management ────────────────────────
// Detects custom dialog, sheet, and modal components that do not manage keyboard
// focus into the dialog upon opening or restore focus upon closure.
// (Standard libraries such as @radix-ui/react-dialog, Headless UI, React Aria pass automatically).
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleDef } from "../registry.js";
import type { QueryFacade } from "../../model/query-facade.js";
import type { Finding } from "../../findings/finding.js";
import { fingerprint } from "../../findings/fingerprint.js";

export const a11yModal001: RuleDef = {
  id: "A11Y-MODAL-001",
  category: "ux",
  mode: "automated",
  severity: "high",
  precision: "high",
  maturity: "stable",
  needs: "static",
  consumes: ["dialogs"],

  detect(Q: QueryFacade): Finding[] {
    const findings: Finding[] = [];

    for (const d of Q.dialogs()) {
      // Library-managed dialogs (@radix-ui/react-dialog, Headless UI, etc.) pass automatically
      if (d.isManagedByLib) continue;

      if (!d.movesFocusIn || !d.restoresFocus) {
        const subject = {
          kind: "component" as const,
          stableKey: `${d.file}:${d.line}`,
          component: d.name,
        };

        const missingMechanisms: string[] = [];
        if (!d.movesFocusIn) missingMechanisms.push("initial focus trapping into dialog");
        if (!d.restoresFocus) missingMechanisms.push("focus restoration to trigger on dismiss");

        findings.push({
          ruleId: "A11Y-MODAL-001",
          title: `Modal/Dialog '${d.name}' Lacks Focus Trapping and Restoration`,
          severity: "high",
          precision: "high",
          maturity: "stable",
          confidence: "high",
          status: "open",
          subject,
          fingerprint: fingerprint({ id: "A11Y-MODAL-001" }, subject),
          locations: [
            {
              file: d.file,
              line: d.line,
              description: `Dialog '${d.name}' is declared here without focus management`,
            },
          ],
          evidence: [
            {
              claim: `Dialog '${d.name}' in ${d.file} does not trap or restore focus. Missing: ${missingMechanisms.join(", ")}`,
              file: d.file,
              line: d.line,
            },
            {
              claim:
                "Component is custom-authored rather than using an accessible primitive (@radix-ui, @headlessui, react-aria)",
              file: d.file,
              line: d.line,
            },
          ],
          whyItMatters:
            "Without focus trapping, screen reader and keyboard-only users will navigate behind the modal overlay into inactive content.",
          mightBeFalsePositive: [
            "Focus management is handled by an external wrapper component in a higher-level layout",
          ],
          searched: [{ file: d.file, line: d.line }],
          agentAction: {
            objective: `Use an accessible primitive like Radix Dialog or add focus-trap and return-focus logic to '${d.name}'`,
            acceptance: [
              {
                id: "dialog-manages-focus",
                description: "Dialog moves focus inside when mounted and restores focus when closed",
                check: "focus-management-verified",
              },
            ],
            doNot: ["do not hide focus outlines", "do not dismiss accessibility warnings without fixing"],
            safeToAutoFix: false,
          },
        });
      }
    }

    return findings;
  },
};
