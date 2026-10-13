// ─── User Flow Completeness Rules ─────────────────────────────────────────────
// Analyzes user flow state machines: entry, loading, error, empty, confirmation, recovery.
// Ensures product-critical workflows have complete state transitions.
// ─────────────────────────────────────────────────────────────────────────────

import type { RegisteredRule, RuleFinding } from '../../rule-registry/types.js';
import type { ProjectModel } from '../../project-model/types.js';

// ---------------------------------------------------------------------------
// UX-FLOW-001: Critical User Flow Missing Failure or Recovery States
// ---------------------------------------------------------------------------
export const uxFlow001: RegisteredRule = {
  id: 'UX-FLOW-001',
  category: 'ux-flows',
  title: 'Critical User Flow Lacks Failure or Recovery States',
  severity: 'high',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const flows = model.userFlows || [];

    for (const flow of flows) {
      // Flow-specific requirements
      const stateNames = new Set(flow.detectedStates.map((s) => s.name));

      if (flow.name === 'upload') {
        const hasLoading = stateNames.has('loading');
        const hasError = stateNames.has('error');

        if (!hasLoading || !hasError) {
          const missing: string[] = [];
          if (!hasLoading) missing.push('upload progress / loading indicator');
          if (!hasError) missing.push('file reject / upload error state');

          findings.push({
            ruleId: 'UX-FLOW-001',
            title: 'File Upload Flow Lacks Asynchronous Progress or Error Handling',
            severity: 'medium',
            precision: 'high',
            maturity: 'stable',
            category: 'ux-flows',
            evidence: [
              `Detected file upload workflow at: ${flow.entryPoints.map((p) => `${p.file}:${p.line}`).join(', ')}`,
              `Missing required states: ${missing.join(', ')}`,
              'Network failures, oversized files, and invalid formats will leave users without feedback.',
            ],
            locations: flow.entryPoints,
            agentObjective:
              'Add explicit upload progress/spinner indicators and an error boundary to handle network drops and validation rejections.',
          });
        }
      }

      if (flow.name === 'checkout' || flow.name === 'payment') {
        const hasLoading = stateNames.has('loading');
        const hasError = stateNames.has('error');

        if (!hasLoading || !hasError) {
          findings.push({
            ruleId: 'UX-FLOW-001',
            title: 'Payment/Checkout Flow Missing Loading or Error Handling',
            severity: 'critical',
            precision: 'high',
            maturity: 'stable',
            category: 'ux-flows',
            evidence: [
              `Checkout/payment workflow entry at ${flow.entryPoints.map((p) => p.file).join(', ')}`,
              'Financial transactions must provide explicit submitting state to prevent double charges, and clear error recovery for card declines.',
            ],
            locations: flow.entryPoints,
            agentObjective:
              'Implement button disabling and spinner during transaction submission, and clear declined-card error feedback.',
          });
        }
      }

      if (flow.name === 'delete') {
        const hasConfirm = stateNames.has('confirmation');
        if (!hasConfirm) {
          findings.push({
            ruleId: 'UX-FLOW-001',
            title: 'Destructive Delete Flow Missing Confirmation Guard',
            severity: 'high',
            precision: 'high',
            maturity: 'stable',
            category: 'ux-flows',
            evidence: [
              `Delete workflow entry points at: ${flow.entryPoints.map((p) => `${p.file}:${p.line}`).join(', ')}`,
              'Destructive data deletion executes without modal or prompt confirmation.',
            ],
            locations: flow.entryPoints,
            agentObjective:
              'Wrap deletion in a confirmation modal or two-step verification prompt before invoking the deletion mutation.',
          });
        }
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// UX-FLOW-002: Async Form Flow Missing Validation Feedback
// ---------------------------------------------------------------------------
export const uxFlow002: RegisteredRule = {
  id: 'UX-FLOW-002',
  category: 'ux-flows',
  title: 'Form Submission Lacks Client-Side Validation Feedback',
  severity: 'medium',
  precision: 'medium',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const formComponents = model.components.filter((c) => c.isForm);

    for (const form of formComponents) {
      if (form.formFields.length >= 2) {
        const fieldsWithErrors = form.formFields.filter((f) => f.hasErrorMessage);
        if (fieldsWithErrors.length === 0 && !form.hasErrorState) {
          findings.push({
            ruleId: 'UX-FLOW-002',
            title: `Form Component "${form.name}" Lacks Inline Validation Error States`,
            severity: 'medium',
            precision: 'medium',
            maturity: 'stable',
            category: 'ux-flows',
            evidence: [
              `Form contains ${form.formFields.length} input fields but zero inline error message bindings or error states.`,
              'Users submitting invalid data will receive no inline guidance on which fields require correction.',
            ],
            locations: [{ file: form.file, line: form.line }],
            agentObjective:
              'Connect validation schemas to form inputs with visible error messages and aria-invalid attributes.',
          });
        }
      }
    }

    return findings;
  },
};
