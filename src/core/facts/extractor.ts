// ─── L1: Extractor Contract & Context ─────────────────────────────────────────
// Extractors are pure, deterministic functions of file content.
// Incremental cache key: sha256(content) + extractor.id + extractor.version.
// ─────────────────────────────────────────────────────────────────────────────

import type { IngestedFile } from "../ingest/limits.js";
import type { CoverageRecorder } from "./coverage.js";
import { safeParseAst } from "../ingest/sandbox.js";
import type { ParseResult } from "@babel/parser";
import type { File as BabelFile } from "@babel/types";

export interface ExtractCtx {
  coverage: CoverageRecorder;
  parseAst(file: IngestedFile): ParseResult<BabelFile> | null;
}

export interface Extractor<Out> {
  id: string;
  version: number; // bump invalidates incremental cache
  accepts(file: IngestedFile): boolean;
  extract(file: IngestedFile, ctx: ExtractCtx): Out; // pure, deterministic
}

export function createExtractCtx(coverage: CoverageRecorder): ExtractCtx {
  const astCache = new Map<string, ParseResult<BabelFile> | null>();
  return {
    coverage,
    parseAst(file: IngestedFile): ParseResult<BabelFile> | null {
      if (file.skipped) return null;
      if (astCache.has(file.path)) {
        return astCache.get(file.path)!;
      }
      const outcome = safeParseAst(file.bytes.toString("utf8"), file.path);
      if (!outcome.ok || !outcome.ast) {
        if (outcome.error) {
          coverage.parseFailed(file.path);
        }
        astCache.set(file.path, null);
        return null;
      }
      astCache.set(file.path, outcome.ast);
      return outcome.ast;
    },
  };
}
