import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { buildProjectModel } from '../../src/core/project-model/builder.js';
import { ruleRegistry } from '../../src/core/rule-registry/index.js';

describe('Pattern Analysis Engine', () => {
  it('flags generic SaaS template composition when multiple structural signals co-occur', async () => {
    const fixtureDir = path.resolve(__dirname, '../fixtures/generic-saas-landing');
    const model = await buildProjectModel(fixtureDir);
    const findings = ruleRegistry.run(model);

    // DESIGN-STRUCTURE-001 must fire on the combination
    const saasFinding = findings.find((f) => f.ruleId === 'DESIGN-STRUCTURE-001');
    expect(saasFinding).toBeDefined();
    expect(saasFinding?.severity).toBe('high');
    expect(saasFinding?.evidence.length).toBeGreaterThan(4);

    // UX-FAKE-001 must catch hardcoded active users stats
    const fakeMetricsFinding = findings.find((f) => f.ruleId === 'UX-FAKE-001');
    expect(fakeMetricsFinding).toBeDefined();

    // UX-FAKE-002 must catch CTA buttons with no action (empty onClick or href="#")
    const deadCtaFinding = findings.find((f) => f.ruleId === 'UX-FAKE-002');
    expect(deadCtaFinding).toBeDefined();

    // UX-FAKE-003 must catch fake testimonials ("CEO at Acme Corp")
    const fakeTestimonialFinding = findings.find((f) => f.ruleId === 'UX-FAKE-003');
    expect(fakeTestimonialFinding).toBeDefined();
  });

  it('does NOT flag distinctive editorial layouts even when subtle gradients or accents exist', async () => {
    const fixtureDir = path.resolve(__dirname, '../fixtures/distinctive-editorial');
    const model = await buildProjectModel(fixtureDir);
    const findings = ruleRegistry.run(model);

    // Must NOT flag DESIGN-STRUCTURE-001
    const saasFinding = findings.find((f) => f.ruleId === 'DESIGN-STRUCTURE-001');
    expect(saasFinding).toBeUndefined();

    // Must NOT flag fake metrics or fake testimonials
    const fakeMetrics = findings.find((f) => f.ruleId === 'UX-FAKE-001');
    expect(fakeMetrics).toBeUndefined();

    const fakeTestimonials = findings.find((f) => f.ruleId === 'UX-FAKE-003');
    expect(fakeTestimonials).toBeUndefined();
  });
});
