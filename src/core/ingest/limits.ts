// ─── L0: Safe Ingestion Limits ────────────────────────────────────────────────
// Enforces hard limits for untrusted repositories to prevent memory exhaustion,
// path traversal, and runaway execution.
// ─────────────────────────────────────────────────────────────────────────────

export const LIMITS = {
  maxFileBytes: 2_000_000,          // 2 MB per file
  maxFiles: 50_000,                 // 50,000 files per repo
  maxTotalBytes: 1_500_000_000,     // 1.5 GB total per repo
  maxAstDepth: 400,                 // AST recursion limit
  maxParseMs: 2_000,                // 2s parse timeout per file
  maxPathLength: 1024,              // 1024 characters max path
} as const;

export type SkipReason =
  | "too-large"
  | "binary"
  | "symlink-escape"
  | "depth-limit"
  | "parse-timeout"
  | "ignored"
  | "limit-reached";

export interface IngestedFile {
  path: string;                     // repo-relative, posix separators, NFC-normalized
  bytes: Buffer;
  sha256: string;                   // cache key and fingerprint input
  skipped?: SkipReason;
}
