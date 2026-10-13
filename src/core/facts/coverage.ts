// ─── L1: Coverage Recorder & Report ──────────────────────────────────────────
// Records exactly what the engine could and could not analyze during a run.
// The rule engine consults this before running rules so unknown constructs cause
// rule degradation rather than false positives.
// ─────────────────────────────────────────────────────────────────────────────

import type { Provenance, UnknownReason } from "./fact.js";
import type { SkipReason } from "../ingest/limits.js";

export interface CoverageReport {
  frameworks: { name: string; supported: boolean; adapterVersion?: string }[];
  routes: { resolved: number; unresolved: number; unresolvedReasons: UnknownReason[] };
  files: { parsed: number; skipped: Record<SkipReason, number>; parseFailed: string[] };
  dynamicConstructs: { kind: string; at: Provenance }[];
  rules: { id: string; status: "ran" | "degraded" | "disabled"; because?: string }[];
}

function emptyReport(): CoverageReport {
  return {
    frameworks: [],
    routes: { resolved: 0, unresolved: 0, unresolvedReasons: [] },
    files: {
      parsed: 0,
      skipped: {
        "too-large": 0,
        binary: 0,
        "symlink-escape": 0,
        "depth-limit": 0,
        "parse-timeout": 0,
        ignored: 0,
        "limit-reached": 0,
      },
      parseFailed: [],
    },
    dynamicConstructs: [],
    rules: [],
  };
}

export class CoverageRecorder {
  private r: CoverageReport = emptyReport();

  skipDynamic(kind: string, at: Provenance): void {
    this.r.dynamicConstructs.push({ kind, at });
  }

  routeResolved(): void {
    this.r.routes.resolved++;
  }

  routeUnresolved(reason: UnknownReason): void {
    this.r.routes.unresolved++;
    this.r.routes.unresolvedReasons.push(reason);
  }

  fileParsed(): void {
    this.r.files.parsed++;
  }

  fileSkipped(reason: SkipReason): void {
    this.r.files.skipped[reason] = (this.r.files.skipped[reason] ?? 0) + 1;
  }

  parseFailed(file: string): void {
    this.r.files.parseFailed.push(file);
  }

  frameworkDetected(name: string, supported: boolean, adapterVersion?: string): void {
    if (!this.r.frameworks.some((f) => f.name === name)) {
      this.r.frameworks.push({ name, supported, adapterVersion });
    }
  }

  frameworkUnsupported(name: string): void {
    this.frameworkDetected(name, false);
  }

  ruleRan(id: string): void {
    this.r.rules.push({ id, status: "ran" });
  }

  ruleDegraded(id: string, because: string): void {
    this.r.rules.push({ id, status: "degraded", because });
  }

  ruleDisabled(id: string, because: string): void {
    this.r.rules.push({ id, status: "disabled", because });
  }

  snapshot(): CoverageReport {
    return structuredClone(this.r);
  }
}
