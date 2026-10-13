// ─── L4: ApiSecurityModel Builder ─────────────────────────────────────────────
// Synthesizes authentication, authorization, validation, and dataflow into a
// machine-checkable security fact per endpoint.
// ─────────────────────────────────────────────────────────────────────────────

import type { ApiEndpointModel, ApiSecurityModel, RouteModel } from "../model/project-model.js";
import type { Fact, Provenance } from "../facts/fact.js";
import { confirmed, absent, unknown } from "../facts/fact.js";
import { guardsFor } from "./middleware.js";
import type { FlowPath } from "./taint.js";

export function buildApiSecurityModel(
  endpoint: ApiEndpointModel,
  route: RouteModel,
  taintPaths: FlowPath[]
): Fact<ApiSecurityModel> {
  const guardsFact = guardsFor(route);
  if (guardsFact.state === "unknown") {
    return unknown({
      kind: "unresolved-middleware",
      name: "securityModel",
      at: { file: endpoint.file, startLine: endpoint.line, endLine: endpoint.line },
    });
  }

  const guards = guardsFact.state === "confirmed" ? guardsFact.value : [];
  const authnGuard = guards.find((g) => g.kind === "authn");
  const ownershipGuard = guards.find((g) => g.kind === "authz-ownership");

  const hasAuth: Fact<boolean> = authnGuard
    ? confirmed<boolean>(true, [authnGuard.at])
    : route.isPublic.state === "confirmed" && route.isPublic.value === false
    ? confirmed<boolean>(true, [route.source])
    : absent<boolean>([{ file: endpoint.file, line: endpoint.line }]);

  const hasOwnershipCheck: Fact<boolean> = ownershipGuard
    ? confirmed<boolean>(true, [ownershipGuard.at])
    : absent<boolean>([{ file: endpoint.file, line: endpoint.line }]);

  // Check taint flows reaching this endpoint's file
  const relevantTaint = taintPaths.filter((p) => p.source.at.file === endpoint.file);
  const validated = relevantTaint.some((p) => p.sanitizers.some((s) => s.kind === "schema-validate"));
  const hasInputValidation: Fact<boolean> = validated
    ? confirmed<boolean>(true, [{ file: endpoint.file, startLine: endpoint.line, endLine: endpoint.line }])
    : absent<boolean>([{ file: endpoint.file, line: endpoint.line }]);

  const passesBodyToDb = relevantTaint.some(
    (p) => p.source.kind === "req.body" && p.sink.kind === "orm-write" && p.sanitizers.length === 0
  );

  const model: ApiSecurityModel = {
    endpoint,
    hasAuth,
    hasOwnershipCheck,
    hasInputValidation,
    passesBodyToDb,
    sensitiveFieldsReturned: [],
  };

  return confirmed(model, [{ file: endpoint.file, startLine: endpoint.line, endLine: endpoint.line }]);
}
