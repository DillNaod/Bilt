import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger, logger, type LogEntry } from "../../src/core/logging/logger.js";

describe("Core Logging Abstraction", () => {
  const origEnvDebug = process.env.BILT_DEBUG;
  const origEnvLogLevel = process.env.BILT_LOG_LEVEL;

  beforeEach(() => {
    delete process.env.BILT_DEBUG;
    delete process.env.BILT_LOG_LEVEL;
  });

  afterEach(() => {
    if (origEnvDebug !== undefined) {
      process.env.BILT_DEBUG = origEnvDebug;
    } else {
      delete process.env.BILT_DEBUG;
    }
    if (origEnvLogLevel !== undefined) {
      process.env.BILT_LOG_LEVEL = origEnvLogLevel;
    } else {
      delete process.env.BILT_LOG_LEVEL;
    }
  });

  it("should filter logs below active level", () => {
    const logs: LogEntry[] = [];
    const testLogger = new Logger({
      level: "warn",
      sink: (entry) => logs.push(entry),
    });

    testLogger.debug("debug message");
    testLogger.info("info message");
    testLogger.warn("warning message");
    testLogger.error("error message");

    expect(logs.length).toBe(2);
    expect(logs[0].level).toBe("warn");
    expect(logs[0].message).toBe("warning message");
    expect(logs[1].level).toBe("error");
    expect(logs[1].message).toBe("error message");
  });

  it("should support debug level when enabled", () => {
    const logs: LogEntry[] = [];
    const testLogger = new Logger({
      level: "debug",
      sink: (entry) => logs.push(entry),
    });

    expect(testLogger.isDebugEnabled()).toBe(true);
    testLogger.debug("test debug", { key: "value" });

    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe("debug");
    expect(logs[0].args).toEqual([{ key: "value" }]);
  });

  it("should create namespaced child loggers", () => {
    const logs: LogEntry[] = [];
    const parent = new Logger({
      level: "info",
      namespace: "bilt",
      sink: (entry) => logs.push(entry),
    });
    const child = parent.child("pipeline");

    child.info("pipeline started");

    expect(logs.length).toBe(1);
    expect(logs[0].namespace).toBe("bilt:pipeline");
  });

  it("should use default console sinks if no custom sink is provided", () => {
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const testLogger = new Logger({ level: "debug", namespace: "test" });
    testLogger.error("error alert");
    testLogger.warn("warn alert");
    testLogger.info("info alert");

    expect(stderrSpy).toHaveBeenCalledWith("[test] error alert");
    expect(warnSpy).toHaveBeenCalledWith("[test] warn alert");
    expect(stderrSpy).toHaveBeenCalledWith("[test] info alert");

    stderrSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should respect environment variables for log level", () => {
    process.env.BILT_DEBUG = "1";
    const envLogger = new Logger();
    expect(envLogger.getLevel()).toBe("debug");
  });
});
