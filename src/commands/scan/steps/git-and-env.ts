// ─── Scan Step: Git & Environment Hygiene ─────────────────────────────────────

import type { ScanFinding, Severity } from "../../../types/index.js";
import { findEnvFiles } from "../../../core/scan/env.js";
import {
  checkEnvFilesIgnoredWithGit,
  checkCommonDirsIgnored,
} from "../../../core/scan/gitignore.js";
import { scanGitRepository } from "../../../core/scan/git.js";
import { applyOverridesAndFilter } from "../filter.js";
import type { ScanStepContext } from "./context.js";

export async function runGitAndEnvStep(
  ctx: ScanStepContext,
): Promise<ScanFinding[]> {
  const envFiles = await findEnvFiles(ctx.rootDir);
  const stepFindings = await checkEnvFilesIgnoredWithGit(
    ctx.rootDir,
    envFiles,
  );
  const commonDirsFindings = await checkCommonDirsIgnored(ctx.rootDir);
  stepFindings.push(...commonDirsFindings);

  const gitRepoFindings = await scanGitRepository(ctx.rootDir, {
    historyDepth: ctx.config.historyDepth,
  });
  stepFindings.push(...gitRepoFindings);

  return applyOverridesAndFilter(
    stepFindings,
    ctx.config,
    ctx.options.severity as Severity,
  );
}
