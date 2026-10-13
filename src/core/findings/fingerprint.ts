// ─── L8: Semantic Fingerprint Generator ──────────────────────────────────────
// Generates stable fingerprints that survive formatting, refactors, and file moves.
// Excludes line numbers, formatting, local variable names, and absolute paths.
// ─────────────────────────────────────────────────────────────────────────────

import { computeSha256, type SubjectKey } from "./finding.js";

export function fingerprint(rule: { id: string }, subject: SubjectKey): string {
  const canonical = JSON.stringify({
    rule: rule.id,
    subject: subject.kind,
    key: subject.stableKey,
    shape: subject.shapeKey ?? "",
  });
  return computeSha256(canonical).slice(0, 20);
}
