// ─── Env File Parsing, Diffing & Cross-Reference ─────────────────────────────
//
// Pure functions for working with .env files:
//   • Parsing .env content into structured entries
//   • Discovering .env* files in a project
//   • Cross-comparing env files (e.g. .env vs .env.example)
//   • Scanning source code for process.env / import.meta.env references
//   • Finding missing and unused env vars
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import { promises as fs } from "node:fs";
import fg from "fast-glob";
import type {
  ScanFinding,
  BiltConfig,
  Severity,
} from "../../types/index.js";
import { detectFramework, checkClientExposedSecrets } from "./framework.js";
import { SECRET_RULES } from "../rules/secret-rules.js";

import {
  parseEnvFile,
  findEnvFiles,
  diffEnvFiles,
  scanCodeForEnvRefs,
  findMissingEnvVars,
  findUnusedEnvVars,
} from "./env/index.js";

export * from "./env/index.js";

/**
 * Helper to apply severity overrides and filters to findings.
 */
function applyOverridesAndFilter(
  findings: ScanFinding[],
  config: BiltConfig,
  minSeverity?: Severity,
): ScanFinding[] {
  for (const finding of findings) {
    if (finding.ruleId) {
      const override = config.severityOverrides?.[finding.ruleId];
      if (override) finding.severity = override;
    }
  }

  if (minSeverity) {
    const severityOrder: Record<Severity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
      passed: 3,
    };
    const minLevel = severityOrder[minSeverity];
    return findings.filter((f) => severityOrder[f.severity] <= minLevel);
  }

  return findings;
}

/**
 * Performs a full environment variable scan for a project directory.
 */
export async function performEnvScan(
  rootDir: string,
  config: BiltConfig,
  options: { severity?: string; debug?: boolean } = {},
): Promise<ScanFinding[]> {
  const stepFindings: ScanFinding[] = [];
  const envFiles = await findEnvFiles(rootDir);
  const parsedEnvFiles = [];
  for (const envFile of envFiles) {
    try {
      const content = await fs.readFile(envFile, "utf-8");
      const parsed = parseEnvFile(content, envFile);
      parsedEnvFiles.push(parsed);
    } catch {
      // Skip unreadable files
    }
  }

  const codeFiles = await fg(
    ["**/*.ts", "**/*.js", "**/*.tsx", "**/*.jsx", "**/*.py", "**/*.rb"],
    {
      cwd: rootDir,
      ignore: config.ignore,
      onlyFiles: true,
      absolute: true,
    },
  );

  const envRefs = new Set<string>();
  const primaryEnv = parsedEnvFiles[0];
  const allDefinedKeys = new Set(
    parsedEnvFiles.flatMap((f) => [...f.entries.keys()]),
  );
  const definedKeys = [...allDefinedKeys];

  for (const codeFile of codeFiles) {
    try {
      const content = await fs.readFile(codeFile, "utf-8");
      const refs = scanCodeForEnvRefs(content, codeFile);
      for (const ref of refs) envRefs.add(ref);

      if (parsedEnvFiles.length > 0) {
        const missingFindings = findMissingEnvVars(
          refs,
          definedKeys,
          path.relative(rootDir, codeFile),
        );
        stepFindings.push(...missingFindings);
      }
    } catch {
      // Skip unreadable files
    }
  }

  if (parsedEnvFiles.length >= 2) {
    const diffFindings = diffEnvFiles(parsedEnvFiles);
    stepFindings.push(...diffFindings);
  }

  if (primaryEnv) {
    const unusedFindings = findUnusedEnvVars(
      [...envRefs],
      [...primaryEnv.entries.values()],
      path.relative(rootDir, primaryEnv.filePath),
    );
    stepFindings.push(...unusedFindings);
  }

  try {
    const detectedFramework = await detectFramework(rootDir);
    if (detectedFramework && parsedEnvFiles.length > 0) {
      const exposedFindings = checkClientExposedSecrets(
        parsedEnvFiles,
        detectedFramework,
        SECRET_RULES,
        config.entropyThreshold,
      );
      stepFindings.push(...exposedFindings);
    }
  } catch {
    // Framework detection failed
  }

  const filteredStepFindings = applyOverridesAndFilter(
    stepFindings,
    config,
    options.severity as Severity,
  );

  if (primaryEnv) {
    const envIssueKeys = new Set<string>();
    for (const f of filteredStepFindings) {
      const keyMatch =
        f.message.match(/Variable "(?<key>[A-Z_][A-Z0-9_]*)"/) ||
        f.message.match(/process\.env\.(?<key>[A-Z_][A-Z0-9_]*)/);
      if (keyMatch?.groups?.["key"]) {
        envIssueKeys.add(keyMatch.groups["key"]);
      }
    }
    const healthyKeys = definedKeys.filter((k) => !envIssueKeys.has(k));
    if (healthyKeys.length > 0) {
      filteredStepFindings.push({
        id: `env-healthy-${Date.now()}`,
        severity: "passed",
        category: "env-mismatch",
        message: `${healthyKeys.length} var${healthyKeys.length > 1 ? "s" : ""} healthy`,
        file: primaryEnv.filePath,
        suggestion: healthyKeys.join(", "),
      });
    }
  }

  return filteredStepFindings;
}
