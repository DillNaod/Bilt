// ─── UX State Completeness Rules ─────────────────────────────────────────────
// Structural rules for detecting incomplete UX state machines in user flows and
// data components. Evidence-based: facts collected first, rules evaluated second.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { Finding, PrecisionTier } from "../../finding/types.js";
import type { RegisteredRule, RuleFinding } from "../../rule-registry/types.js";

// ---------------------------------------------------------------------------
// Ambient model types – populated by the analysis pipeline. We use `any`
// accessors deliberately; actual shape is enforced by the extractor layer.
// ---------------------------------------------------------------------------

type FlowType =
  | "upload"
  | "delete"
  | "form"
  | "login"
  | "signup"
  | "checkout"
  | string;

interface UserFlowModel {
  id: string;
  type: FlowType;
  name: string;
  /** State labels present in the flow (e.g. 'loading', 'error', 'success') */
  states: string[];
  /** Files / lines where the flow entry points were detected */
  entryLocations: Array<{ file: string; line: number }>;
}

interface ComponentModel {
  name: string;
  file: string;
  line: number;
  isDataDisplay?: boolean;
  hasLoadingState?: boolean;
  hasEmptyState?: boolean;
  hasErrorState?: boolean;
  rawText: string;
  interactiveElements?: InteractiveElementModel[];
}

interface InteractiveElementModel {
  type: string;
  isDestructive?: boolean;
  hasConfirmation?: boolean;
  text?: string;
  file: string;
  line: number;
}

interface RouteModel {
  path: string;
  file: string;
  requiresAuth?: boolean;
  isApiRoute?: boolean;
}

