// ─── L5: User Flow Modeling ──────────────────────────────────────────────────
// Matches code to finite state flow templates (upload, login, delete, checkout)
// and identifies missing stages with evidence chains.
// ─────────────────────────────────────────────────────────────────────────────

import type { Provenance } from "../facts/fact.js";

export interface FlowTemplate {
  stages: string[];
  optional?: string[];
}

export const FLOW_TEMPLATES: Record<string, FlowTemplate> = {
  upload: {
    stages: ["select", "uploading", "success", "error", "retry"],
    optional: ["cancel"],
  },
  login: {
    stages: ["entry", "submitting", "success", "error"],
    optional: ["locked-or-rate-limited"],
  },
  delete: {
    stages: ["trigger", "confirm", "deleting", "success", "error"],
    optional: ["undo-or-recovery"],
  },
  checkout: {
    stages: ["cart", "address", "payment", "processing", "success", "error", "retry"],
    optional: ["cancel"],
  },
  search: {
    stages: ["input", "loading", "results", "empty", "error"],
    optional: ["recent-searches"],
  },
};

export interface FlowInstance {
  template: string;
  name: string;
  file: string;
  line: number;
  stagesFound: string[];
  stagesMissing: string[];
  at: Provenance;
}

export function detectFlowsInFile(filePath: string, content: string): FlowInstance[] {
  const flows: FlowInstance[] = [];

  // 1. Detect Upload Flow (type="file" or input with accept or handleUpload/dropzone)
  const isUploadFlow =
    /type\s*=\s*['"`]file['"`]|useDropzone|handleUpload|upload(?:File|Attachment|Image)|FormData/i.test(
      content
    );

  if (isUploadFlow) {
    const stagesFound: string[] = [];

    // Stage: select
    if (/type\s*=\s*['"`]file['"`]|useDropzone|onDrop|onChange/i.test(content)) {
      stagesFound.push("select");
    }

    // Stage: uploading / progress
    if (/uploading|progress|isUploading|uploadProgress|status\s*===\s*['"`]uploading['"`]/i.test(content)) {
      stagesFound.push("uploading");
    }

    // Stage: success
    if (/uploadSuccess|uploaded|success|toast\.success|uploadedUrl/i.test(content)) {
      stagesFound.push("success");
    }

    // Stage: error
    if (/uploadError|onError|catch\s*\(|isError|errorMessage|uploadFailed/i.test(content)) {
      stagesFound.push("error");
    }

    // Stage: retry
    if (/retry|onRetry|handleRetry|tryAgain|re-upload/i.test(content)) {
      stagesFound.push("retry");
    }

    const template = FLOW_TEMPLATES.upload!;
    const stagesMissing = template.stages.filter(
      (s) => !stagesFound.includes(s) && !(template.optional || []).includes(s)
    );

    flows.push({
      template: "upload",
      name: "File Upload Flow",
      file: filePath,
      line: 1,
      stagesFound,
      stagesMissing,
      at: { file: filePath, startLine: 1, endLine: 1 },
    });
  }

  // 2. Detect Delete Flow
  const isDeleteFlow =
    /handleDelete|confirmDelete|onDelete|destructive|trash|remove(?:Item|User|Record)/i.test(
      content
    ) && /<button|<Button|onClick/i.test(content);

  if (isDeleteFlow) {
    const stagesFound: string[] = ["trigger"];

    if (/confirm\(|AlertDialog|Dialog|ConfirmModal|confirmDelete|are you sure/i.test(content)) {
      stagesFound.push("confirm");
    }
    if (/deleting|isDeleting|isPending|pending/i.test(content)) {
      stagesFound.push("deleting");
    }
    if (/deleted|success|toast\.success/i.test(content)) {
      stagesFound.push("success");
    }
    if (/deleteError|onError|catch\s*\(|isError/i.test(content)) {
      stagesFound.push("error");
    }

    const template = FLOW_TEMPLATES.delete!;
    const stagesMissing = template.stages.filter(
      (s) => !stagesFound.includes(s) && !(template.optional || []).includes(s)
    );

    flows.push({
      template: "delete",
      name: "Destructive Action Flow",
      file: filePath,
      line: 1,
      stagesFound,
      stagesMissing,
      at: { file: filePath, startLine: 1, endLine: 1 },
    });
  }

  return flows;
}
