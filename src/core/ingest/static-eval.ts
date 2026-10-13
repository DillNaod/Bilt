// ─── L0: Static Config Evaluator ──────────────────────────────────────────────
// Parses configuration files (tailwind.config.js, next.config.js, etc.) via AST
// and evaluates purely literal values, object spreads, and allowlisted pure calls.
// NEVER executes untrusted repository code (no eval, no require, no import).
// ─────────────────────────────────────────────────────────────────────────────

import { parse } from "@babel/parser";
import path from "node:path";

export type Evaluated =
  | { ok: true; value: unknown }
  | {
      ok: false;
      reason: "dynamic-call" | "unresolved-identifier" | "unsupported-node" | "parse-error";
    };

const PURE_CALLS = new Set([
  "path.join",
  "path.resolve",
  "join",
  "resolve",
]);

export function evalNode(node: any, scope: Map<string, Evaluated>): Evaluated {
  if (!node) return { ok: false, reason: "unsupported-node" };

  // String literals
  if (node.type === "StringLiteral") {
    return { ok: true, value: node.value };
  }

  // Numeric literals
  if (node.type === "NumericLiteral") {
    return { ok: true, value: node.value };
  }

  // Boolean literals
  if (node.type === "BooleanLiteral") {
    return { ok: true, value: node.value };
  }

  // Null literal
  if (node.type === "NullLiteral") {
    return { ok: true, value: null };
  }

  // Template literal with no or evaluatable expressions
  if (node.type === "TemplateLiteral") {
    let result = "";
    for (let i = 0; i < node.quasis.length; i++) {
      result += node.quasis[i].value.raw;
      if (i < node.expressions.length) {
        const exprVal = evalNode(node.expressions[i], scope);
        if (!exprVal.ok) return exprVal;
        result += String(exprVal.value);
      }
    }
    return { ok: true, value: result };
  }

  // Arrays
  if (node.type === "ArrayExpression") {
    const out: unknown[] = [];
    for (const el of node.elements) {
      if (el?.type === "SpreadElement") {
        const spreadVal = evalNode(el.argument, scope);
        if (!spreadVal.ok || !Array.isArray(spreadVal.value)) return { ok: false, reason: "unsupported-node" };
        out.push(...spreadVal.value);
        continue;
      }
      const r = evalNode(el, scope);
      if (!r.ok) return r;
      out.push(r.value);
    }
    return { ok: true, value: out };
  }

  // Objects
  if (node.type === "ObjectExpression") {
    const obj: Record<string, unknown> = {};
    for (const p of node.properties) {
      if (p.type === "SpreadElement") {
        const spreadVal = evalNode(p.argument, scope);
        if (!spreadVal.ok || typeof spreadVal.value !== "object" || spreadVal.value === null) {
          return { ok: false, reason: "unsupported-node" };
        }
        Object.assign(obj, spreadVal.value);
        continue;
      }

      if (p.type === "ObjectProperty") {
        let keyName: string;
        if (p.key.type === "Identifier" && !p.computed) {
          keyName = p.key.name;
        } else if (p.key.type === "StringLiteral") {
          keyName = p.key.value;
        } else {
          const evalKey = evalNode(p.key, scope);
          if (!evalKey.ok) return evalKey;
          keyName = String(evalKey.value);
        }

        const r = evalNode(p.value, scope);
        if (!r.ok) return r;
        obj[keyName] = r.value;
        continue;
      }

      return { ok: false, reason: "unsupported-node" };
    }
    return { ok: true, value: obj };
  }

  // Identifier lookup
  if (node.type === "Identifier") {
    return scope.get(node.name) ?? { ok: false, reason: "unresolved-identifier" };
  }

  // MemberExpression property lookup (e.g. obj.key)
  if (node.type === "MemberExpression") {
    const objVal = evalNode(node.object, scope);
    if (!objVal.ok || typeof objVal.value !== "object" || objVal.value === null) {
      return { ok: false, reason: "unsupported-node" };
    }
    const propName = node.property.type === "Identifier" && !node.computed ? node.property.name : (evalNode(node.property, scope) as any).value;
    if (propName !== undefined && propName in (objVal.value as any)) {
      return { ok: true, value: (objVal.value as any)[propName] };
    }
    return { ok: false, reason: "unresolved-identifier" };
  }

  // CallExpression for pure functions (path.join, path.resolve)
  if (node.type === "CallExpression") {
    let callName = "";
    if (node.callee.type === "Identifier") {
      callName = node.callee.name;
    } else if (
      node.callee.type === "MemberExpression" &&
      node.callee.object.type === "Identifier" &&
      node.callee.property.type === "Identifier"
    ) {
      callName = `${node.callee.object.name}.${node.callee.property.name}`;
    }

    if (PURE_CALLS.has(callName)) {
      const evaluatedArgs: string[] = [];
      for (const arg of node.arguments) {
        const ev = evalNode(arg, scope);
        if (!ev.ok) return ev;
        evaluatedArgs.push(String(ev.value));
      }

      if (callName === "path.join" || callName === "join") {
        return { ok: true, value: path.posix.join(...evaluatedArgs) };
      }
      if (callName === "path.resolve" || callName === "resolve") {
        return { ok: true, value: path.posix.resolve("/", ...evaluatedArgs) };
      }
    }

    return { ok: false, reason: "dynamic-call" };
  }

  return { ok: false, reason: "unsupported-node" };
}

/**
 * Safely evaluates a JS/TS configuration file without code execution.
 * Extracts `module.exports = ...` or `export default ...`.
 */
export function evaluateConfigFile(code: string): Evaluated {
  try {
    const ast = parse(code, {
      sourceType: "unambiguous",
      plugins: ["typescript", "jsx"],
    });

    const scope = new Map<string, Evaluated>();

    // Pass 1: collect top-level const/let declarations
    for (const stmt of ast.program.body) {
      if (stmt.type === "VariableDeclaration") {
        for (const decl of stmt.declarations) {
          if (decl.id.type === "Identifier" && decl.init) {
            const val = evalNode(decl.init, scope);
            scope.set(decl.id.name, val);
          }
        }
      }
    }

    // Pass 2: find export default or module.exports
    for (const stmt of ast.program.body) {
      // export default ...
      if (stmt.type === "ExportDefaultDeclaration") {
        return evalNode(stmt.declaration, scope);
      }

      // module.exports = ...
      if (
        stmt.type === "ExpressionStatement" &&
        stmt.expression.type === "AssignmentExpression" &&
        stmt.expression.left.type === "MemberExpression"
      ) {
        const left = stmt.expression.left;
        if (
          left.object.type === "Identifier" &&
          left.object.name === "module" &&
          left.property.type === "Identifier" &&
          left.property.name === "exports"
        ) {
          return evalNode(stmt.expression.right, scope);
        }
      }
    }

    return { ok: false, reason: "unsupported-node" };
  } catch {
    return { ok: false, reason: "parse-error" };
  }
}

import { readFile } from "node:fs/promises";
import { confirmed, unknown, type Fact } from "../facts/fact.js";

/**
 * Statically evaluates a configuration file without executing any code.
 */
export async function staticEvalConfig(filePath: string): Promise<Fact<any>> {
  try {
    const content = await readFile(filePath, "utf8");
    const evaluated = evaluateConfigFile(content);
    if (evaluated.ok) {
      return confirmed(evaluated.value, [{ file: filePath }]);
    }
    return unknown({
      kind: `static-eval-${evaluated.reason}`,
      at: { file: filePath },
    });
  } catch (err: any) {
    return unknown({
      kind: "config-unreadable",
      at: { file: filePath },
    });
  }
}

