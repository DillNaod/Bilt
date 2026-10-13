// ─── Cross-Page Consistency Rules ─────────────────────────────────────────────
// Compares components, navigation, and terminology across the entire product.
// Detects page-specific drift and conflicting patterns.
// ─────────────────────────────────────────────────────────────────────────────

import type { RegisteredRule, RuleFinding } from '../../rule-registry/types.js';
import type { ProjectModel } from '../../project-model/types.js';

// ---------------------------------------------------------------------------
// CROSS-PAGE-001: Terminology Inconsistency
// ---------------------------------------------------------------------------
export const crossPage001: RegisteredRule = {
  id: 'CROSS-PAGE-001',
  category: 'cross-page',
  title: 'Terminology Inconsistency Across Pages',
  severity: 'low',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const inconsistencies = model.crossPage?.terminologyInconsistencies || [];

    for (const item of inconsistencies) {
      if (item.variants.length >= 2) {
        // Collect distinct files
        const files = new Set(item.variants.map((v) => v.file));
        if (files.size >= 2) {
          const evidence: string[] = [
            `Action concept "${item.concept}" is expressed using ${item.variants.length} different terms across pages:`,
            ...item.variants.map((v) => `  - "${v.text}" (${v.file}${v.line ? ':' + v.line : ''})`),
            'Inconsistent action verbs force users to re-learn standard product concepts.',
          ];

          findings.push({
            ruleId: 'CROSS-PAGE-001',
            title: `Inconsistent Action Terminology for "${item.concept}"`,
            severity: 'low',
            precision: 'high',
            maturity: 'stable',
            category: 'cross-page',
            evidence,
            locations: item.variants.map((v) => ({ file: v.file, line: v.line })),
            agentObjective: `Standardize on a single canonical term for "${item.concept}" (e.g. choose "${item.variants[0]?.text}" across all views).`,
          });
        }
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// CROSS-PAGE-002: Inconsistent Navigation Models
// ---------------------------------------------------------------------------
export const crossPage002: RegisteredRule = {
  id: 'CROSS-PAGE-002',
  category: 'cross-page',
  title: 'Inconsistent Navigation Models Across Product Pages',
  severity: 'medium',
  precision: 'medium',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const pages = model.routes.filter((r) => r.type === 'page');

    if (pages.length < 3) return [];

    // Check if some pages have desktop navigation but others have none
    const hasNavPages = pages.filter((p) => p.reachableFromNav);
    const orphanPages = pages.filter(
      (p) => !p.reachableFromNav && !p.path.includes('/auth') && !p.path.includes('/login'),
    );

    if (orphanPages.length > 0 && hasNavPages.length > 0) {
      findings.push({
        ruleId: 'CROSS-PAGE-002',
        title: 'Orphan Pages Lacking Navigation Connectivity',
        severity: 'medium',
        precision: 'medium',
        maturity: 'stable',
        category: 'cross-page',
        evidence: [
          `Detected ${orphanPages.length} application route(s) with no inbound navigation link:`,
          ...orphanPages.slice(0, 5).map((p) => `  - ${p.path} (${p.file})`),
          'These pages exist in the routing tree but cannot be navigated to by users via site menus.',
        ],
        locations: orphanPages.map((p) => ({ file: p.file })),
        agentObjective:
          'Add links in primary navigation or contextual menus leading to these pages, or remove dead routes.',
      });
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// CROSS-PAGE-003: Dead Navigation Links
// ---------------------------------------------------------------------------
export const crossPage003: RegisteredRule = {
  id: 'CROSS-PAGE-003',
  category: 'cross-page',
  title: 'Dead Navigation Links',
  severity: 'medium',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const deadItems = (model.navigation?.items || []).filter((i) => i.isDeadLink);

    if (deadItems.length > 0) {
      findings.push({
        ruleId: 'CROSS-PAGE-003',
        title: 'Dead Navigation Links Pointing to "#" or Unresolved Routes',
        severity: 'medium',
        precision: 'high',
        maturity: 'stable',
        category: 'cross-page',
        evidence: [
          `Found ${deadItems.length} dead navigation link(s):`,
          ...deadItems.map((d) => `  - "${d.label}" -> "${d.href}" (${d.file}:${d.line})`),
          'Unlinked navigation items disappoint users and indicate placeholder navigation bars.',
        ],
        locations: deadItems.map((d) => ({ file: d.file, line: d.line })),
        agentObjective:
          'Wire navigation links to valid application routes or remove unused menu items.',
      });
    }

    return findings;
  },
};
