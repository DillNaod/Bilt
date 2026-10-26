// ─── Core Logging Subsystem ──────────────────────────────────────────────────
// Deterministic, structured diagnostic logger for Bilt internals.
// Features:
// - Hierarchical child/context loggers with inherited namespaces & context
// - Strongly typed context fields: command, operation, ruleId, sessionId, projectRoot, duration, errorCode
// - Universal secret & sensitive credential redaction across messages, contexts, and error stacks
// - High-performance debug gating (zero string formatting / object cloning when disabled)
// - Machine-safe diagnostic separation (stderr routing, custom sinks for testing)
// ─────────────────────────────────────────────────────────────────────────────

import { redactKnownSecrets } from "../safety/sanitizer.js";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface LogContext {
  command?: string;
  operation?: string;
  ruleId?: string;
  sessionId?: string;
  projectRoot?: string;
  duration?: number;
  errorCode?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  namespace?: string;
  message: string;
  context?: LogContext;
  args: unknown[];
  timestamp: number;
}

export type LogSink = (entry: LogEntry) => void;

export const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function resolveDefaultLogLevel(): LogLevel {
  if (
    process.env.BILT_DEBUG === "1" ||
    process.env.BILT_DEBUG === "true" ||
    process.env["DEBUG"] === "1" ||
    process.env["DEBUG"] === "true"
  ) {
    return "debug";
  }
  const envLevel = process.env.BILT_LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVEL_SEVERITY) {
    return envLevel as LogLevel;
  }
  return "warn";
}

const SENSITIVE_KEY_PATTERN = /^(password|secret|token|api_?key|auth|bearer|credential|private_?key)/i;

/**
 * Deeply scrub sensitive keys and secret patterns from strings, errors, objects, and arrays.
 */
export function sanitizeLogValue(val: unknown, seen = new WeakSet<object>()): unknown {
  if (val === null || val === undefined) {
    return val;
  }

  if (typeof val === "string") {
    return redactKnownSecrets(val);
  }

  if (typeof val === "number" || typeof val === "boolean" || typeof val === "bigint") {
    return val;
  }

  if (val instanceof Error) {
    const errorObj: Record<string, unknown> = {
      name: val.name,
      message: redactKnownSecrets(val.message),
    };
    if ("code" in val && (val as any).code) {
      errorObj.code = (val as any).code;
    }
    if (val.stack) {
      errorObj.stack = redactKnownSecrets(val.stack);
    }
    if ("cause" in val && (val as any).cause !== undefined) {
      errorObj.cause = sanitizeLogValue((val as any).cause, seen);
    }
    return errorObj;
  }

  if (typeof val === "object") {
    if (seen.has(val)) {
      return "[Circular]";
    }
    seen.add(val);

    if (Array.isArray(val)) {
      return val.map((item) => sanitizeLogValue(item, seen));
    }

    const scrubbed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      if (SENSITIVE_KEY_PATTERN.test(k) && typeof v === "string") {
        scrubbed[k] = "[REDACTED]";
      } else {
        scrubbed[k] = sanitizeLogValue(v, seen);
      }
    }
    return scrubbed;
  }

  return redactKnownSecrets(String(val));
}

export interface LoggerOptions {
  level?: LogLevel;
  namespace?: string;
  context?: LogContext;
  sink?: LogSink;
}

export class Logger {
  private level: LogLevel;
  private namespace?: string;
  private context: LogContext;
  private customSink?: LogSink;

  constructor(options?: LoggerOptions) {
    this.level = options?.level ?? resolveDefaultLogLevel();
    this.namespace = options?.namespace;
    this.context = options?.context ? (sanitizeLogValue(options.context) as LogContext) : {};
    this.customSink = options?.sink;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public getLevel(): LogLevel {
    return this.level;
  }

  public getNamespace(): string | undefined {
    return this.namespace;
  }

  public getContext(): Readonly<LogContext> {
    return this.context;
  }

  public isDebugEnabled(): boolean {
    return LOG_LEVEL_SEVERITY[this.level] <= LOG_LEVEL_SEVERITY.debug;
  }

  public isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_SEVERITY[level] >= LOG_LEVEL_SEVERITY[this.level] && this.level !== "silent";
  }

