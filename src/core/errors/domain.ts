// ─── Domain Error Subclasses ──────────────────────────────────────────────────
// Distinct error domains representing the real failure surfaces of Bilt.
// ─────────────────────────────────────────────────────────────────────────────

import { BiltError, type BiltErrorOptions } from "./base.js";

/**
 * Thrown when input arguments, command options, or flags are missing or invalid.
 */
export class ValidationError extends BiltError {
  constructor(message: string, options?: BiltErrorOptions) {
    super(message, {
      code: "ERR_VALIDATION",
      exitCode: 2,
      ...options,
    });
    this.name = "ValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when `.biltrc.json`, config overrides, or project settings are corrupt or invalid.
 */
export class ConfigurationError extends BiltError {
  constructor(message: string, options?: BiltErrorOptions) {
    super(message, {
      code: "ERR_CONFIGURATION",
      exitCode: 2,
      ...options,
    });
    this.name = "ConfigurationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a file or directory is missing, inaccessible, or path traversal is attempted.
 */
export class FilesystemError extends BiltError {
  constructor(message: string, options?: BiltErrorOptions) {
    super(message, {
      code: "ERR_FILESYSTEM",
      exitCode: 2,
      ...options,
    });
    this.name = "FilesystemError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an engine or scanner pipeline pass encounters a hard execution failure.
 */
export class ScanError extends BiltError {
  constructor(message: string, options?: BiltErrorOptions) {
    super(message, {
      code: "ERR_SCAN",
      exitCode: 1,
      ...options,
    });
    this.name = "ScanError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a specific rule evaluator fails during analysis.
 */
export class RuleError extends BiltError {
  constructor(message: string, options?: BiltErrorOptions & { ruleId?: string }) {
    super(message, {
      code: "ERR_RULE",
      exitCode: 1,
      context: {
        ...(options?.ruleId ? { ruleId: options.ruleId } : {}),
        ...options?.context,
      },
      ...options,
    });
    this.name = "RuleError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when applying a remediation fix, taking a snapshot, or undoing changes fails.
 */
export class RemediationError extends BiltError {
  constructor(message: string, options?: BiltErrorOptions & { snapshotId?: string }) {
    super(message, {
      code: "ERR_REMEDIATION",
      exitCode: 1,
      context: {
        ...(options?.snapshotId ? { snapshotId: options.snapshotId } : {}),
        ...options?.context,
      },
      ...options,
    });
    this.name = "RemediationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an AI provider call (Claude, GPT, Gemini, Ollama) fails or exceeds quotas.
 */
export class AiProviderError extends BiltError {
  constructor(message: string, options?: BiltErrorOptions & { provider?: string; model?: string }) {
    super(message, {
      code: "ERR_AI_PROVIDER",
      exitCode: 1,
      context: {
        ...(options?.provider ? { provider: options.provider } : {}),
        ...(options?.model ? { model: options.model } : {}),
        ...options?.context,
      },
      ...options,
    });
    this.name = "AiProviderError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an anti-tamper inspection detects unauthorized rule suppression or config bypass.
 */
export class TamperError extends BiltError {
  constructor(message: string, options?: BiltErrorOptions) {
    super(message, {
      code: "ERR_TAMPER",
      exitCode: 1,
      ...options,
    });
    this.name = "TamperError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
