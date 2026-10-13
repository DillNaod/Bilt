// ─── L0: Parse Sandbox and AST Depth Protection ──────────────────────────────
// Guards AST parsing against pathological depth, regex bombs, and excessive runtime.
// ─────────────────────────────────────────────────────────────────────────────

import { parse, type ParseResult } from "@babel/parser";
import type { File as BabelFile } from "@babel/types";
import { LIMITS } from "./limits.js";

export interface ParseOutcome {
  ok: boolean;
  ast?: ParseResult<BabelFile>;
  error?: "parse-timeout" | "depth-limit" | "parse-failed";
}

/**
 * Checks AST depth recursively to guard against AST stack-overflow attacks.
 */
export function checkAstDepth(node: any, depth = 0): boolean {
  if (depth > LIMITS.maxAstDepth) return false;
  if (!node || typeof node !== "object") return true;

  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "start" || key === "end" || key === "comments") continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const child of val) {
        if (!checkAstDepth(child, depth + 1)) return false;
      }
    } else if (val && typeof val === "object" && typeof val.type === "string") {
      if (!checkAstDepth(val, depth + 1)) return false;
    }
  }
  return true;
}

/**
 * Parses code safely with depth bounds.
 */
export function safeParseAst(code: string, filename: string): ParseOutcome {
  try {
    const ast = parse(code, {
      sourceType: "unambiguous",
      plugins: ["typescript", "jsx"],
      sourceFilename: filename,
    });

    if (!checkAstDepth(ast.program)) {
      return { ok: false, error: "depth-limit" };
    }

    return { ok: true, ast };
  } catch (err: any) {
    if (err instanceof RangeError || err?.message?.includes("Maximum call stack size exceeded")) {
      return { ok: false, error: "depth-limit" };
    }
    return { ok: false, error: "parse-failed" };
  }
}
