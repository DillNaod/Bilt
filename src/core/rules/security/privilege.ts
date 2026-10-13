// ─── Privilege Escalation Security Rules ──────────────────────────────────────
// Detects client-supplied authorization flags and unverified role assertions.
// ─────────────────────────────────────────────────────────────────────────────

import type { RegisteredRule, RuleFinding } from '../../rule-registry/types.js';
import type { ProjectModel } from '../../project-model/types.js';

// ---------------------------------------------------------------------------
// SEC-PRIV-001: Client-Supplied Privilege Flag
// ---------------------------------------------------------------------------
export const secPriv001: RegisteredRule = {
  id: 'SEC-PRIV-001',
  category: 'security-privilege',
  title: 'Client-Supplied Privilege Flag (Privilege Escalation Risk)',
  severity: 'critical',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const ep of model.apiEndpoints) {
      const code = ep.handlerContent.toLowerCase();

      const checksClientRole =
        code.includes('req.body.isadmin') ||
        code.includes('req.body.role') ||
        code.includes('req.query.role') ||
        code.includes('req.params.role') ||
        code.includes('localstorage.getitem');

      if (checksClientRole) {
        findings.push({
          ruleId: 'SEC-PRIV-001',
          title: `Client-Supplied Privilege Flag in Endpoint Handler: ${ep.method} ${ep.path}`,
          severity: 'critical',
          precision: 'high',
          maturity: 'stable',
          category: 'security-privilege',
          evidence: [
            `Authorization check on ${ep.method} ${ep.path} reads role or isAdmin flag directly from untrusted client input (req.body or req.query).`,
            `File: ${ep.file}:${ep.line}`,
            'Clients can forge HTTP request bodies to grant themselves administrator privileges.',
          ],
          locations: [{ file: ep.file, line: ep.line }],
          agentObjective:
            'Derive user permissions exclusively from verified server-side session tokens or database user record lookups, never from client payload parameters.',
        });
      }
    }

    return findings;
  },
};
