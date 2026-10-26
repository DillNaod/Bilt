// ─── Error Utilities & Boundary Translators ──────────────────────────────────
// Functions to identify, normalize, and translate errors across architecture boundaries.
// ─────────────────────────────────────────────────────────────────────────────

import { BiltError } from "./base.js";

/**
 * Type guard for BiltError instances (including cross-module boundaries).
 */
export function isBiltError(val: unknown): val is BiltError {
  return (
    val instanceof BiltError ||
    (typeof val === "object" && val !== null && "isBiltError" in val && (val as any).isBiltError === true)
  );
}

/**
 * Normalize any unknown thrown value (Error, string, object) into a BiltError.
 */
export function toBiltError(
  err: unknown,
  fallbackMessage = "An unexpected error occurred",
  defaultCode = "ERR_UNEXPECTED",
): BiltError {
  if (isBiltError(err)) {
    return err;
  }

  if (err instanceof Error) {
    return new BiltError(err.message, {
      code: (err as any).code || defaultCode,
      cause: err,
    });
  }

  return new BiltError(typeof err === "string" ? err : fallbackMessage, {
    code: defaultCode,
    cause: err,
  });
}

/**
 * Determine the canonical CLI process exit code from any error.
 */
export function translateErrorToExitCode(err: unknown, defaultCode = 1): number {
  if (isBiltError(err)) {
    return err.exitCode;
  }
  return defaultCode;
}
