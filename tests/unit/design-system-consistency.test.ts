import { describe, it, expect } from 'vitest';
import {
  designSystem001,
  designSystem002,
  designSystem003,
} from '../../src/core/rules/design/design-system.js';

describe('Design System Consistency Rules', () => {
  describe('DESIGN-SYSTEM-001: Border Radius Scale', () => {
    it('passes when border radius follows a coherent 2-3 token system', () => {
      const radii = new Map([
        ['rounded-md', { count: 40 }],
        ['rounded-sm', { count: 20 }],
        ['rounded-full', { count: 10 }],
        ['rounded-lg', { count: 3 }],
      ]);
      const findings = designSystem001.detect({
        designSystem: { radii },
      });
      expect(findings).toHaveLength(0);
    });

    it('detects incoherent border-radius distribution when >= 5 values lack dominance', () => {
      const radii = new Map([
        ['rounded-sm', { count: 4 }],
        ['rounded-md', { count: 5 }],
        ['rounded-lg', { count: 4 }],
        ['rounded-xl', { count: 5 }],
        ['rounded-2xl', { count: 4 }],
        ['rounded-3xl', { count: 3 }],
        ['rounded-full', { count: 4 }],
      ]);
      const findings = designSystem001.detect({
        designSystem: { radii },
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]?.ruleId).toBe('DESIGN-SYSTEM-001');
      expect(findings[0]?.evidence[0]).toContain('distinct border-radius values');
    });
  });

  describe('DESIGN-SYSTEM-002: Arbitrary Spacing Values', () => {
    it('detects explicit arbitrary bracket spacing values bypassing tokens', () => {
      const spacing = new Map([
        ['p-4', { count: 25 }],
        ['m-2', { count: 15 }],
        ['p-[17px]', { count: 3 }],
        ['mt-[23px]', { count: 2 }],
        ['gap-[13px]', { count: 2 }],
        ['px-6', { count: 10 }],
        ['py-3', { count: 8 }],
        ['gap-4', { count: 12 }],
      ]);
      const findings = designSystem002.detect({
        designSystem: { spacing },
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]?.ruleId).toBe('DESIGN-SYSTEM-002');
      expect(findings[0]?.evidence[0]).toContain('arbitrary bracket spacing values');
    });

    it('passes when spacing uses standard scale values without arbitrary values', () => {
      const spacing = new Map([
        ['p-2', { count: 12 }],
        ['p-4', { count: 25 }],
        ['p-6', { count: 18 }],
        ['px-4', { count: 15 }],
        ['py-2', { count: 10 }],
        ['gap-4', { count: 14 }],
        ['mt-6', { count: 8 }],
        ['mb-4', { count: 7 }],
      ]);
      const findings = designSystem002.detect({
        designSystem: { spacing },
      });
      expect(findings).toHaveLength(0);
    });
  });

  describe('DESIGN-SYSTEM-003: Color Proliferation', () => {
    it('ignores neutral colors and passes on restrained accent palette', () => {
      const colors = new Map([
        ['bg-white', { count: 30 }],
        ['text-black', { count: 20 }],
        ['text-stone-900', { count: 40 }],
        ['bg-stone-100', { count: 25 }],
        ['border-stone-300', { count: 15 }],
        ['text-slate-700', { count: 10 }],
        ['bg-zinc-800', { count: 8 }],
        ['text-neutral-500', { count: 12 }],
        ['bg-blue-600', { count: 18 }], // Primary
        ['text-blue-500', { count: 10 }],
        ['bg-emerald-500', { count: 5 }], // Success
        ['bg-rose-500', { count: 4 }], // Danger
      ]);
      const findings = designSystem003.detect({
        designSystem: { colors },
      });
      expect(findings).toHaveLength(0);
    });

    it('detects color proliferation when >= 12 non-neutral colors are used ad-hoc', () => {
      const colors = new Map([
        ['bg-white', { count: 50 }],
        ['text-stone-900', { count: 40 }],
        // 13 non-neutral colors
        ['bg-blue-500', 3],
        ['bg-indigo-600', 2],
        ['bg-purple-500', 2],
        ['bg-violet-600', 1],
        ['bg-pink-500', 2],
        ['bg-rose-400', 1],
        ['bg-orange-500', 1],
        ['bg-amber-400', 2],
        ['bg-yellow-300', 1],
        ['bg-lime-500', 2],
        ['bg-emerald-400', 1],
        ['bg-teal-500', 2],
        ['bg-cyan-400', 1],
      ]);
      const findings = designSystem003.detect({
        designSystem: { colors },
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]?.ruleId).toBe('DESIGN-SYSTEM-003');
      expect(findings[0]?.evidence[0]).toContain('13 distinct non-neutral color values');
    });
  });
});
