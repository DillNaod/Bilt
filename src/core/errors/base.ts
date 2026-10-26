// ─── Base Bilt Error ──────────────────────────────────────────────────────────
// Canonical root error for all domain-specific Bilt failures.
// Guarantees:
// - Stable error code identification
// - Preserves root cause and nested stack traces
// - Automatic universal secret redaction on messages and context
// - Safe serialization for machine/agent consumers
// ─────────────────────────────────────────────────────────────────────────────

import { redactKnownSecrets } from "../safety/sanitizer.js";
import { sanitizeLogValue } from "../logging/logger.js";

export interface BiltErrorOptions {
  code?: string;
  exitCode?: number;
  cause?: unknown;
  context?: Record<string, unknown>;
}

export class BiltError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly context: Record<string, unknown>;
  readonly isBiltError = true;

  constructor(message: string, options: BiltErrorOptions = {}) {
    super(redactKnownSecrets(message));
    this.name = "BiltError";
    this.code = options.code ?? "ERR_BILT";
    this.exitCode = options.exitCode ?? 1;
    this.context = options.context
      ? (sanitizeLogValue(options.context) as Record<string, unknown>)
      : {};

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }

    // Maintain standard prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Human-safe diagnostic representation without sensitive tokens.
   */
  public formatDiagnostic(): string {
    const parts = [`[${this.code}] ${this.message}`];
    if (Object.keys(this.context).length > 0) {
      parts.push(`Context: ${JSON.stringify(this.context)}`);
    }
    if (this.cause instanceof Error) {
      parts.push(`Caused by: [${this.cause.name}] ${redactKnownSecrets(this.cause.message)}`);
    } else if (this.cause !== undefined) {
      parts.push(`Caused by: ${redactKnownSecrets(String(this.cause))}`);
    }
    return parts.join("\n  ");
  }

  /**
   * Machine-safe serialization for Agent Protocol and JSON reporters.
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      exitCode: this.exitCode,
      context: this.context,
      cause: this.cause instanceof Error
        ? {
            name: this.cause.name,
            message: redactKnownSecrets(this.cause.message),
            code: (this.cause as any).code,
          }
        : this.cause !== undefined
        ? redactKnownSecrets(String(this.cause))
        : undefined,
    };
  }
}
