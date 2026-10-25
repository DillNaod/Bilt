// ─── Env Code Reference Scanner ──────────────────────────────────────────────

/**
 * Captures env var names from common patterns across JS/TS/Python/Ruby.
 * Each regex has a single named capture group `key`.
 */
export const ENV_REF_PATTERNS: RegExp[] = [
  // process.env.VAR_NAME
  /process\.env\.(?<key>[A-Z_][A-Z0-9_]*)/g,
  // process.env['VAR_NAME'] or process.env["VAR_NAME"]
  /process\.env\[['"](?<key>[A-Z_][A-Z0-9_]*)['"]\]/g,
  // import.meta.env.VAR_NAME (Vite)
  /import\.meta\.env\.(?<key>[A-Z_][A-Z0-9_]*)/g,
  // os.environ.get('VAR_NAME') (Python)
  /os\.environ\.get\(\s*['"](?<key>[A-Z_][A-Z0-9_]*)['"]/g,
  // os.environ['VAR_NAME'] (Python)
  /os\.environ\[['"](?<key>[A-Z_][A-Z0-9_]*)['"]\]/g,
  // ENV['VAR_NAME'] (Ruby / generic)
  /ENV\[['"](?<key>[A-Z_][A-Z0-9_]*)['"]\]/g,
  // ENV.fetch('VAR_NAME') (Ruby)
  /ENV\.fetch\(\s*['"](?<key>[A-Z_][A-Z0-9_]*)['"]/g,
];

/**
 * Scan source code for references to environment variables.
 * Returns a deduplicated list of variable names found.
 */
export function scanCodeForEnvRefs(
  content: string,
  _filePath?: string,
): string[] & { size: number } {
  const refs = new Set<string>();

  for (const pattern of ENV_REF_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const key = match.groups?.["key"];
      if (key) refs.add(key);
    }
  }

  const result = [...refs] as any;
  result.size = refs.size;
  return result;
}
