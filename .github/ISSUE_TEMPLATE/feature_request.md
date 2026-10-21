---
name: Feature / Rule Proposal
about: Suggest a new deterministic readiness rule or feature for Bilt
title: '[PROPOSAL] '
labels: ['enhancement', 'rule-proposal']
assignees: ''
---

## Feature / Rule Summary
A clear and concise description of the proposed feature or deterministic rule.

## Why This Matters (Security / Reliability / UX Impact)
Explain the concrete risk, failure mode, or architectural benefit.

## Proposed Precision & Remediation
- **Category**: (e.g. `secrets-and-env`, `auth`, `authorization`, `design-quality`, `monitoring`)
- **Severity**: (`critical`, `high`, `medium`, `low`, `info`)
- **Automated vs Guided**: Can this be deterministically proven via AST/dataflow, or does it require guided human review?
- **Safe Auto-Fix**: Is a non-breaking mechanical auto-fix possible?
