import { describe, it, expect, beforeEach } from "vitest";
import {
  Logger,
  type LogEntry,
  type LogLevel,
  sanitizeLogValue,
} from "../../src/core/logging/logger.js";

describe("Logging Subsystem", () => {
  let capturedEntries: LogEntry[];
  let testLogger: Logger;

  beforeEach(() => {
    capturedEntries = [];
    testLogger = new Logger({
      level: "debug",
      namespace: "test",
      sink: (entry) => capturedEntries.push(entry),
    });
  });

  describe("Log Levels & Severity Gating", () => {
    it("should emit entries at all levels when level is debug", () => {
      testLogger.debug("debug message");
      testLogger.info("info message");
      testLogger.warn("warn message");
      testLogger.error("error message");

      expect(capturedEntries).toHaveLength(4);
      expect(capturedEntries.map((e) => e.level)).toEqual([
        "debug",
        "info",
        "warn",
        "error",
      ]);
    });

    it("should filter out debug and info when level is warn", () => {
      testLogger.setLevel("warn");

      testLogger.debug("should be ignored");
      testLogger.info("should be ignored");
      testLogger.warn("warning recorded");
      testLogger.error("error recorded");

      expect(capturedEntries).toHaveLength(2);
      expect(capturedEntries[0]?.level).toBe("warn");
      expect(capturedEntries[1]?.level).toBe("error");
    });

    it("should filter out everything when level is silent", () => {
      testLogger.setLevel("silent");

      testLogger.debug("noop");
      testLogger.info("noop");
      testLogger.warn("noop");
      testLogger.error("noop");

      expect(capturedEntries).toHaveLength(0);
    });

    it("should report isDebugEnabled correctly based on level", () => {
      testLogger.setLevel("debug");
      expect(testLogger.isDebugEnabled()).toBe(true);

      testLogger.setLevel("info");
      expect(testLogger.isDebugEnabled()).toBe(false);

      testLogger.setLevel("warn");
      expect(testLogger.isDebugEnabled()).toBe(false);
    });
  });

  describe("Child & Context Propagation", () => {
    it("should concatenate child namespaces and inherit context", () => {
      const parent = testLogger.child("scan", {
        sessionId: "sess-123",
        projectRoot: "/app",
      });

      const child = parent.child("secrets", {
        ruleId: "RULE-SEC-001",
      });

      child.info("Scanning for API keys");

      expect(capturedEntries).toHaveLength(1);
      const entry = capturedEntries[0]!;
      expect(entry.namespace).toBe("test:scan:secrets");
      expect(entry.context).toEqual({
        sessionId: "sess-123",
        projectRoot: "/app",
        ruleId: "RULE-SEC-001",
      });
    });

    it("should allow child logger to override inherited context fields", () => {
      const parent = testLogger.child("runner", {
        operation: "initial",
        command: "scan",
      });

      const child = parent.withContext({
        operation: "override",
      });

      child.info("Running overridden step");

      const entry = capturedEntries[0]!;
      expect(entry.context).toEqual({
        command: "scan",
        operation: "override",
      });
    });
  });

  describe("Structured Fields Support", () => {
    it("should capture standard structured fields passed as first argument", () => {
      testLogger.info("Step finished", {
        command: "check",
        operation: "readiness-evaluation",
        ruleId: "RULE-AUTH-001",
        sessionId: "sess-abc",
        projectRoot: "/workspace/repo",
        duration: 142,
        errorCode: "ERR_RULE_TIMEOUT",
      });

      expect(capturedEntries).toHaveLength(1);
      const entry = capturedEntries[0]!;
      expect(entry.context?.command).toBe("check");
      expect(entry.context?.operation).toBe("readiness-evaluation");
      expect(entry.context?.ruleId).toBe("RULE-AUTH-001");
      expect(entry.context?.sessionId).toBe("sess-abc");
      expect(entry.context?.projectRoot).toBe("/workspace/repo");
      expect(entry.context?.duration).toBe(142);
      expect(entry.context?.errorCode).toBe("ERR_RULE_TIMEOUT");
    });
  });

  describe("Secret & Sensitive Data Redaction", () => {
    it("should universally redact known API keys and secrets in messages", () => {
      const secretMsg = "Found exposed key sk-live-1234567890abcdef1234567890 in file";
      testLogger.warn(secretMsg);

      const entry = capturedEntries[0]!;
      expect(entry.message).not.toContain("sk-live-1234567890abcdef1234567890");
      expect(entry.message).toContain("sk-l*** [len 34]");
    });

    it("should scrub sensitive key names in context objects", () => {
      testLogger.info("Config payload", {
        apiKey: "unredacted-secret-token",
        password: "super-secret-password",
        bearerToken: "bearer 1234567890abcdef1234567890",
        safeField: "safe-value",
      });

      const entry = capturedEntries[0]!;
      expect(entry.context?.apiKey).toBe("[REDACTED]");
      expect(entry.context?.password).toBe("[REDACTED]");
      expect(entry.context?.bearerToken).toBe("[REDACTED]");
      expect(entry.context?.safeField).toBe("safe-value");
    });

    it("should scrub secrets from Error messages and stack traces", () => {
      const fakeError = new Error("Connection failed to postgres://user:super_secret_pw@db.internal:5432/main");
      testLogger.error("Database connection failure", { operation: "db-connect" }, fakeError);

      const entry = capturedEntries[0]!;
      const loggedError = entry.args[1] as Record<string, unknown>;
      expect(loggedError.message).not.toContain("super_secret_pw");
      if (loggedError.stack) {
        expect(loggedError.stack).not.toContain("super_secret_pw");
      }
    });

    it("should handle circular references safely in sanitizeLogValue", () => {
      const circular: any = { name: "test-node" };
      circular.self = circular;

      const sanitized = sanitizeLogValue(circular) as any;
      expect(sanitized.name).toBe("test-node");
      expect(sanitized.self).toBe("[Circular]");
    });
  });

  describe("Duration Timer Diagnostic Helper", () => {
    it("should record duration and operation on timer.done()", async () => {
      const timer = testLogger.startTimer("ast-scan", { fileCount: 42 });

      await new Promise((r) => setTimeout(r, 15));
      timer.done("AST scan complete", { parsedCount: 42 });

      expect(capturedEntries).toHaveLength(1);
      const entry = capturedEntries[0]!;
      expect(entry.level).toBe("debug");
      expect(entry.context?.operation).toBe("ast-scan");
      expect(entry.context?.fileCount).toBe(42);
      expect(entry.context?.parsedCount).toBe(42);
      expect(typeof entry.context?.duration).toBe("number");
      expect((entry.context?.duration as number)).toBeGreaterThanOrEqual(10);
    });

    it("should record error, errorCode, and duration on timer.fail()", async () => {
      const timer = testLogger.startTimer("git-diff");
      const err = new Error("Git lock timeout");
      (err as any).code = "ERR_GIT_LOCKED";

      timer.fail(err, "Git diff pass aborted");

      expect(capturedEntries).toHaveLength(1);
      const entry = capturedEntries[0]!;
      expect(entry.level).toBe("error");
      expect(entry.context?.operation).toBe("git-diff");
      expect(entry.context?.errorCode).toBe("ERR_GIT_LOCKED");
      expect(typeof entry.context?.duration).toBe("number");
    });
  });
});
