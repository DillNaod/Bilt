// ─── Scan Finding Enrichment & Result Construction ─────────────────────────

import type {
  ScanFinding,
  ScanOptions,
  ScanResult,
  FrameworkInfo,
} from "../../types/index.js";
import {
  getGitScope,
  isFindingIntroducedByChange,
} from "../../core/scoping/git-scope.js";
import {
  loadBaseline,
  isFingerprintInBaseline,
} from "../../core/scoping/baseline.js";
import { computeFingerprint } from "../../core/finding/fingerprint.js";
import { generateAIExplanation } from "../../core/ai/explainer.js";
import { calculateHealthScore } from "../../core/score/health.js";

/**
 * Enriches findings with fingerprints, git change scope, baseline membership,
 * and AI explanations, sorting live credentials first.
 */
export async function enrichScanFindings(
  findings: ScanFinding[],
  rootDir: string,
  options: ScanOptions,
): Promise<void> {
  const scope = await getGitScope(rootDir, {
    changed: options.changed,
    base: options.base,
  });
  const baseline = await loadBaseline(rootDir);

  for (const f of findings) {
    if (!f.fingerprint) {
      f.fingerprint = computeFingerprint({
        ruleId: f.ruleId || f.category,
        file: f.file,
        snippet: f.preview,
      });
    }
    const introducedByGit = isFindingIntroducedByChange(
      f.file,
      f.line || 1,
      scope,
    );
    const inBaseline = isFingerprintInBaseline(f.fingerprint, baseline);
    f.introducedByChange = introducedByGit && !inBaseline;

    if (!f.aiExplanation) {
      f.aiExplanation = generateAIExplanation(f);
    }
  }

  // Sort verified live findings first
  findings.sort((a, b) => {
    const aLive =
      a.category === "secret-detected" &&
      a.verificationState === "verified-live";
    const bLive =
      b.category === "secret-detected" &&
      b.verificationState === "verified-live";
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    return 0;
  });
}

/**
 * Constructs the final ScanResult object with computed health scores and metadata.
 */
export function buildScanResult(
  findings: ScanFinding[],
  scannedFiles: number,
  detectedFramework: FrameworkInfo | undefined,
  startTime: number,
): ScanResult {
  const { score, domainScores, grade } = calculateHealthScore(findings);
  const duration = Date.now() - startTime;

  return {
    findings: findings.filter((f) => f.severity !== "passed"),
    healthScore: score,
    domainScores,
    grade,
    timestamp: new Date(),
    scannedFiles,
    framework: detectedFramework,
    duration,
  };
}
