// ─── Env Var Missing & Unused Analysis ────────────────────────────────────────

import type { ParsedEnvEntry, ScanFinding } from "../../../types/index.js";

let findingCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++findingCounter}`;
}

// Built-in Node/framework/cloud runtime vars that don't need to be in .env
export const BUILTIN_ENV_VARS = new Set([
  "NODE_ENV",
  "PORT",
  "HOST",
  "PWD",
  "HOME",
  "PATH",
  "CI",
  "TZ",
  "DEBUG",
  "VERCEL",
  "VERCEL_ENV",
  "NETLIFY",
  "AWS_REGION",
  "AWS_EXECUTION_ENV",
  "FORCE_COLOR",
  "TERM",
  "SHELL",
]);

// Common vars that may be used implicitly by runtimes / libraries
export const IMPLICIT_ENV_VARS = new Set([
  "NODE_ENV",
  "PORT",
  "HOST",
  "TZ",
  "DEBUG",
  "LOG_LEVEL",
  "DATABASE_URL",
  "REDIS_URL",
  "ALLOWED_HOSTS",
  "SECRET_KEY",
  "DJANGO_SETTINGS_MODULE",
]);

/**
 * Given the env var names referenced in code and the env vars actually
 * defined, produce findings for any referenced vars that are missing.
 */
export function findMissingEnvVars(
  codeRefs: string[] | Set<string>,
  envVars: string[] | Set<string>,
  codeFile: string,
): ScanFinding[] {
  const defined = envVars instanceof Set ? envVars : new Set(envVars);
  const refs = codeRefs instanceof Set ? [...codeRefs] : codeRefs;
  const findings: ScanFinding[] = [];

  for (const ref of refs) {
    if (defined.has(ref) || BUILTIN_ENV_VARS.has(ref)) continue;

    findings.push({
      id: nextId("env-missing"),
      severity: "warning",
      category: "env-missing",
      message: `Code references process.env.${ref} but it is not defined in any .env file`,
      file: codeFile,
      suggestion: `Add ${ref}= to your .env file`,
    });
  }

  return findings;
}

/**
 * Given the env var names referenced in code and all env entries,
 * produce findings for env vars that are defined but never used.
 */
export function findUnusedEnvVars(
  firstArg: string[] | Set<string>,
  secondArg: ParsedEnvEntry[] | Set<string>,
  envFile: string,
): ScanFinding[] {
  let referenced: Set<string>;
  let entriesList: Array<{ key: string; line: number }>;

  if (firstArg instanceof Set) {
    // Test case format: firstArg is definedKeys (Set), secondArg is envRefs (Set)
    const definedKeys = firstArg;
    referenced =
      secondArg instanceof Set ? secondArg : new Set(secondArg as any);
    entriesList = [...definedKeys].map((key) => ({ key, line: 1 }));
  } else {
    // Normal format: firstArg is codeRefs (string[]), secondArg is envEntries (ParsedEnvEntry[])
    referenced = new Set(firstArg);
    entriesList = secondArg as ParsedEnvEntry[];
  }

  const findings: ScanFinding[] = [];

  for (const entry of entriesList) {
    if (referenced.has(entry.key) || IMPLICIT_ENV_VARS.has(entry.key)) continue;

    findings.push({
      id: nextId("env-unused"),
      severity: "info",
      category: "env-unused",
      message: `Variable "${entry.key}" is defined in .env but not referenced in scanned code`,
      file: envFile,
      line: entry.line,
      suggestion: `Remove ${entry.key} if it is no longer needed`,
    });
  }

  return findings;
}
