// ─── L5: Product Claims vs Reality ───────────────────────────────────────────
// Detects hardcoded metrics, decorative numbers, and fake social proof presented
// as live measurements without underlying data sources.
// ─────────────────────────────────────────────────────────────────────────────

import type { Provenance } from "../facts/fact.js";

export const MEASURE_NOUNS =
  /(?:users|customers|companies|teams|enterprises|transactions|requests|uptime|stars|downloads|revenue|active|queries|developers)/i;

export interface MetricDisplay {
  component: string;
  at: Provenance;
  literal: string;
  labeledAs: string;
  hasDataSource: boolean;
}

export function detectHardcodedMetrics(
  componentName: string,
  filePath: string,
  content: string
): MetricDisplay[] {
  const displays: MetricDisplay[] = [];

  // Look for formatted numbers near measure nouns, e.g. "10,000+ active users", "99.9% uptime"
  const metricRegex =
    /(?:>|["'`]|\s|^)([0-9]{1,3}(?:,[0-9]{3})*\+?|\d+(?:\.\d+)?%)\s+([a-zA-Z\s]{3,30})(?:<|["'`]|\s|$)/g;

  let match: RegExpExecArray | null;
  while ((match = metricRegex.exec(content)) !== null) {
    const literal = match[1] || "";
    const label = match[2] || "";

    if (MEASURE_NOUNS.test(label)) {
      // Check if component fetches dynamic data or receives metrics props
      const hasDataSource =
        /useQuery|fetch|axios|props\.stats|stats\.|metrics\.|data\./i.test(content);

      const line = content.slice(0, match.index).split("\n").length;

      displays.push({
        component: componentName,
        at: { file: filePath, startLine: line, endLine: line },
        literal,
        labeledAs: label.trim(),
        hasDataSource,
      });
    }
  }

  return displays;
}
