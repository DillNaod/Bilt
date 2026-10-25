// ─── Scan Finding Filter & Severity Overrides ─────────────────────────────────

import type { ScanFinding, Severity } from "../../types/index.js";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  passed: 3,
};

/**
 * Apply configuration severity overrides to findings and filter by minimum severity.
 */
export function applyOverridesAndFilter(
  findings: ScanFinding[],
  config: any,
  minSeverity?: Severity,
): ScanFinding[] {
  if (config?.severityOverrides) {
    for (const finding of findings) {
      if (finding.ruleId) {
        const override = config.severityOverrides[finding.ruleId];
        if (override) {
          finding.severity = override;
        }
      }
    }
  }

  if (minSeverity) {
    const minLevel = SEVERITY_ORDER[minSeverity];
    if (minLevel !== undefined) {
      return findings.filter((f) => SEVERITY_ORDER[f.severity] <= minLevel);
    }
  }

  return findings;
}
