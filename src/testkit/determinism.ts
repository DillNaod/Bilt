// ─── Testkit: Global Determinism & Fingerprint Stability ──────────────────────
// Verifies byte-identical serialization across runs and invariant fingerprint stability.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";

/**
 * Serializes an object to canonical JSON:
 * - Deterministic alphabetical key order at every depth
 * - Posix path separators
 * - Transient timestamp/date keys ignored or normalized
 */
export function canonicalJson(val: any): string {
  function normalize(item: any): any {
    if (item === null || typeof item !== "object") {
      if (typeof item === "string") {
        // Normalize windows slashes if present in paths
        return item.replace(/\\/g, "/");
      }
      return item;
    }

    if (Array.isArray(item)) {
      return item.map(normalize);
    }

    const sortedObj: Record<string, any> = {};
    const keys = Object.keys(item).sort();
    for (const key of keys) {
      if (key === "timestamp" || key === "durationMs" || key === "buildTimeMs") {
        continue; // omit nondeterministic timings from canonical comparison
      }
      sortedObj[key] = normalize(item[key]);
    }
    return sortedObj;
  }

  return JSON.stringify(normalize(val), null, 2);
}

export function hashString(str: string): string {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

export function assertByteIdentical(a: any, b: any): boolean {
  const jsonA = canonicalJson(a);
  const jsonB = canonicalJson(b);
  return hashString(jsonA) === hashString(jsonB);
}
