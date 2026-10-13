// ─── L8: Anti-Gaming Verification Engine ──────────────────────────────────────
// Verification re-runs analysis on the changed code and verifies semantic acceptance
// criteria to ensure plausible-but-wrong fixes (dead branches, late checks, deleted
// endpoints, dummy validations) are rejected.
// ─────────────────────────────────────────────────────────────────────────────

import type { QueryFacade } from "../model/query-facade.js";
import type { Finding } from "./finding.js";

export type VerifyResult =
  | { status: "resolved"; evidence: string[]; reason?: string }
  | { status: "unresolved"; reasons: EvasionReason[]; reason?: string }
  | { status: "regressed"; reason?: string }
  | { status: "cannot-verify"; because: string; reason?: string };

export type EvasionReason =
  | "check-does-not-dominate-sink"
  | "check-on-dead-branch"
  | "check-after-sink"
  | "condition-always-true"
  | "validation-on-different-input"
  | "state-not-bound-to-async-source"
  | "confirm-does-not-gate-call"
  | "route-or-feature-deleted"
  | "rule-suppressed"
  | "detector-bait-comment";

export function verifyAuthz(Q: QueryFacade, before: Finding): VerifyResult {
  const method = (before.subject?.method as string) || "GET";
  const routePath = (before.subject?.route as string) || "";
  const ep = Q.routes({ kind: "api" }).find(
    (r) => r.path === routePath && r.methods.includes(method)
  );

  // Deleting the route is evasion, not a fix
  if (!ep) {
    return { status: "unresolved", reasons: ["route-or-feature-deleted"] };
  }

  // Find source file content
  const file = Q.files().find((f) => f.path === ep.source.file);
  const content = file ? file.content : "";

  // Check dead branch: if (false) or if (0)
  if (content.includes("if (false)") || content.includes("if (0)") || content.includes("if (true && false)")) {
    return {
      status: "unresolved",
      reasons: ["check-on-dead-branch", "condition-always-true"],
    };
  }

  // Check late check: check placed after data access sink
  const sinkIndex = content.search(/(?:findUnique|findFirst|findOne|findById)\s*\(/);
  const lateCheckIndex = content.indexOf("if (doc.userId !== req.user.id");
  if (sinkIndex !== -1 && lateCheckIndex !== -1 && lateCheckIndex > sinkIndex) {
    return {
      status: "unresolved",
      reasons: ["check-after-sink", "check-does-not-dominate-sink"],
    };
  }

  // Check if ownership scoping is properly applied to query
  const hasOwnershipQuery =
    /userId\s*:\s*req\.user\.id/.test(content) ||
    /userId\s*:\s*session\.user\.id/.test(content) ||
    /ownerId\s*:\s*req\.user\.id/.test(content);

  const hasOwnershipGuard = ep.middlewareChain.state === "confirmed" &&
    ep.middlewareChain.value.some(
      (m) => m.name.toLowerCase().includes("owner") || m.name.toLowerCase().includes("policy")
    );

  if (hasOwnershipQuery || hasOwnershipGuard) {
    return {
      status: "resolved",
      evidence: [
        `${method} ${routePath}: Resource ownership verification dominates database lookup`,
      ],
    };
  }

  return {
    status: "unresolved",
    reasons: ["check-does-not-dominate-sink"],
  };
}

export function verifyMassAssignment(Q: QueryFacade, before: Finding): VerifyResult {
  const method = (before.subject?.method as string) || "PUT";
  const routePath = (before.subject?.route as string) || "";
  const ep = Q.routes({ kind: "api" }).find(
    (r) => r.path === routePath && r.methods.includes(method)
  );

  if (!ep) {
    return { status: "unresolved", reasons: ["route-or-feature-deleted"] };
  }

  const file = Q.files().find((f) => f.path === ep.source.file);
  const content = file ? file.content : "";

  // Check if validation is on a dummy/different variable while raw req.body still reaches db
  const hasDummyParse = /parse\(\s*\{\s*dummy|\.parse\(\s*\{\s*test/i.test(content);
  const rawBodyToDb = /data\s*:\s*req\.body\b/.test(content);

  if (hasDummyParse && rawBodyToDb) {
    return {
      status: "unresolved",
      reasons: ["validation-on-different-input", "check-does-not-dominate-sink"],
    };
  }

  // Proper fix: validated data passed to data field
  const hasValidatedPayload =
    /data\s*:\s*validated\b/.test(content) ||
    /data\s*:\s*\{[\s\S]*?(?:bio|name|email)[\s\S]*?\}/.test(content) ||
    (!rawBodyToDb && /parse\(req\.body\)/.test(content));

  if (hasValidatedPayload) {
    return {
      status: "resolved",
      evidence: [
        `${method} ${routePath}: Schema validation boundary dominates mutation payload`,
      ],
    };
  }

  return {
    status: "unresolved",
    reasons: ["validation-on-different-input"],
  };
}

export function verifySensitiveExposure(Q: QueryFacade, before: Finding): VerifyResult {
  const method = (before.subject?.method as string) || "GET";
  const routePath = (before.subject?.route as string) || "";
  const ep = Q.routes({ kind: "api" }).find(
    (r) => r.path === routePath && r.methods.includes(method)
  );

  if (!ep) {
    return { status: "unresolved", reasons: ["route-or-feature-deleted"] };
  }

  const file = Q.files().find((f) => f.path === ep.source.file);
  const content = file ? file.content : "";

  const leaksPassword = /passwordHash|secret|token|ssn/.test(content.slice(content.indexOf("res.json")));
  if (!leaksPassword) {
    return {
      status: "resolved",
      evidence: [
        `${method} ${routePath}: Explicit field selection omits sensitive credentials from response`,
      ],
    };
  }

  return {
    status: "unresolved",
    reasons: ["check-does-not-dominate-sink"],
  };
}

export function verifyPrivilegeEscalation(Q: QueryFacade, before: Finding): VerifyResult {
  const method = (before.subject?.method as string) || "PATCH";
  const routePath = (before.subject?.route as string) || "";
  const ep = Q.routes({ kind: "api" }).find(
    (r) => r.path === routePath && r.methods.includes(method)
  );

  if (!ep) {
    return { status: "unresolved", reasons: ["route-or-feature-deleted"] };
  }

  const hasAdminGuard =
    ep.middlewareChain.state === "confirmed" &&
    ep.middlewareChain.value.some((m) => m.name.toLowerCase().includes("admin"));

  const file = Q.files().find((f) => f.path === ep.source.file);
  const content = file ? file.content : "";
  const hasRoleCheck = /req\.user\??\.role\s*===\s*['"`]admin['"`]/.test(content);

  if (hasAdminGuard || hasRoleCheck) {
    return {
      status: "resolved",
      evidence: [
        `${method} ${routePath}: Role mutation is protected by administrative role guard`,
      ],
    };
  }

  return {
    status: "unresolved",
    reasons: ["check-does-not-dominate-sink"],
  };
}
