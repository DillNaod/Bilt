import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeAsk } from "../../../src/commands/ask.js";
import * as aiConfig from "../../../src/core/ai/config.js";
import * as aiRuntime from "../../../src/core/ai/runtime.js";

describe("Commands: ask", () => {
  let tmpDir: string;
  let logs: string[] = [];
  const origLog = console.log;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-ask-cmd-"));
    logs = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
  });

  afterEach(async () => {
    console.log = origLog;
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should warn if question is empty", async () => {
    await executeAsk("");
    expect(logs.join("\n")).toContain("Please provide a question");
  });

  it("should inform user if no AI provider is configured", async () => {
    vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
      activeProvider: undefined as any,
      activeModel: "",
      timeoutMs: 5000,
      totalBudgetMs: 10000,
      redactionDebug: false,
    });

    await executeAsk("Why is this secret dangerous?", tmpDir);
    expect(logs.join("\n")).toContain("No AI provider configured");
  });

  it("should execute AI completion with debug logging and fallback notice when configured", async () => {
    vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
      activeProvider: "anthropic",
      activeModel: "claude-3-5-sonnet",
      timeoutMs: 5000,
      totalBudgetMs: 10000,
      redactionDebug: false,
    });

    vi.spyOn(aiRuntime, "executeAICompletion").mockResolvedValue({
      content: "This secret should be moved to .env.local immediately.",
      providerId: "openai",
      providerName: "OpenAI",
      model: "gpt-4o",
      fellBack: true,
      attempts: [],
    });

    await executeAsk("How do I fix this leaked secret?", tmpDir, { debug: true });
    const output = logs.join("\n");
    expect(output).toContain("Debug: Redacted Context Payload");
    expect(output).toContain("Bilt AI Answer (OpenAI)");
    expect(output).toContain("Fallback used from configured provider 'anthropic' to 'openai'");
  });

  it("should handle AI provider failure gracefully and report offline continuation", async () => {
    vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
      activeProvider: "local",
      activeModel: "",
      timeoutMs: 5000,
      totalBudgetMs: 10000,
      redactionDebug: false,
    });

    vi.spyOn(aiRuntime, "executeAICompletion").mockRejectedValue(
      new Error("Connection timeout to local model"),
    );

    await executeAsk("What are the architectural findings?", tmpDir);
    const output = logs.join("\n");
    expect(output).toContain("AI Query Failed");
    expect(output).toContain("Connection timeout to local model");
    expect(output).toContain("Bilt continued locally");
  });
});
