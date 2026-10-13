// ─── Rule Registry ────────────────────────────────────────────────────────────
// Central registry that holds all rules and runs them against a ProjectModel.
// ─────────────────────────────────────────────────────────────────────────────

import type { Rule, ProjectModel, RuleFinding, RuleCategory } from './types.js';

// Design rules
import { designStructure001, designStructure002, designStructure003 } from '../rules/design/composition.js';
import { designHierarchy001, designHierarchy002, designHierarchy003 } from '../rules/design/hierarchy.js';
import { designSystem001, designSystem002, designSystem003 } from '../rules/design/design-system.js';
import { designBrief010, designBrief011, designBrief012 } from '../rules/design/brief-alignment.js';
import { crossPage001, crossPage002, crossPage003 } from '../rules/design/cross-page.js';

// UX rules
import { uxState010, uxState011, uxState012, uxState013 } from '../rules/ux/states.js';
import { uxFlow001, uxFlow002 } from '../rules/ux/flows.js';
import { uxIa001, uxIa002, uxIa003 } from '../rules/ux/ia.js';
import { uxFake001, uxFake002, uxFake003 } from '../rules/ux/fake-data.js';

// Accessibility rules
import { a11yStruct001, a11yStruct002, a11yStruct003, a11yStruct004 } from '../rules/accessibility/structure.js';

// Security rules
import { secApi001, secApi002, secApi003, secApi004, secApi005 } from '../rules/security/api-security.js';
import { secFlow001 } from '../rules/security/data-flow.js';
import { secPriv001 } from '../rules/security/privilege.js';

// Requirements rules
import { reqTrace001 } from '../rules/requirements/traceability.js';

export class RuleRegistry {
  private rules: Map<string, Rule> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Design
    this.register(designStructure001);
    this.register(designStructure002);
    this.register(designStructure003);
    this.register(designHierarchy001);
    this.register(designHierarchy002);
    this.register(designHierarchy003);
    this.register(designSystem001);
    this.register(designSystem002);
    this.register(designSystem003);
    this.register(designBrief010);
    this.register(designBrief011);
    this.register(designBrief012);
    this.register(crossPage001);
    this.register(crossPage002);
    this.register(crossPage003);

    // UX
    this.register(uxState010);
    this.register(uxState011);
    this.register(uxState012);
    this.register(uxState013);
    this.register(uxFlow001);
    this.register(uxFlow002);
    this.register(uxIa001);
    this.register(uxIa002);
    this.register(uxIa003);
    this.register(uxFake001);
    this.register(uxFake002);
    this.register(uxFake003);

    // Accessibility
    this.register(a11yStruct001);
    this.register(a11yStruct002);
    this.register(a11yStruct003);
    this.register(a11yStruct004);

    // Security
    this.register(secApi001);
    this.register(secApi002);
    this.register(secApi003);
    this.register(secApi004);
    this.register(secApi005);
    this.register(secFlow001);
    this.register(secPriv001);

    // Requirements
    this.register(reqTrace001);
  }

  register(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  list(): Rule[] {
    return Array.from(this.rules.values());
  }

  byCategory(category: RuleCategory): Rule[] {
    return this.list().filter((r) => r.category === category);
  }

  run(model: ProjectModel, ruleIds?: string[]): RuleFinding[] {
    const selected = ruleIds
      ? this.list().filter((r) => ruleIds.includes(r.id))
      : this.list();

    const findings: RuleFinding[] = [];
    for (const rule of selected) {
      try {
        const fn = rule.detect ?? rule.evaluate;
        if (typeof fn === 'function') {
          const ruleFindings = fn.call(rule, model);
          if (Array.isArray(ruleFindings)) {
            findings.push(...ruleFindings);
          }
        }
      } catch {
        // Individual rule failures should not abort the entire run
      }
    }
    return findings;
  }
}

export const ruleRegistry = new RuleRegistry();
