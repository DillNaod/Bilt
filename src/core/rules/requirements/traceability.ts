// ─── Requirements Traceability Rules ──────────────────────────────────────────
// Verifies whether developer requirements are backed by real implementation evidence,
// or if only superficial/placeholder UI elements exist.
// ─────────────────────────────────────────────────────────────────────────────

import type { RegisteredRule, RuleFinding } from '../../rule-registry/types.js';
import type { ProjectModel } from '../../project-model/types.js';

// ---------------------------------------------------------------------------
// REQ-TRACE-001: Requirement Unsatisfied or Superficial Only
// ---------------------------------------------------------------------------
export const reqTrace001: RegisteredRule = {
  id: 'REQ-TRACE-001',
  category: 'requirements',
  title: 'Developer Requirement Lacks End-to-End Implementation Evidence',
  severity: 'high',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const requirements = model.requirements || [];

    for (const req of requirements) {
      if (req.status === 'unsatisfied') {
        const evidenceLines = req.evidence.map(
          (e) => `  - [${e.type}] ${e.description} (${e.location.file}${e.location.line ? ':' + e.location.line : ''})`,
        );

        findings.push({
          ruleId: 'REQ-TRACE-001',
          title: `Unsatisfied Requirement: "${req.statement}"`,
          severity: 'high',
          precision: 'high',
          maturity: 'stable',
          category: 'requirements',
          evidence: [
            `Requirement statement: "${req.statement}" (source: ${req.source})`,
            evidenceLines.length > 0
              ? 'Found superficial UI hooks, but missing backend routes, data handling, or business logic:'
              : 'No matching components, routes, or APIs found implementing this requirement.',
            ...evidenceLines,
            'A requirement cannot be declared satisfied by surface button text or UI mockups alone without real implementation behavior.',
          ],
          locations: req.evidence.map((e) => e.location),
          agentObjective: `Implement the full functional behavior for requirement: "${req.statement}", connecting the UI trigger to an active backend handler or service.`,
        });
      }
    }

    return findings;
  },
};
