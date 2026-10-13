import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { normalizeComponentTree, structuralSimilarity } from '../../src/core/project-model/normalizer.js';
import { buildProjectModel } from '../../src/core/project-model/builder.js';

describe('ProjectModel Normalizer', () => {
  it('generates identical signatures for structurally equivalent components regardless of text/classes', () => {
    const componentA = `
      <section className="bg-purple-900 py-12">
        <div className="container mx-auto">
          <div className="card">
            <svg className="icon" />
            <h3 className="text-xl">Fast Performance</h3>
            <p>Runs in milliseconds.</p>
            <button className="btn-primary">Learn more</button>
          </div>
        </div>
      </section>
    `;

    const componentB = `
      <section className="bg-neutral-100 py-24">
        <div className="wrapper">
          <div className="item-box">
            <svg className="h-6 w-6" />
            <h3 className="text-2xl font-bold">Secure Data</h3>
            <p>Encrypted at rest.</p>
            <button className="px-4 py-2">Read docs</button>
          </div>
        </div>
      </section>
    `;

    const sigA = normalizeComponentTree(componentA);
    const sigB = normalizeComponentTree(componentB);

    expect(sigA).toBe(sigB);
    expect(structuralSimilarity(sigA, sigB)).toBe(1.0);
  });

  it('detects structural divergence when component layouts differ', () => {
    const cardList = `<section><div><div><svg /><h3>Title</h3><p>Desc</p></div></div></section>`;
    const tableDisplay = `<main><table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Alice</td></tr></tbody></table></main>`;

    const sigA = normalizeComponentTree(cardList);
    const sigB = normalizeComponentTree(tableDisplay);

    expect(sigA).not.toBe(sigB);
    expect(structuralSimilarity(sigA, sigB)).toBeLessThan(0.6);
  });
});

describe('ProjectModel Builder', () => {
  it('builds a normalized ProjectModel for generic-saas-landing', async () => {
    const fixtureDir = path.resolve(__dirname, '../fixtures/generic-saas-landing');
    const model = await buildProjectModel(fixtureDir);

    expect(model.rootDir).toBe(fixtureDir);
    expect(model.components.length).toBeGreaterThan(0);

    const mainPage = model.components.find((c) => c.file.includes('page.tsx'));
    expect(mainPage).toBeDefined();

    // Check detected decorative signals
    const signalTypes = mainPage?.decorativeSignals.map((s) => s.type) || [];
    expect(signalTypes).toContain('hero-eyebrow');
    expect(signalTypes).toContain('radial-orb');
    expect(signalTypes).toContain('three-column');
    expect(signalTypes).toContain('bento-grid');

    // Check hardcoded metrics
    expect(model.content.hardcodedMetrics.length).toBeGreaterThan(0);
    const hasUsersMetric = model.content.hardcodedMetrics.some((m) =>
      m.text.includes('10,000+ active users'),
    );
    expect(hasUsersMetric).toBe(true);

    // Check design system tokens extracted
    expect(model.designSystem.radii.size).toBeGreaterThan(0);
    expect(model.designSystem.colors.size).toBeGreaterThan(0);
  });

  it('builds a normalized ProjectModel for vulnerable-api-deep', async () => {
    const fixtureDir = path.resolve(__dirname, '../fixtures/vulnerable-api-deep');
    const model = await buildProjectModel(fixtureDir);

    expect(model.apiEndpoints.length).toBeGreaterThan(0);

    // Endpoint: GET /api/users/:id
    const userGet = model.apiEndpoints.find(
      (ep) => ep.method === 'GET' && ep.path.includes('users/:id'),
    );
    expect(userGet).toBeDefined();
    expect(userGet?.hasAuthCheck).toBe(true);
    expect(userGet?.hasOwnershipCheck).toBe(false);

    // Endpoint: PUT /api/users/:id (mass assignment)
    const userPut = model.apiEndpoints.find(
      (ep) => ep.method === 'PUT' && ep.path.includes('users/:id'),
    );
    expect(userPut).toBeDefined();
    expect(userPut?.passesBodyToDb).toBe(true);
    expect(userPut?.hasExplicitFieldSelection).toBe(false);
  });
});
