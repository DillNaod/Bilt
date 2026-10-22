import { loadConfig } from "../../config/config.js";
import type { FixOptions, ScanFinding, Fix } from "../../types/index.js";
import { canFixFinding } from "../../core/fix/can-fix.js";
import { debugReadFile, debugWriteFile } from "./apply.js";
import type { FixPlanContext } from "./strategies/index.js";
import {
  planSecurityRuleFix,
  planEnvFix,
  planGitFix,
  planConfigFix,
  planDependencyFix,
  planPluginsAndApiFix,
} from "./strategies/index.js";

/**
 * Generate fix actions from scan findings using modular fix strategies.
 */
export async function generateFixActions(
  rootDir: string,
  findings: ScanFinding[],
  options: FixOptions,
): Promise<Fix[]> {
  const actions: Fix[] = [];
  const config = await loadConfig(rootDir);

  const ctx: FixPlanContext = {
    rootDir,
    options,
    addedTypes: new Set<string>(),
    config,
    readFile: (p: string) => debugReadFile(p, options.debug),
    writeFile: (p: string, n: string, o: string = "") => debugWriteFile(p, n, o, options.debug),
  };

  for (const finding of findings) {
    if (!canFixFinding(finding)) {
      continue;
    }

    // 1. Security Engine safe auto-fix rules
    const secFixes = await planSecurityRuleFix(finding, ctx);
    if (secFixes) {
      actions.push(...secFixes);
      continue;
    }

    // 2. Environment variables, exposed secrets, and .env.example
    const envFixes = await planEnvFix(finding, ctx);
    if (envFixes) {
      actions.push(...envFixes);
      continue;
    }

    // 3. Git tracking, .gitignore, and history purging
    const gitFixes = await planGitFix(finding, ctx);
    if (gitFixes) {
      actions.push(...gitFixes);
      continue;
    }

    // 4. Configuration (Docker, tsconfig, CI workflows)
    const configFixes = await planConfigFix(finding, ctx);
    if (configFixes) {
      actions.push(...configFixes);
      continue;
    }

    // 5. Dependencies (unused, duplicate, vulnerable)
    const depFixes = await planDependencyFix(finding, ctx);
    if (depFixes) {
      actions.push(...depFixes);
      continue;
    }

    // 6. Plugins and API exposure
    const pluginFixes = await planPluginsAndApiFix(finding, ctx);
    if (pluginFixes) {
      actions.push(...pluginFixes);
      continue;
    }
  }

  return actions;
}
