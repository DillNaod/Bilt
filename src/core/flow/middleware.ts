// ─── L4: Middleware Chain & Dominance Analysis ────────────────────────────────
// Analyzes authentication and authorization guards, verifying whether checks
// dominate subsequent sensitive effects (e.g. database reads or mutations).
// ─────────────────────────────────────────────────────────────────────────────

import type { RouteModel, MiddlewareRef } from "../model/project-model.js";
import type { Fact, Provenance } from "../facts/fact.js";
import { confirmed, unknown, absent } from "../facts/fact.js";

export interface GuardEvidence {
  kind: "authn" | "authz-role" | "authz-ownership" | "authz-tenant" | "authz-policy";
  at: Provenance;
  dominatesAccess: boolean;
  checksSubject: string[];
}

export function guardsFor(route: RouteModel): Fact<GuardEvidence[]> {
  if (route.middlewareChain.state === "unknown") {
    return unknown({
      kind: "unresolved-middleware",
      name: "chain",
      at: route.source,
    });
  }

  const guards: GuardEvidence[] = [];
  const chain: MiddlewareRef[] = route.middlewareChain.state === "confirmed" ? route.middlewareChain.value : [];

  for (const mw of chain) {
    const name = mw.name.toLowerCase();
    const prov: Provenance = mw.ref
      ? { file: mw.ref.file, startLine: mw.ref.line || 1, endLine: mw.ref.line || 1 }
      : route.source;

    if (name.includes("role") || name.includes("admin")) {
      guards.push({
        kind: "authz-role",
        at: prov,
        dominatesAccess: mw.dominatesEffects ?? true,
        checksSubject: ["user.role"],
      });
    } else if (name.includes("owner") || name.includes("ownership")) {
      guards.push({
        kind: "authz-ownership",
        at: prov,
        dominatesAccess: mw.dominatesEffects ?? true,
        checksSubject: ["user.id", "resource.ownerId"],
      });
    } else if (name.includes("tenant") || name.includes("org")) {
      guards.push({
        kind: "authz-tenant",
        at: prov,
        dominatesAccess: mw.dominatesEffects ?? true,
        checksSubject: ["user.orgId"],
      });
    } else if (name.includes("auth") || name.includes("jwt") || name.includes("session")) {
      guards.push({
        kind: "authn",
        at: prov,
        dominatesAccess: mw.dominatesEffects ?? true,
        checksSubject: ["req.user"],
      });
    }
  }

  return confirmed(guards, [route.source]);
}
