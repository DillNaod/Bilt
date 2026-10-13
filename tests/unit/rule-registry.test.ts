import { describe, it, expect } from 'vitest';
import { ruleRegistry, RuleRegistry } from '../../src/core/rule-registry/index.js';
import type { RegisteredRule, RuleFinding } from '../../src/core/rule-registry/types.js';

describe('RuleRegistry', () => {
  it('registers defaults across all categories with precision and maturity metadata', () => {
    const rules = ruleRegistry.list();
    expect(rules.length).toBeGreaterThan(15);

    for (const rule of rules) {
      expect(rule.id).toBeDefined();
      expect(rule.category).toBeDefined();
      expect(rule.title).toBeDefined();
      expect(rule.severity).toBeDefined();
      expect(['critical', 'high', 'medium', 'low', 'info']).toContain(rule.severity);
      expect(['high', 'medium', 'low']).toContain(rule.precision);
      expect(['stable', 'experimental']).toContain(rule.maturity);
    }
  });

  it('filters rules by category', () => {
    const designRules = ruleRegistry.byCategory('design-composition');
    expect(designRules.length).toBeGreaterThan(0);
    expect(designRules.every((r) => r.category === 'design-composition')).toBe(true);

    const secRules = ruleRegistry.byCategory('security-api');
    expect(secRules.length).toBeGreaterThan(0);
    expect(secRules.every((r) => r.category === 'security-api')).toBe(true);
  });

  it('allows registering and running custom rules against ProjectModel', () => {
    const customRegistry = new RuleRegistry();
    const mockRule: RegisteredRule = {
      id: 'TEST-CUSTOM-001',
      category: 'design-composition',
      title: 'Custom Test Rule',
      severity: 'medium',
      precision: 'high',
      maturity: 'stable',
      detect(model: any): RuleFinding[] {
        if (model?.hasCustomCondition) {
          return [
            {
              ruleId: 'TEST-CUSTOM-001',
              title: 'Custom Test Rule',
              severity: 'medium',
              precision: 'high',
              maturity: 'stable',
              category: 'design-composition',
              evidence: ['Triggered custom condition'],
              locations: [],
            },
          ];
        }
        return [];
      },
    };

    customRegistry.register(mockRule);
    expect(customRegistry.get('TEST-CUSTOM-001')).toBeDefined();

    const findingsPositive = customRegistry.run({ hasCustomCondition: true } as any);
    expect(findingsPositive.length).toBe(1);
    expect(findingsPositive[0]?.ruleId).toBe('TEST-CUSTOM-001');

    const findingsNegative = customRegistry.run({ hasCustomCondition: false } as any);
    expect(findingsNegative.length).toBe(0);
  });
});
