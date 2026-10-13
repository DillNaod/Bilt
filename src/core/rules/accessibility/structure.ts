// ─── Structural Accessibility Rules ──────────────────────────────────────────
// Analyzes interaction structure: focus management, keyboard flow, modal lifecycle,
// form semantics, ARIA relationships, and error association.
// ─────────────────────────────────────────────────────────────────────────────

import type { RegisteredRule, RuleFinding } from '../../rule-registry/types.js';
import type { ProjectModel } from '../../project-model/types.js';

// ---------------------------------------------------------------------------
// A11Y-STRUCT-001: Modal Without Focus Management
// ---------------------------------------------------------------------------
export const a11yStruct001: RegisteredRule = {
  id: 'A11Y-STRUCT-001',
  category: 'accessibility',
  title: 'Modal Component Lacks Focus Management and ARIA Dialog Semantics',
  severity: 'high',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const modals = model.components.filter((c) => c.isModal);

    for (const modal of modals) {
      const text = modal.rawText.toLowerCase();
      const hasFocusTrap =
        text.includes('focustrap') ||
        text.includes('focus-trap') ||
        text.includes('usefocustrap') ||
        text.includes('@radix-ui/react-dialog') ||
        text.includes('@headlessui/react') ||
        (text.includes('ref') && text.includes('.focus()'));

      const hasAriaModal =
        text.includes('aria-modal') ||
        text.includes('role="dialog"') ||
        text.includes('role="alertdialog"');

      if (!hasFocusTrap || !hasAriaModal) {
        const issues: string[] = [];
        if (!hasFocusTrap) issues.push('no focus trap or auto-focus mechanism detected');
        if (!hasAriaModal) issues.push('missing role="dialog" or aria-modal="true" attribute');

        findings.push({
          ruleId: 'A11Y-STRUCT-001',
          title: `Modal Component "${modal.name}" Lacks Keyboard Focus Trap or Dialog Semantics`,
          severity: 'high',
          precision: 'high',
          maturity: 'stable',
          category: 'accessibility',
          evidence: [
            `Modal component analyzed at: ${modal.file}:${modal.line}`,
            `Structural defects found: ${issues.join('; ')}`,
            'When a modal opens, keyboard navigation must be constrained within the modal, and focus must return to the trigger upon dismissal.',
          ],
          locations: [{ file: modal.file, line: modal.line }],
          agentObjective:
            'Use a standard accessible dialog primitive (e.g. Radix Dialog or Headless UI) or implement focus trap and role="dialog" aria-modal="true".',
        });
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// A11Y-STRUCT-002: Clickable Div Instead of Button
// ---------------------------------------------------------------------------
export const a11yStruct002: RegisteredRule = {
  id: 'A11Y-STRUCT-002',
  category: 'accessibility',
  title: 'Non-Interactive Element (<div/span>) Used as Clickable Control',
  severity: 'medium',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const comp of model.components) {
      const clickableDivs = (comp.interactiveElements || []).filter(
        (el) => el.type === 'div-clickable',
      );

      if (clickableDivs.length > 0) {
        findings.push({
          ruleId: 'A11Y-STRUCT-002',
          title: `Clickable <div> or <span> Element Used Instead of Semantic <button>`,
          severity: 'medium',
          precision: 'high',
          maturity: 'stable',
          category: 'accessibility',
          evidence: [
            `Found ${clickableDivs.length} non-semantic clickable element(s) in "${comp.name}":`,
            ...clickableDivs.map((d) => `  - Line ${d.line}: onClick on non-button container`),
            'Non-button interactive elements cannot be focused via keyboard Tab navigation or triggered with Enter/Space.',
          ],
          locations: clickableDivs.map((d) => ({ file: comp.file, line: d.line })),
          agentObjective:
            'Replace clickable <div> with standard HTML <button type="button"> or attach role="button", tabIndex={0}, and onKeyDown handlers.',
        });
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// A11Y-STRUCT-003: Form Field Without Accessible Label Association
// ---------------------------------------------------------------------------
export const a11yStruct003: RegisteredRule = {
  id: 'A11Y-STRUCT-003',
  category: 'accessibility',
  title: 'Form Inputs Missing Accessible Name or Label Association',
  severity: 'medium',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const comp of model.components) {
      const unlabeled = (comp.formFields || []).filter(
        (f) => !f.hasLabel && !f.hasAriaLabel,
      );

      if (unlabeled.length > 0) {
        findings.push({
          ruleId: 'A11Y-STRUCT-003',
          title: `Form Fields Missing Accessible Name (<label> or aria-label)`,
          severity: 'medium',
          precision: 'high',
          maturity: 'stable',
          category: 'accessibility',
          evidence: [
            `Found ${unlabeled.length} unlabeled input field(s) in "${comp.name}":`,
            ...unlabeled.map((u) => `  - Line ${u.line}: <input type="${u.type}"> without <label> or aria-label`),
            'Screen readers cannot identify the purpose of inputs without associated labels.',
          ],
          locations: unlabeled.map((u) => ({ file: comp.file, line: u.line })),
          agentObjective:
            'Provide an explicit <label htmlFor="..."> element or an aria-label attribute for each input field.',
        });
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// A11Y-STRUCT-004: Validation Error Not Programmatically Associated with Input
// ---------------------------------------------------------------------------
export const a11yStruct004: RegisteredRule = {
  id: 'A11Y-STRUCT-004',
  category: 'accessibility',
  title: 'Validation Errors Visual-Only, Not Associated via aria-describedby',
  severity: 'low',
  precision: 'medium',
  maturity: 'experimental',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const comp of model.components) {
      if (!comp.isForm) continue;

      const text = comp.rawText.toLowerCase();
      const hasVisualErrors = text.includes('error') && (text.includes('text-red') || text.includes('text-destructive'));
      const hasAriaDescribedBy = text.includes('aria-describedby') || text.includes('aria-errormessage');

      if (hasVisualErrors && !hasAriaDescribedBy) {
        findings.push({
          ruleId: 'A11Y-STRUCT-004',
          title: 'Form Validation Error Message Lacks aria-describedby Association',
          severity: 'low',
          precision: 'medium',
          maturity: 'experimental',
          category: 'accessibility',
          evidence: [
            `Form in "${comp.name}" renders visible error message markup, but no aria-describedby binding was detected.`,
            'Assistive technology users will not hear the error announced when tabbing into the invalid field.',
          ],
          locations: [{ file: comp.file, line: comp.line }],
          agentObjective:
            'Bind input fields to their error message container id via aria-describedby="field-error-id" and set aria-invalid={true}.',
        });
      }
    }

    return findings;
  },
};
