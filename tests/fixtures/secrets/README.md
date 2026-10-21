# Synthetic Security & Credential Test Fixtures

> **CRITICAL SECURITY DISCLOSURE & ISOLATION NOTICE**  
> All tokens, keys, passwords, and connection strings in this directory and its subdirectories (`leaky-project`, `vulnerable-api-app`, `vulnerable-api-deep`, `hostile`, etc.) are **100% synthetic, non-functional mock values**.
>
> **NONE OF THESE VALUES ARE REAL, ACTIVE, OR HISTORICAL PRODUCTION CREDENTIALS.**

---

## 1. Why These Fixtures Exist

Bilt Toolkit is a security and production-readiness verification engine. To verify that its:
- Regex entropy scanners,
- AST-level secret detectors,
- Git history diff checkers,
- Live credential verifiers (dry run / offline negative tests), and
- Agent remediation / auto-fix handlers

function accurately, the test suite requires realistic synthetic inputs that conform to the exact regex signatures of real-world secrets (e.g. AWS access keys, Stripe live keys, Slack tokens, private keys, database connection strings).

Removing or modifying these strings to simple dummy text like `"xxx"` would break pattern matching and degrade the fidelity of the security test suite.

---

## 2. Leakage Prevention Protocol

To ensure these synthetic fixtures are never accidentally leaked or used in live environments:
1. **Network Isolation**: Bilt test runners execute credential verifiers with mock transports; no outbound API calls are made with fixture tokens during automated testing.
2. **Package Exclusion**: `package.json` `"files"` configuration specifically includes only `dist/` and `src/concepts`. The `tests/` and `tests/fixtures/` directories are **strictly excluded** from published npm artifacts (`npm pack`).
3. **Log & Snapshot Redaction**: All CLI reporters and agent JSON formats pass output through `src/core/safety/sanitizer.ts` to redact detected secret patterns before terminal display or file writing.
4. **Git Hygiene**: These fixtures reside exclusively in dedicated testing paths (`tests/fixtures/`) which are recognized by Bilt's git scope analyzer as test fixtures, ensuring they do not trigger false positive production warnings during local development.
