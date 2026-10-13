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

  it('generates valid SARIF 2.1.0 output when sarif option is enabled', async () => {
    const result = await runAnalysisPipeline({
      rootDir: vulnerableApiFixture,
      includeCategories: ['security-api'],
      sarif: true,
    });

    expect(result.sarifReport).toBeDefined();
    expect(result.sarifReport.version).toBe('2.1.0');
    expect(result.sarifReport.runs).toHaveLength(1);

    const run = result.sarifReport.runs[0];
    expect(run.tool.driver.name).toBe('bilt');
    expect(run.tool.driver.rules.length).toBeGreaterThan(0);
    expect(run.results.length).toBeGreaterThan(0);

    const resultRuleIds = run.results.map((r: any) => r.ruleId);
    expect(resultRuleIds).toContain('SEC-API-001');
  });

  it('handles cache option and records cache updates', async () => {
    const result = await runAnalysisPipeline({
      rootDir: genericLandingFixture,
      cache: true,
    });

    expect(result.phases.discovery?.status).toBe('ok');
    expect(result.totalFilesScanned).toBeGreaterThan(0);
    // After scanning with cache=true, cache should be populated
    expect(result.cached).toBeDefined();
  });

  it('filters findings when inline suppression is present', async () => {
    // Pass synthetic file containing inline suppression comment
    const suppressedContent = `
import express from 'express';
// bilt-ignore SEC-API-001: Intentional public user lookup without auth requirement
export function getUser(req, res) {
  res.json({ id: req.params.id });
}
`;
    const result = await runAnalysisPipeline({
      rootDir: vulnerableApiFixture,
      files: [{ path: 'src/routes/suppressed.ts', content: suppressedContent }],
      includeCategories: ['security-api'],
      suppressions: true,
    });

    // Suppressed rule should not be present in active findings for that file
    const suppressedFinding = result.findings.find(
      (f) => f.ruleId === 'SEC-API-001' && f.locations[0]?.file.includes('suppressed.ts')
    );
    expect(suppressedFinding).toBeUndefined();
  });
});
