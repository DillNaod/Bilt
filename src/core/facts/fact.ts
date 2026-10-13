// ─── L1: Fact Extraction & Tri-State Fact Model ──────────────────────────────
// Invariant: Facts are strictly tri-state ("confirmed" | "absent" | "unknown").
// Rules treat "missing" as evidence ONLY when a fact is "absent" with a recorded search scope.
// If an extractor cannot resolve something, it emits "unknown" and rules degrade rather than guess.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";

export interface Provenance {
  file: string;
  startLine?: number;
  endLine?: number;
  extractor?: string;              // e.g. "next.route-handler@1"
  snippetHash?: string;            // SHA-256 hash only; NEVER raw repo text in provenance
}

export function makeProvenance(
  file: string,
  startLine: number = 1,
  endLine: number = 1,
  extractor: string = "static",
  snippetText: string = "",
): Provenance {
  return {
    file,
    startLine,
    endLine,
    extractor,
    snippetHash: snippetText
      ? createHash("sha256").update(snippetText).digest("hex")
      : "",
  };
}

export type UnknownReason =
  | { kind: "dynamic-import"; at?: Provenance }
  | { kind: "unresolved-middleware"; name?: string; at?: Provenance }
  | { kind: "unsupported-framework"; framework?: string }
  | { kind: "parse-failed"; file?: string; at?: Provenance }
  | { kind: "computed-property"; at?: Provenance }
  | { kind: "needs-rendered-pass" }
  | { kind: string; at?: Provenance; [key: string]: any };

export interface SearchScope {
  glob?: string;
  filesSearched?: number;
  resolver?: string;
  file?: string;
  line?: number;
}

export type Fact<T> =
  | { state: "confirmed"; value: T; provenance: Provenance[] }
  | { state: "absent"; searched: SearchScope[] }
  | { state: "unknown"; reason: UnknownReason };

export const confirmed = <T>(value: T, provenance: Provenance[] = []): Fact<T> => ({
  state: "confirmed",
  value,
  provenance,
});

export const unknown = <T>(reason: UnknownReason): Fact<T> => ({
  state: "unknown",
  reason,
});

export const absent = <T>(searched: SearchScope[] = []): Fact<T> => ({
  state: "absent",
  searched,
});

/**
 * Combine facts along an evidence chain: result is only as strong as the weakest link.
 */
export function allConfirmed<T extends readonly Fact<unknown>[]>(
  ...facts: T
): "confirmed" | "absent" | "unknown" {
  if (facts.some((f) => f.state === "unknown")) return "unknown";
  if (facts.some((f) => f.state === "absent")) return "absent";
  return "confirmed";
}

export type Confidence = "high" | "medium" | "low";

/**
 * A finding's confidence is the minimum over the facts in its evidence chain.
 */
export function chainConfidence(
  links: { precision: Confidence; fact: Fact<unknown> }[],
): Confidence {
  const order: Confidence[] = ["low", "medium", "high"];
  let min = 2; // high
  for (const { precision, fact } of links) {
    if (fact.state === "unknown") return "low";
    min = Math.min(min, order.indexOf(precision));
  }
  return order[min] ?? "low";
}
