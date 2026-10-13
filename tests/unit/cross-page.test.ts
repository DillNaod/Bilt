import { describe, it, expect } from 'vitest';
import {
  crossPage001,
  crossPage002,
  crossPage003,
} from '../../src/core/rules/design/cross-page.js';

describe('Cross-Page Consistency Rules', () => {
  describe('CROSS-PAGE-001: Terminology Inconsistency', () => {
    it('detects divergent action verbs for the same concept across multiple files', () => {
      const mockModel: any = {
        crossPage: {
          terminologyInconsistencies: [
            {
              concept: 'create',
              variants: [
                { text: 'Create Project', file: 'src/app/dashboard/page.tsx', line: 45 },
                { text: 'New Project', file: 'src/app/projects/page.tsx', line: 12 },
                { text: 'Add', file: 'src/components/MobileNav.tsx', line: 8 },
              ],
            },
          ],
        },
      };

      const findings = crossPage001.detect(mockModel);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.ruleId).toBe('CROSS-PAGE-001');
      expect(findings[0]?.evidence[0]).toContain('concept "create"');
      expect(findings[0]?.evidence[1]).toContain('Create Project');
      expect(findings[0]?.evidence[2]).toContain('New Project');
    });

    it('passes when terminology has only one variant or variants within the same file', () => {
      const mockModel: any = {
        crossPage: {
          terminologyInconsistencies: [
            {
              concept: 'create',
              variants: [
                { text: 'Create Project', file: 'src/app/dashboard/page.tsx', line: 45 },
                { text: 'Create Project', file: 'src/app/dashboard/page.tsx', line: 90 },
              ],
            },
          ],
        },
      };

      const findings = crossPage001.detect(mockModel);
      expect(findings).toHaveLength(0);
    });
  });

  describe('CROSS-PAGE-002: Inconsistent Navigation Models (Orphan Pages)', () => {
    it('detects orphan pages lacking navigation connectivity in multi-page app', () => {
      const mockModel: any = {
        routes: [
          { path: '/dashboard', file: 'src/app/dashboard/page.tsx', type: 'page', reachableFromNav: true },
          { path: '/analytics', file: 'src/app/analytics/page.tsx', type: 'page', reachableFromNav: true },
          { path: '/settings/security', file: 'src/app/settings/security/page.tsx', type: 'page', reachableFromNav: false },
        ],
      };

      const findings = crossPage002.detect(mockModel);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.ruleId).toBe('CROSS-PAGE-002');
      expect(findings[0]?.evidence[0]).toContain('1 application route(s) with no inbound navigation link');
      expect(findings[0]?.evidence[1]).toContain('/settings/security');
    });
  });

  describe('CROSS-PAGE-003: Dead Navigation Links', () => {
    it('detects dead navigation links pointing to placeholder targets', () => {
      const mockModel: any = {
        navigation: {
          items: [
            { label: 'Home', href: '/', isDeadLink: false, file: 'src/components/Nav.tsx', line: 10 },
            { label: 'Docs', href: '#docs', isDeadLink: true, file: 'src/components/Nav.tsx', line: 14 },
            { label: 'Pricing', href: '#', isDeadLink: true, file: 'src/components/Nav.tsx', line: 18 },
          ],
        },
      };

      const findings = crossPage003.detect(mockModel);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.ruleId).toBe('CROSS-PAGE-003');
      expect(findings[0]?.evidence[0]).toContain('Found 2 dead navigation link(s)');
    });
  });
});
