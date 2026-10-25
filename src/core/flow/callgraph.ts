// ─── L4: Call Graph & Symbol Resolution ───────────────────────────────────────
// Models interprocedural call edges, parameter bindings, and dynamic dispatch facts.
// ─────────────────────────────────────────────────────────────────────────────

import type { Fact, Provenance } from "../facts/fact.js";
import { confirmed, unknown } from "../facts/fact.js";
import type { RepoIndex } from "../model/types.js";
import type { ExtractCtx } from "../facts/extractor.js";

export interface SymbolRef {
  file: string;
  name: string;
  kind?: "function" | "method" | "class" | "const";
  line?: number;
}

export interface ArgBinding {
  paramName?: string;
  argExpression: string;
}

export interface CallEdge {
  from: SymbolRef;
  to: Fact<SymbolRef>;
  at: Provenance;
  args: ArgBinding[];
}

export class CallGraph {
  private edges: CallEdge[] = [];

  add(edge: CallEdge): void {
    this.edges.push(edge);
  }

  getEdges(): readonly CallEdge[] {
    return Object.freeze([...this.edges]);
  }

  callersOf(targetName: string): CallEdge[] {
    return this.edges.filter(
      (e) => e.to.state === "confirmed" && e.to.value.name === targetName
    );
  }

  calleesOf(sourceName: string): CallEdge[] {
    return this.edges.filter((e) => e.from.name === sourceName);
  }
}

/**
 * Builds static call graph from repository files.
 */
export function buildCallGraph(repo: RepoIndex, _ctx?: ExtractCtx): CallGraph {
  const g = new CallGraph();

  for (const file of repo.files) {
    if (file.skipped) continue;
    const content = file.bytes.toString("utf8");

    // Scan function definitions
    const fnRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\s*\}/g;
    let fnMatch: RegExpExecArray | null;

    while ((fnMatch = fnRegex.exec(content)) !== null) {
      const fnName = fnMatch[1]!;
      const fnBody = fnMatch[3]!;
      const fnLine = content.slice(0, fnMatch.index).split("\n").length;
      const fromSym: SymbolRef = { file: file.path, name: fnName, kind: "function", line: fnLine };

      // Find call expressions inside function body: fnCall(arg1, arg2)
      const callRegex = /([a-zA-Z0-9_.[\]]+)\s*\(([^)]*)\)/g;
      let cMatch: RegExpExecArray | null;

      while ((cMatch = callRegex.exec(fnBody)) !== null) {
        const callee = cMatch[1]!;
        const rawArgs = cMatch[2]!;
        if (callee === "if" || callee === "for" || callee === "while" || callee === "catch") continue;

        const callOffset = fnMatch.index + fnMatch[0]!.indexOf(cMatch[0]!);
        const callLine = content.slice(0, callOffset).split("\n").length;
        const at: Provenance = { file: file.path, startLine: callLine, endLine: callLine };

        const args: ArgBinding[] = rawArgs
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
          .map((argExpression) => ({ argExpression }));

        const isDynamic = callee.includes("[") || callee.includes("(");
        const toFact: Fact<SymbolRef> = isDynamic
          ? unknown({ kind: "computed-property", at })
          : confirmed({ file: file.path, name: callee, line: callLine }, [at]);

        g.add({ from: fromSym, to: toFact, at, args });
      }
    }
  }

  return g;
}
