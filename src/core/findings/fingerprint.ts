// ─── L8: Semantic Fingerprint Generator ──────────────────────────────────────
// Generates stable fingerprints that survive formatting, refactors, and file moves.
// Excludes line numbers, formatting, local variable names, and absolute paths.
// ─────────────────────────────────────────────────────────────────────────────

import { computeSha256, type SubjectKey } from "./finding.js";

export function fingerprint(
  rule: { id?: string; ruleId?: string; subject?: SubjectKey } | string,
  subject?: SubjectKey
): string {
  const ruleId = typeof rule === "string" ? rule : (rule.id ?? rule.ruleId ?? "");
  const subj = subject ?? (typeof rule === "object" && "subject" in rule ? (rule as any).subject : undefined);
  const canonical = JSON.stringify({
    rule: ruleId,
    subject: subj?.kind ?? "generic",
    key: subj?.stableKey ?? "",
    shape: subj?.shapeKey ?? "",
  });
  return computeSha256(canonical).slice(0, 20);
}
