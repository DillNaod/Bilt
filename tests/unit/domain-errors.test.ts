import { describe, it, expect } from "vitest";
import {
  BiltError,
  ValidationError,
  ConfigurationError,
  FilesystemError,
  ScanError,
  RuleError,
  RemediationError,
  AiProviderError,
  TamperError,
  isBiltError,
  toBiltError,
  translateErrorToExitCode,
} from "../../src/core/errors/index.js";

describe("Domain Error Model", () => {
  describe("BiltError Base Class", () => {
    it("should set properties correctly and preserve prototype chain", () => {
      const err = new BiltError("Something failed", {
        code: "ERR_CUSTOM",
        exitCode: 3,
        context: { detail: "xyz" },
      });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(BiltError);
      expect(err.name).toBe("BiltError");
      expect(err.code).toBe("ERR_CUSTOM");
      expect(err.exitCode).toBe(3);
      expect(err.context).toEqual({ detail: "xyz" });
      expect(err.isBiltError).toBe(true);
    });

    it("should preserve underlying cause", () => {
      const cause = new Error("Native syscall failed (EACCES)");
      const err = new BiltError("Filesystem access blocked", { cause });

      expect(err.cause).toBe(cause);
    });

    it("should automatically redact secrets in error message and context", () => {
      const rawSecret = "sk-live-1234567890abcdef1234567890";
      const err = new BiltError(`Failed with token ${rawSecret}`, {
        context: {
          apiKey: rawSecret,
          normal: "ok",
        },
      });

      expect(err.message).not.toContain(rawSecret);
      expect(err.message).toContain("sk-l*** [len 34]");
      expect(err.context.apiKey).toBe("[REDACTED]");
      expect(err.context.normal).toBe("ok");
    });

    it("should format diagnostic safely with cause", () => {
      const cause = new Error("Root network drop");
      const err = new BiltError("Check timed out", {
        code: "ERR_TIMEOUT",
        context: { duration: 5000 },
        cause,
      });

      const diag = err.formatDiagnostic();
      expect(diag).toContain("[ERR_TIMEOUT] Check timed out");
      expect(diag).toContain("Context: {\"duration\":5000}");
      expect(diag).toContain("Caused by: [Error] Root network drop");
    });

    it("should serialize to safe JSON representation", () => {
      const err = new BiltError("Invalid target", {
        code: "ERR_TARGET",
        exitCode: 2,
        context: { target: "dir" },
      });

      const json = err.toJSON();
      expect(json.name).toBe("BiltError");
      expect(json.code).toBe("ERR_TARGET");
      expect(json.exitCode).toBe(2);
      expect(json.message).toBe("Invalid target");
      expect(json.context).toEqual({ target: "dir" });
    });
  });

  describe("Domain Subclasses", () => {
    it("ValidationError should default to code ERR_VALIDATION and exitCode 2", () => {
      const err = new ValidationError("Flag --severity is invalid");
      expect(err).toBeInstanceOf(ValidationError);
      expect(err).toBeInstanceOf(BiltError);
      expect(err.name).toBe("ValidationError");
      expect(err.code).toBe("ERR_VALIDATION");
      expect(err.exitCode).toBe(2);
    });

    it("ConfigurationError should default to code ERR_CONFIGURATION and exitCode 2", () => {
      const err = new ConfigurationError("Corrupt .biltrc.json syntax");
      expect(err).toBeInstanceOf(ConfigurationError);
      expect(err.code).toBe("ERR_CONFIGURATION");
      expect(err.exitCode).toBe(2);
    });

    it("FilesystemError should default to code ERR_FILESYSTEM and exitCode 2", () => {
      const err = new FilesystemError("Directory not found: /missing");
      expect(err).toBeInstanceOf(FilesystemError);
      expect(err.code).toBe("ERR_FILESYSTEM");
      expect(err.exitCode).toBe(2);
    });

    it("ScanError should default to code ERR_SCAN and exitCode 1", () => {
      const err = new ScanError("AST parser failed on binary file");
      expect(err).toBeInstanceOf(ScanError);
      expect(err.code).toBe("ERR_SCAN");
      expect(err.exitCode).toBe(1);
    });

    it("RuleError should include ruleId in context and default to exitCode 1", () => {
      const err = new RuleError("Rule evaluation crashed", {
        ruleId: "RULE-SEC-042",
      });
      expect(err).toBeInstanceOf(RuleError);
      expect(err.code).toBe("ERR_RULE");
      expect(err.exitCode).toBe(1);
      expect(err.context.ruleId).toBe("RULE-SEC-042");
    });

    it("RemediationError should include snapshotId and default to exitCode 1", () => {
      const err = new RemediationError("Snapshot restore aborted", {
        snapshotId: "snap-987",
      });
      expect(err).toBeInstanceOf(RemediationError);
      expect(err.code).toBe("ERR_REMEDIATION");
      expect(err.exitCode).toBe(1);
      expect(err.context.snapshotId).toBe("snap-987");
    });

    it("AiProviderError should include provider/model and scrub credentials", () => {
      const err = new AiProviderError("Rate limit exceeded for provider", {
        provider: "anthropic",
        model: "claude-3-5-sonnet",
      });
      expect(err).toBeInstanceOf(AiProviderError);
      expect(err.code).toBe("ERR_AI_PROVIDER");
      expect(err.context.provider).toBe("anthropic");
      expect(err.context.model).toBe("claude-3-5-sonnet");
    });

    it("TamperError should default to code ERR_TAMPER and exitCode 1", () => {
      const err = new TamperError("Suppression bypass attempted in .biltrc.json");
      expect(err).toBeInstanceOf(TamperError);
      expect(err.code).toBe("ERR_TAMPER");
      expect(err.exitCode).toBe(1);
    });
  });

  describe("Utility & Translation Functions", () => {
    it("isBiltError should recognize BiltError and subclasses", () => {
      expect(isBiltError(new BiltError("base"))).toBe(true);
      expect(isBiltError(new FilesystemError("fs"))).toBe(true);
      expect(isBiltError(new Error("native error"))).toBe(false);
      expect(isBiltError("some string")).toBe(false);
      expect(isBiltError(null)).toBe(false);
      expect(isBiltError({ isBiltError: true })).toBe(true);
    });

    it("toBiltError should normalize native errors and strings into BiltError", () => {
      const native = new Error("Native error message");
      const converted = toBiltError(native, "Default msg", "ERR_DEFAULT");

      expect(converted).toBeInstanceOf(BiltError);
      expect(converted.message).toBe("Native error message");
      expect(converted.cause).toBe(native);

      const strConverted = toBiltError("Plain string error");
      expect(strConverted).toBeInstanceOf(BiltError);
      expect(strConverted.message).toBe("Plain string error");
    });

    it("translateErrorToExitCode should extract domain exitCode or fall back", () => {
      expect(translateErrorToExitCode(new ValidationError("bad input"))).toBe(2);
      expect(translateErrorToExitCode(new ScanError("failed"))).toBe(1);
      expect(translateErrorToExitCode(new Error("native"), 4)).toBe(4);
      expect(translateErrorToExitCode("string", 3)).toBe(3);
    });
  });
});
