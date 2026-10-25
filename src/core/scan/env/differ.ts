// ─── Env File Differ ─────────────────────────────────────────────────────────

import type { ParsedEnvFile, ScanFinding } from "../../../types/index.js";

let findingCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++findingCounter}`;
}

/**
 * Cross-compare multiple parsed env files and produce findings for
 * variables that exist in one file but are missing from another.
 *
 * Template files (`.env.example`, `.env.template`, `.env.sample`) are
 * treated as the "source of truth" — variables present in a template
 * but missing from an actual env file produce a finding.
 */
export function diffEnvFiles(
  filesOrFileA: ParsedEnvFile[] | ParsedEnvFile,
  fileB?: ParsedEnvFile,
): ScanFinding[] {
  const files = Array.isArray(filesOrFileA)
    ? filesOrFileA
    : fileB
      ? [filesOrFileA, fileB]
      : [filesOrFileA];

  if (files.length < 2) return [];

  const findings: ScanFinding[] = [];
  const templateSuffixes = [".example", ".template", ".sample"];

  const isTemplate = (fp: string): boolean =>
    templateSuffixes.some((s) => fp.endsWith(s));

  for (const fileA of files) {
    for (const fileB of files) {
      if (fileA === fileB) continue;

      // Only report "missing in B" when A is a template or both are real files
      // to avoid noisy duplicate findings.
      if (!isTemplate(fileA.filePath) && isTemplate(fileB.filePath)) continue;

      for (const key of fileA.entries.keys()) {
        if (!fileB.entries.has(key)) {
          const severity = isTemplate(fileA.filePath) ? "warning" : "info";
          const baseName = (fp: string) => fp.split(/[\\/]/).pop() ?? fp;

          findings.push({
            id: nextId("env-mismatch"),
            severity,
            category: "env-mismatch",
            message: `Variable "${key}" is defined in ${baseName(fileA.filePath)} but missing from ${baseName(fileB.filePath)}`,
            file: fileB.filePath,
            suggestion: `Add ${key} to ${baseName(fileB.filePath)}`,
          });
        }
      }
    }
  }

  return findings;
}
