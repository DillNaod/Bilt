import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { runAnalysisPipeline } from '../../src/core/pipeline/index.js';

describe('Analysis Pipeline Orchestrator', () => {
  const genericLandingFixture = path.resolve(__dirname, '../fixtures/generic-saas-landing');
  const vulnerableApiFixture = path.resolve(__dirname, '../fixtures/vulnerable-api-deep');

  it('executes end-to-end phases and emits findings on generic landing fixture', async () => {
    const result = await runAnalysisPipeline({
      rootDir: genericLandingFixture,
    });

    expect(result.phases.discovery?.status).toBe('ok');
    expect(result.phases.model?.status).toBe('ok');
    expect(result.phases.rules?.status).toBe('ok');
    expect(result.phases.findings?.status).toBe('ok');

    expect(result.totalFilesScanned).toBeGreaterThan(0);
    expect(result.buildTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.findings.length).toBeGreaterThan(0);

    const ruleIds = result.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('DESIGN-STRUCTURE-001');
  });

  it('filters rule execution by category when includeCategories is specified', async () => {
    const result = await runAnalysisPipeline({
      rootDir: vulnerableApiFixture,
      includeCategories: ['security-api'],
    });

    expect(result.phases.rules?.status).toBe('ok');
    expect(result.findings.length).toBeGreaterThan(0);

    // All findings must strictly belong to security-api
    for (const finding of result.findings) {
      expect(finding.category).toBe('security-api');
    }

    const ruleIds = result.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('SEC-API-001');
    expect(ruleIds).toContain('SEC-API-003');
  });

  it('handles empty directory gracefully without crashing', async () => {
    const emptyFixture = path.resolve(__dirname, '../fixtures/empty-project');
    const result = await runAnalysisPipeline({
      rootDir: emptyFixture,
    });

    expect(result.phases.discovery?.status).toBe('ok');
    expect(result.findings).toHaveLength(0);
  });
});
