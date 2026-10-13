import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { buildProjectModel } from '../../src/core/project-model/builder.js';
import { ruleRegistry } from '../../src/core/rule-registry/registry.js';
import { uxState010, uxState011, uxState012, uxState013 } from '../../src/core/rules/ux/states.js';
import { uxFlow001 } from '../../src/core/rules/ux/flows.js';
import { a11yStruct001, a11yStruct002, a11yStruct003 } from '../../src/core/rules/accessibility/structure.js';

describe('UX Completeness & Structural Accessibility', () => {
  const completeFixture = path.resolve(__dirname, '../fixtures/complete-ux-states');

  it('detects missing critical flow states in incomplete flow models (UX-STATE-010 & UX-FLOW-001)', () => {
    const mockModel: any = {
      userFlows: [
        {
          name: 'upload',
          id: 'upload',
          type: 'upload',
          detectedStates: [{ name: 'entry', location: { file: 'src/Upload.tsx', line: 10 } }],
          missingStates: ['loading', 'error'],
          entryPoints: [{ file: 'src/Upload.tsx', line: 10 }],
        },
      ],
      components: [],
      routes: [{ path: '/upload', file: 'src/Upload.tsx' }],
      isStaticOnly: false,
    };

    const flowFindings = uxFlow001.detect(mockModel);
    expect(flowFindings.some((f) => f.ruleId === 'UX-FLOW-001')).toBe(true);

    const stateFindings = uxState010.detect(mockModel);
    expect(stateFindings.some((f) => f.ruleId === 'UX-STATE-010')).toBe(true);
  });

  it('detects data components lacking state machines (UX-STATE-011)', () => {
    const mockModel: any = {
      components: [
        {
          name: 'UsersTable',
          file: 'src/components/UsersTable.tsx',
          line: 15,
          isDataDisplay: true,
          hasLoadingState: false,
          hasEmptyState: false,
          hasErrorState: false,
        },
      ],
    };

    const findings = uxState011.detect(mockModel);
    expect(findings.length).toBe(1);
    expect(findings[0]?.ruleId).toBe('UX-STATE-011');
    expect(findings[0]?.evidence[0]).toContain('missing the following UI states: loading, empty, error');
  });

  it('detects unconfirmed destructive actions (UX-STATE-012)', () => {
    const mockModel: any = {
      components: [
        {
          name: 'Settings',
          file: 'src/pages/Settings.tsx',
          line: 40,
          interactiveElements: [
            {
              type: 'button',
              text: 'Delete Account',
              isDestructive: true,
              hasConfirmation: false,
              hasOnClick: true,
              onClickIsEmpty: false,
              line: 42,
              file: 'src/pages/Settings.tsx',
            },
          ],
        },
      ],
    };

    const findings = uxState012.detect(mockModel);
    expect(findings.length).toBe(1);
    expect(findings[0]?.ruleId).toBe('UX-STATE-012');
    expect(findings[0]?.evidence[0]).toContain('Delete Account');
  });

  it('detects missing permission-denied state when auth has protected routes (UX-STATE-013)', () => {
    const mockModel: any = {
      auth: { hasAuthentication: true },
      routes: [
        { path: '/admin/dashboard', file: 'src/app/admin/page.tsx', requiresAuth: true },
      ],
      components: [
        {
          name: 'AdminDashboard',
          file: 'src/app/admin/page.tsx',
          line: 1,
          rawText: '<div>Admin Only Dashboard</div>',
        },
      ],
    };

    const findings = uxState013.detect(mockModel);
    expect(findings.length).toBe(1);
    expect(findings[0]?.ruleId).toBe('UX-STATE-013');
  });

  it('detects modal missing focus trap or dialog attributes (A11Y-STRUCT-001)', () => {
    const mockModel: any = {
      components: [
        {
          name: 'PopupModal',
          file: 'src/components/Modal.tsx',
          line: 5,
          isModal: true,
          rawText: '<div className="fixed inset-0 bg-black/50"><div>Modal Body</div></div>',
        },
      ],
    };

    const findings = a11yStruct001.detect(mockModel);
    expect(findings.length).toBe(1);
    expect(findings[0]?.ruleId).toBe('A11Y-STRUCT-001');
    expect(findings[0]?.evidence[1]).toContain('no focus trap');
  });

  it('detects clickable divs without button semantics (A11Y-STRUCT-002)', () => {
    const mockModel: any = {
      components: [
        {
          name: 'CardItem',
          file: 'src/components/CardItem.tsx',
          line: 12,
          interactiveElements: [
            {
              type: 'div-clickable',
              line: 14,
              text: 'Open Details',
              hasAriaLabel: false,
              isDestructive: false,
              hasConfirmation: false,
              hasOnClick: true,
              onClickIsEmpty: false,
            },
          ],
        },
      ],
    };

    const findings = a11yStruct002.detect(mockModel);
    expect(findings.length).toBe(1);
    expect(findings[0]?.ruleId).toBe('A11Y-STRUCT-002');
  });

  it('verifies complete-ux-states fixture builds and has intentional state handling', async () => {
    const model = await buildProjectModel(completeFixture);
    expect(model.components.length).toBeGreaterThan(0);

    const findings = ruleRegistry.run(model);
    // The fixture has loading, empty, and data states, so UX-STATE-011 should not flag the main data component
    const dataStateDefects = findings.filter((f) => f.ruleId === 'UX-STATE-011');
    expect(dataStateDefects.length).toBe(0);
  });
});
