import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { buildProjectModel } from '../../src/core/project-model/builder.js';
import { ruleRegistry } from '../../src/core/rule-registry/index.js';

describe('Deep Security Analysis Engine', () => {
  it('detects IDOR, mass assignment, missing auth, and privilege escalation on vulnerable-api-deep', async () => {
    const fixtureDir = path.resolve(__dirname, '../fixtures/vulnerable-api-deep');
    const model = await buildProjectModel(fixtureDir);
    const findings = ruleRegistry.run(model);

    // SEC-API-001: Missing auth on sensitive /admin/users endpoint
    const missingAuth = findings.find((f) => f.ruleId === 'SEC-API-001');
    expect(missingAuth).toBeDefined();
    expect(missingAuth?.severity).toBe('critical');
    expect(missingAuth?.evidence.some((e) => e.includes('/admin/users'))).toBe(true);

    // SEC-API-002: IDOR / BOLA - parameter lookup without session ownership
    const idor = findings.find((f) => f.ruleId === 'SEC-API-002');
    expect(idor).toBeDefined();
    expect(idor?.severity).toBe('critical');
    expect(idor?.evidence.some((e) => e.includes('users/:id'))).toBe(true);

    // SEC-API-003: Mass assignment risk
    const massAssignment = findings.find((f) => f.ruleId === 'SEC-API-003');
    expect(massAssignment).toBeDefined();
    expect(massAssignment?.severity).toBe('high');

    // SEC-FLOW-001: Unvalidated end-to-end data flow to DB
    const flowFinding = findings.find((f) => f.ruleId === 'SEC-FLOW-001');
    expect(flowFinding).toBeDefined();
    expect(flowFinding?.severity).toBe('critical');

    // SEC-PRIV-001: Client-supplied privilege flag
    const privFinding = findings.find((f) => f.ruleId === 'SEC-PRIV-001');
    expect(privFinding).toBeDefined();
    expect(privFinding?.severity).toBe('critical');
  });
});
