## Description

Provide a clear and concise description of the changes proposed in this pull request.

---

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New rule or detector
- [ ] Architecture refactor
- [ ] Performance optimization
- [ ] Documentation update
- [ ] Test coverage addition

---

## Verification & Quality Protocol

Before opening this PR, verify that all engineering checks pass cleanly:

- [ ] `npm run lint` passes with 0 errors and 0 warnings.
- [ ] `npm run build` succeeds cleanly.
- [ ] `npm run test:all` passes all test suites.
- [ ] `npm run test:coverage` meets or exceeds strict coverage thresholds:
  - Lines: ≥ 80%
  - Functions: ≥ 80%
  - Branches: ≥ 70%
- [ ] New behavioral tests have been added for any new rule, feature, or bug fix.
- [ ] No live credentials or secrets are present in source, tests, or documentation.
