// ─── L7: Rule Execution Engine ────────────────────────────────────────────────
// Evaluates rules in stable order, degrades rules when required facts are unknown,
// and wraps QueryFacade to verify declared fact consumption.
// ─────────────────────────────────────────────────────────────────────────────

import type { QueryFacade } from "../model/query-facade.js";
import { guarded } from "../model/query-facade.js";
import type { Finding } from "../findings/finding.js";
import { fingerprint } from "../findings/fingerprint.js";
import type { Fact } from "../facts/fact.js";
import { allRules, type RuleDef } from "./registry.js";

export interface RunOpts {
  only?: string[];
  experimental?: boolean;
}

export interface RuleCoverage {
  id: string;
  status: "ran" | "degraded" | "disabled";
  because?: string;
}

function describeUnknown(f: Fact<unknown>): string {
  if (f.state === "unknown") {
    const at = (f.reason as any).at?.file ? ` at ${(f.reason as any).at.file}` : "";
    return `${f.reason.kind}${at}`;
  }
  return "missing fact";
}

function finalize(rule: RuleDef, f: Finding): Finding {
  const fp =
    f.fingerprint ||
    fingerprint(rule, {
      kind: "generic",
      stableKey: f.locations[0]?.file ? `${f.locations[0].file}:${f.locations[0].line || 1}` : rule.id,
      shapeKey: f.title,
    });

  return {
    ...f,
    ruleId: rule.id,
    severity: f.severity ?? rule.severity,
    precision: f.precision ?? rule.precision,
    maturity: f.maturity ?? rule.maturity,
    confidence: f.confidence ?? rule.precision,
    status: f.status ?? "open",
    fingerprint: fp,
    agentAction: f.agentAction ?? {
      objective: `Remediate ${rule.id}: ${f.title}`,
      acceptance: [],
      doNot: ["do not suppress without review"],
      safeToAutoFix: false,
    },
  };
}

function recordCoverage(
  covReport: any,
  id: string,
  status: "ran" | "degraded" | "disabled",
  because?: string,
): void {
  if (!covReport) return;
  if (status === "ran") {
    if (typeof covReport.ruleRan === "function") covReport.ruleRan(id);
    else if (Array.isArray(covReport.rules)) covReport.rules.push({ id, status: "ran" });
  } else if (status === "degraded") {
    if (typeof covReport.ruleDegraded === "function") covReport.ruleDegraded(id, because || "");
    else if (Array.isArray(covReport.rules)) covReport.rules.push({ id, status: "degraded", because });
  } else if (status === "disabled") {
    if (typeof covReport.ruleDisabled === "function") covReport.ruleDisabled(id, because || "");
    else if (Array.isArray(covReport.rules)) covReport.rules.push({ id, status: "disabled", because });
  }
}

export function runRules(
  Q: QueryFacade,
  opts: RunOpts = {},
): { findings: Finding[]; coverage: RuleCoverage[] } {
  const findings: Finding[] = [];
  const coverage: RuleCoverage[] = [];

  for (const rule of allRules()) {
    if (opts.only && !opts.only.includes(rule.id)) continue;

    if (rule.maturity === "experimental" && !opts.experimental) {
      coverage.push({ id: rule.id, status: "disabled", because: "experimental" });
      recordCoverage(Q.coverage(), rule.id, "disabled", "experimental");
      continue;
    }

    if (rule.needs === "rendered" && !Q.hasRenderedFacts()) {
      coverage.push({ id: rule.id, status: "degraded", because: "rendered pass unavailable" });
      recordCoverage(Q.coverage(), rule.id, "degraded", "rendered pass unavailable");
      continue;
    }

    const missing = (rule.requiredFacts?.(Q) ?? []).find((f) => f.state === "unknown");
    if (missing) {
      const because = describeUnknown(missing);
      coverage.push({ id: rule.id, status: "degraded", because });
      recordCoverage(Q.coverage(), rule.id, "degraded", because);
      continue;
    }

    const guardedQ = guarded(Q, rule);
    const out = rule.detect(guardedQ);

    findings.push(...out.map((f) => finalize(rule, f)));
    coverage.push({ id: rule.id, status: "ran" });
    recordCoverage(Q.coverage(), rule.id, "ran");
  }

  return { findings, coverage };
}
