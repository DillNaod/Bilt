// ─── Data Flow Security Rules ────────────────────────────────────────────────
// Traces complete end-to-end data flows:
// request input → controller boundary → service layer → database persistence.
// ─────────────────────────────────────────────────────────────────────────────

import type { RegisteredRule, RuleFinding } from '../../rule-registry/types.js';
import type { ProjectModel } from '../../project-model/types.js';

// ---------------------------------------------------------------------------
// SEC-FLOW-001: Unvalidated Input Flowing to Database Write
// ---------------------------------------------------------------------------
export const secFlow001: RegisteredRule = {
  id: 'SEC-FLOW-001',
  category: 'security-flow',
  title: 'End-to-End Trace: Unvalidated Request Input Flows Directly to Database Write',
  severity: 'critical',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const ep of model.apiEndpoints) {
      const writes = ep.dbOperations.filter((op) => op.type === 'write');
      const hasWrites = writes.length > 0 || /create|update|upsert|save|insert/i.test(ep.handlerContent);

      // Condition 1: Accepts request body
      // Condition 2: No schema validation boundary
      // Condition 3: Has database write operations
      // Condition 4: No explicit field destructuring
      if (ep.acceptsReqBody && !ep.hasInputValidation && hasWrites && !ep.hasExplicitFieldSelection) {
        findings.push({
          ruleId: 'SEC-FLOW-001',
          title: `Unvalidated Data Flow: ${ep.method} ${ep.path} Binds Client Body to Persistence Layer`,
          severity: 'critical',
          precision: 'high',
          maturity: 'stable',
          category: 'security-flow',
          evidence: [
            `Complete unvalidated data pipeline traced on ${ep.method} ${ep.path}:`,
            '  1. Request input boundary: req.body accepted without schema parser',
            '  2. Validation boundary: zero validation schemas or sanitizers executed',
            '  3. Persistence boundary: database write operation invoked with unconstrained data',
            `Source location: ${ep.file}:${ep.line}`,
            'This enables injection attacks, mass parameter overwrite, and unpredictable schema corruption.',
          ],
          locations: [{ file: ep.file, line: ep.line }],
          agentObjective:
            'Implement an explicit input validation boundary (e.g. Zod schema) and pick only allowable model fields before passing data to the ORM write method.',
        });
      }
    }

    return findings;
  },
};
