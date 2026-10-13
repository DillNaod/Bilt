// ─── L5: UX State Model ──────────────────────────────────────────────────────
// Analyzes async data sources and records which UX states (loading, empty, error,
// retry, disabled, etc.) are handled vs missing.
// ─────────────────────────────────────────────────────────────────────────────

import type { Provenance } from "../facts/fact.js";

export type UXState =
  | "loading"
  | "empty"
  | "error"
  | "success"
  | "disabled"
  | "denied"
  | "offline"
  | "validation"
  | "partial"
  | "retry"
  | "confirm-destructive";

export interface DataSourceRef {
  kind: "query" | "mutation" | "fetch" | "server-action";
  name?: string;
  cardinality?: "item" | "list";
  statusFlags: string[];
  destructive?: boolean;
  requiresPermission?: boolean;
  at: Provenance;
}

export interface UXStateModel {
  component: string;
  file: string;
  line: number;
  dataSource?: DataSourceRef;
  handledStates: UXState[];
  requiredStates: UXState[];
  missingStates: UXState[];
}

export function analyzeUXStates(
  componentName: string,
  filePath: string,
  content: string,
  line: number = 1
): UXStateModel | null {
  // Detect if component uses an async data source (useQuery, fetch, useMutation, server action)
  const hasQuery = /useQuery|useSWR|useSuspenseQuery|fetch\s*\(|axios\./i.test(content);
  const hasMutation = /useMutation|onSubmit|handleUpload|handleDelete|handleSubmit/i.test(content);
  const isDataDisplay = /data\.(?:map|filter)|items\.(?:map|filter)|table|grid/i.test(content);

  if (!hasQuery && !hasMutation && !isDataDisplay) {
    return null;
  }

  const isList = /data\.map|items\.map|records\.map|\.map\s*\(/i.test(content);
  const isDestructive = /delete|remove|destroy|trash|purge/i.test(content);

  const dataSource: DataSourceRef = {
    kind: hasMutation ? "mutation" : "query",
    name: componentName,
    cardinality: isList ? "list" : "item",
    statusFlags: ["isLoading", "isPending", "error", "isError"],
    destructive: isDestructive,
    at: { file: filePath, startLine: line, endLine: line },
  };

  const handled: UXState[] = [];

  // 1. Loading
  if (
    /isLoading|isPending|\.loading\b|loading\s*===|Skeleton|Spinner|<Loading|loading\.\.\./i.test(
      content
    )
  ) {
    handled.push("loading");
  }

  // 2. Error
  if (
    /isError|error|hasError|onError|catch\s*\(|<Error|error\.message|alert-destructive/i.test(
      content
    )
  ) {
    handled.push("error");
  }

  // 3. Empty (for collections/lists)
  if (
    /length\s*===\s*0|!data\s*\|\||!items\s*\|\||EmptyState|<Empty|no\s+(?:items|data|records)\s+found/i.test(
      content
    )
  ) {
    handled.push("empty");
  }

  // 4. Success
  if (/isSuccess|onSuccess|success|<Success|toast\.success/i.test(content)) {
    handled.push("success");
  }

  // 5. Retry
  if (/refetch|onRetry|retry|<button[^>]*>.*(?:retry|try again)/i.test(content)) {
    handled.push("retry");
  }

  // 6. Disabled
  if (/disabled\s*=\s*\{|disabled:\s*(?:isPending|isLoading|loading)/i.test(content)) {
    handled.push("disabled");
  }

  // 7. Confirm-destructive
  if (isDestructive && /confirm\(|AlertDialog|Dialog|ConfirmModal|confirmDelete/i.test(content)) {
    handled.push("confirm-destructive");
  }

  // Compute required states
  const required: UXState[] = ["loading", "error"];
  if (isList) required.push("empty");
  if (hasMutation) required.push("disabled");
  if (isDestructive) required.push("confirm-destructive");

  const missing = required.filter((req) => !handled.includes(req));

  return {
    component: componentName,
    file: filePath,
    line,
    dataSource,
    handledStates: handled,
    requiredStates: required,
    missingStates: missing,
  };
}