  /**
   * Create a child logger with an appended namespace and optional context.
   */
  public child(namespace?: string, childContext?: LogContext): Logger {
    const combinedNamespace = namespace
      ? this.namespace
        ? `${this.namespace}:${namespace}`
        : namespace
      : this.namespace;

    const mergedContext: LogContext = {
      ...this.context,
      ...(childContext ? (sanitizeLogValue(childContext) as LogContext) : {}),
    };

    return new Logger({
      level: this.level,
      namespace: combinedNamespace,
      context: mergedContext,
      sink: this.customSink,
    });
  }

  /**
   * Return a new logger configured with additional context fields.
   */
  public withContext(additionalContext: LogContext): Logger {
    return this.child(undefined, additionalContext);
  }

  public setSink(sink?: LogSink): void {
    this.customSink = sink;
  }

  public debug(message: string, ...args: unknown[]): void {
    if (!this.isDebugEnabled()) return;
    this.dispatch("debug", message, args);
  }

  public info(message: string, ...args: unknown[]): void {
    if (!this.isLevelEnabled("info")) return;
    this.dispatch("info", message, args);
  }

  public warn(message: string, ...args: unknown[]): void {
    if (!this.isLevelEnabled("warn")) return;
    this.dispatch("warn", message, args);
  }

  public error(message: string, ...args: unknown[]): void {
    if (!this.isLevelEnabled("error")) return;
    this.dispatch("error", message, args);
  }

  /**
   * Start a performance / duration timer for an operation.
   * Calling timer.done() or timer.fail() emits structured diagnostics with `duration`.
   */
  public startTimer(operation: string, initialContext?: LogContext): {
    done: (message?: string, extraContext?: LogContext) => void;
    fail: (err: unknown, message?: string, extraContext?: LogContext) => void;
  } {
    const start = Date.now();
    const opContext: LogContext = { operation, ...initialContext };

    return {
      done: (message = `${operation} completed`, extraContext?: LogContext) => {
        const duration = Date.now() - start;
        this.debug(message, { ...opContext, ...extraContext, duration });
      },
      fail: (err: unknown, message = `${operation} failed`, extraContext?: LogContext) => {
        const duration = Date.now() - start;
        const errorCode = err && typeof err === "object" && "code" in err ? String((err as any).code) : undefined;
        this.error(message, {
          ...opContext,
          ...extraContext,
          duration,
          errorCode,
          error: err instanceof Error ? err.message : String(err),
        }, err);
      },
    };
  }

  private dispatch(level: LogLevel, rawMessage: string, rawArgs: unknown[]): void {
    let callContext: LogContext | undefined;

    // Detect if first argument is a plain LogContext object (not Error, not Array)
    if (
      rawArgs.length > 0 &&
      rawArgs[0] !== null &&
      typeof rawArgs[0] === "object" &&
      !(rawArgs[0] instanceof Error) &&
      !Array.isArray(rawArgs[0])
    ) {
      callContext = rawArgs[0] as LogContext;
    }

    const mergedContext: LogContext = {
      ...this.context,
      ...(callContext ? (sanitizeLogValue(callContext) as LogContext) : {}),
    };

    const hasContext = Object.keys(mergedContext).length > 0;
    const sanitizedMessage = redactKnownSecrets(rawMessage);
    const sanitizedArgs = rawArgs.map((a) => sanitizeLogValue(a));

    const entry: LogEntry = {
      level,
      namespace: this.namespace,
      message: sanitizedMessage,
      context: hasContext ? mergedContext : undefined,
      args: sanitizedArgs,
      timestamp: Date.now(),
    };

    if (this.customSink) {
      this.customSink(entry);
      return;
    }

    // Default sink: diagnostic output to stderr to keep stdout 100% clean for JSON/Agent protocols
    const prefix = this.namespace ? `[${this.namespace}] ` : "";
    const contextStr = hasContext ? ` ${JSON.stringify(mergedContext)}` : "";
    const formatted = `${prefix}${sanitizedMessage}${contextStr}`;

    if (sanitizedArgs.length > 0) {
      if (level === "error") {
        console.error(formatted, ...sanitizedArgs);
      } else if (level === "warn") {
        console.warn(formatted, ...sanitizedArgs);
      } else {
        console.error(formatted, ...sanitizedArgs);
      }
    } else {
      if (level === "error") {
        console.error(formatted);
      } else if (level === "warn") {
        console.warn(formatted);
      } else {
        console.error(formatted);
      }
    }
  }
}

export const logger = new Logger();