interface AnalysisModel {
  userFlows?: UserFlowModel[];
  components?: ComponentModel[];
  routes?: RouteModel[];
  navigation?: unknown;
  apiEndpoints?: unknown[];
  auth?: { hasAuthentication?: boolean };
  /** True when no application routes exist (static landing page only) */
  isStaticOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Helper: generate deterministic fingerprints
// ---------------------------------------------------------------------------

function fingerprint(ruleId: string, ...parts: Array<string | number>): string {
  const hash = crypto.createHash("sha256");
  hash.update(ruleId);
  for (const part of parts) {
    hash.update(`:${part}`);
  }
  return hash.digest("hex");
}

// ---------------------------------------------------------------------------
// REQUIRED_STATES per flow type
// ---------------------------------------------------------------------------

const REQUIRED_STATES: Record<FlowType, string[]> = {
  upload: ["entry", "loading", "success", "error"],
  delete: ["entry", "confirmation", "loading", "success"],
  form: ["entry", "validation-error", "loading", "success", "error"],
  login: ["entry", "loading", "error", "success"],
  signup: ["entry", "validation-error", "loading", "error", "success"],
  checkout: ["entry", "loading", "success", "error"],
};

/** Flow types whose missing error states escalate to 'critical' severity */
const HIGH_SEVERITY_FLOWS = new Set<FlowType>(["login", "signup", "checkout"]);

/**
 * RULE UX-STATE-010: Flow Missing Critical States
 *
 * For each user flow, check that all expected states are present.
 * Missing states are reported with concrete evidence about which flow
 * and which states are absent.
 *
 * Precision: medium (state detection is heuristic)
 */
export function detectFlowMissingCriticalStates(model: AnalysisModel): Finding[] {
  const findings: Finding[] = [];

  // Guard: do not fire for static landing-page-only projects
  if (model.isStaticOnly) return findings;

  const flows = model.userFlows ?? [];
  if (flows.length === 0) return findings;

  for (const flow of flows) {
    const flowType = ((flow as any).type || (flow as any).name) as FlowType;
    const required = REQUIRED_STATES[flowType];
    if (!required) continue; // unknown flow type – skip

    const rawStates = (flow as any).states || (flow as any).detectedStates || [];
    const presentStates = new Set(
      rawStates.map((s: any) => (typeof s === "string" ? s : s.name).toLowerCase())
    );
    const missingStates = required.filter((s) => !presentStates.has(s));
    if (missingStates.length === 0) continue;

    // Severity escalation: login/signup/checkout missing error states → high
    const missingErrorRelated = missingStates.filter(
      (s) => s === "error" || s === "validation-error"
    );
    const isHighSeverity =
      HIGH_SEVERITY_FLOWS.has(flowType) && missingErrorRelated.length > 0;

    const locs: any[] = (flow as any).entryLocations || (flow as any).entryPoints || [];
    const primaryLoc = locs[0];
    const locationList = locs
      .map((l: any) => `${l.file}:${l.line ?? 1}`)
      .join(", ");

    findings.push({
      rule_id: "UX-STATE-010",
      fingerprint: fingerprint("UX-STATE-010", flow.id, missingStates.join(",")),
      severity: isHighSeverity ? "critical" : "warning",
      precision: "medium" as PrecisionTier,
      maturity: "experimental",
      category: "ux-completeness",
      file: primaryLoc?.file ?? "",
      line: primaryLoc?.line ?? 1,
      end_line: primaryLoc?.line ?? 1,
      title: `${flowType} flow "${(flow as any).name || flowType}" is missing critical states`,
      explanation: [
        `The "${(flow as any).name || flowType}" ${flowType} flow is missing the following required states: ${missingStates.join(", ")}.`,
        `Expected states for a ${flowType} flow: ${required.join(", ")}.`,
        `States currently detected: ${rawStates.length > 0 ? Array.from(presentStates).join(", ") : "(none)"}.`,
        `Flow entry points found at: ${locationList}.`,
      ].join(" "),
      agent_action: `Add the missing ${flowType} states (${missingStates.join(", ")}) to the flow. Each state should have a dedicated UI rendering branch and appropriate user feedback.`,
      fixable: false,
    });
  }

  return findings;
}

/**
 * RULE UX-STATE-011: Data Component Missing State Machine
 *
 * Data-display components (tables, lists, feeds) must handle loading,
 * empty, and error states. Report if two or more of the three are absent.
 *
 * Precision: medium
 */
export function detectDataComponentMissingStateMachine(model: AnalysisModel): Finding[] {
  const findings: Finding[] = [];

  const components = model.components ?? [];

  for (const comp of components) {
    if (!comp.isDataDisplay) continue;

    const missingStates: string[] = [];
    if (!comp.hasLoadingState) missingStates.push("loading");
    if (!comp.hasEmptyState) missingStates.push("empty");
    if (!comp.hasErrorState) missingStates.push("error");

    // Only report when at least two of the three are missing
    if (missingStates.length < 2) continue;

    findings.push({
      rule_id: "UX-STATE-011",
      fingerprint: fingerprint("UX-STATE-011", comp.file, comp.name),
      severity: "warning",
      precision: "medium" as PrecisionTier,
      maturity: "experimental",
      category: "ux-completeness",
      file: comp.file,
      line: comp.line,
      end_line: comp.line,
      title: `Data component "${comp.name}" is missing state machine`,
      explanation: [
        `Component "${comp.name}" (${comp.file}:${comp.line}) renders data but is missing the following UI states: ${missingStates.join(", ")}.`,
        `Data-display components (tables, lists, feeds) must handle all three of: loading, empty, and error states.`,
        `Without these states, users may see blank screens, stale content, or confusing silent failures.`,
      ].join(" "),
      agent_action: `Add ${missingStates.join(", ")} state handling to "${comp.name}". Use conditional rendering or a state machine hook (e.g. React Query status, SWR, or a local isLoading/error state).`,
      fixable: false,
    });
  }

  return findings;
}

/**
 * RULE UX-STATE-012: Destructive Action Without Confirmation
 *
 * Detects destructive interactive elements (delete buttons, clear actions)
 * that do not have a confirmation step. Uses structured InteractiveElementModel.
 *
 * Precision: high (structured model — not heuristic text matching)
 */
export function detectDestructiveActionWithoutConfirmation(model: AnalysisModel): Finding[] {
  const findings: Finding[] = [];

  const components = model.components ?? [];

  for (const comp of components) {
    const elements = comp.interactiveElements ?? [];
    for (const el of elements) {
      if (!el.isDestructive) continue;
      if (el.hasConfirmation) continue;

      findings.push({
        rule_id: "UX-STATE-012",
        fingerprint: fingerprint("UX-STATE-012", el.file, String(el.line), el.text ?? ""),
        severity: "warning",
        precision: "high" as PrecisionTier,
        maturity: "stable",
        category: "ux-completeness",
        file: el.file,
        line: el.line,
        end_line: el.line,
        title: `Destructive action "${el.text ?? "unknown"}" lacks confirmation`,
        explanation: [
          `Interactive element "${el.text ?? "(no label)"}" at ${el.file}:${el.line} is marked as destructive but has no confirmation dialog or undo mechanism.`,
          `Destructive actions (delete, remove, clear, reset) must require explicit user confirmation to prevent accidental data loss.`,
        ].join(" "),
        agent_action: `Wrap the destructive action at ${el.file}:${el.line} with a confirmation dialog (e.g. "Are you sure?") or provide an undo mechanism before the operation executes.`,
        fixable: false,
      });
    }
  }

  return findings;
}

/**
 * RULE UX-STATE-013: Permission-Denied State Missing
 *
 * When the application has authentication AND protected routes, at least
 * one component should handle the authenticated-but-unauthorized case (403).
 *
 * Precision: medium
 */
export function detectPermissionDeniedStateMissing(model: AnalysisModel): Finding[] {
  const findings: Finding[] = [];

  const hasAuth = model.auth?.hasAuthentication === true;
  if (!hasAuth) return findings;

  const routes = model.routes ?? [];
  const protectedRoutes = routes.filter((r) => r.requiresAuth && !r.isApiRoute);
  if (protectedRoutes.length === 0) return findings;

  // Check any component for permission-denied handling signals
  const PERMISSION_DENIED_PATTERNS = [
    /403/,
    /forbidden/i,
    /unauthorized/i,
    /permission/i,
    /access.?denied/i,
  ];

  const components = model.components ?? [];
  const hasPermissionDeniedComponent = components.some((comp) =>
    PERMISSION_DENIED_PATTERNS.some((pat) => pat.test(comp.rawText))
  );

  if (hasPermissionDeniedComponent) return findings;

  // Report: no component handles the 403/forbidden case
  const sampleRoute = protectedRoutes[0]!;

  findings.push({
    rule_id: "UX-STATE-013",
    fingerprint: fingerprint("UX-STATE-013", "no-permission-denied-state"),
    severity: "warning",
    precision: "medium" as PrecisionTier,
    maturity: "experimental",
    category: "ux-completeness",
    file: sampleRoute.file,
    line: 1,
    end_line: 1,
    title: "No permission-denied (403) state found for protected routes",
    explanation: [
      `The application has authentication and ${protectedRoutes.length} protected route(s) (e.g. "${sampleRoute.path}"),`,
      `but no component was found that handles the "authenticated but unauthorized" (403/forbidden) case.`,
      `Without a permission-denied state, users who lack access will see unexpected blank screens or generic errors.`,
      `Look for: 403 status handling, a Forbidden component, or access-denied copy in your route guards.`,
    ].join(" "),
    agent_action: `Create a dedicated permission-denied UI state or component. Render it when an authenticated user attempts to access a resource they are not authorized for (HTTP 403). Include a clear message and a link back to safety.`,
    fixable: false,
  });

  return findings;
}

// ---------------------------------------------------------------------------
// Aggregated export
// ---------------------------------------------------------------------------

export const uxStateRules = {
  "UX-STATE-010": detectFlowMissingCriticalStates,
  "UX-STATE-011": detectDataComponentMissingStateMachine,
  "UX-STATE-012": detectDestructiveActionWithoutConfirmation,
  "UX-STATE-013": detectPermissionDeniedStateMissing,
} as const;

export function runUXStateRules(model: AnalysisModel): Finding[] {
  return [
    ...detectFlowMissingCriticalStates(model),
    ...detectDataComponentMissingStateMachine(model),
    ...detectDestructiveActionWithoutConfirmation(model),
    ...detectPermissionDeniedStateMissing(model),
  ];
}

function findingToRuleFinding(f: Finding): RuleFinding {
  return {
    ruleId: f.rule_id,
    title: f.title,
    severity: f.severity === "critical" ? "critical" : f.severity === "warning" ? "medium" : "low",
    precision: f.precision,
    maturity: f.maturity,
    category: "ux-states",
    evidence: [f.explanation],
    locations: [{ file: f.file, line: f.line, endLine: f.end_line }],
    agentObjective: f.agent_action,
    description: f.explanation,
    recommendation: f.agent_action,
    file: f.file,
    line: f.line,
    endLine: f.end_line,
    fingerprint: f.fingerprint,
    fixable: f.fixable,
  };
}

export const uxState010: RegisteredRule = {
  id: "UX-STATE-010",
  category: "ux-states",
  title: "Critical User Flow Missing Required States",
  severity: "high",
  precision: "medium",
  maturity: "stable",
  detect(model: any) {
    return detectFlowMissingCriticalStates(model).map(findingToRuleFinding);
  },
};

export const uxState011: RegisteredRule = {
  id: "UX-STATE-011",
  category: "ux-states",
  title: "Data Component Missing State Machine",
  severity: "medium",
  precision: "high",
  maturity: "stable",
  detect(model: any) {
    return detectDataComponentMissingStateMachine(model).map(findingToRuleFinding);
  },
};

export const uxState012: RegisteredRule = {
  id: "UX-STATE-012",
  category: "ux-states",
  title: "Destructive Action Lacks Confirmation Dialog",
  severity: "high",
  precision: "high",
  maturity: "stable",
  detect(model: any) {
    return detectDestructiveActionWithoutConfirmation(model).map(findingToRuleFinding);
  },
};

export const uxState013: RegisteredRule = {
  id: "UX-STATE-013",
  category: "ux-states",
  title: "Missing Permission-Denied (403) State",
  severity: "medium",
  precision: "medium",
  maturity: "stable",
  detect(model: any) {
    return detectPermissionDeniedStateMissing(model).map(findingToRuleFinding);
  },
};

