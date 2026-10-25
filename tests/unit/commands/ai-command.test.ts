import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  executeAIStatus,
  executeAIProvider,
  executeAIModel,
  executeAIRemove,
  executeAITest,
  executeAILastRequest,
} from "../../../src/commands/ai.js";
import * as aiConfig from "../../../src/core/ai/config.js";
import * as aiStorage from "../../../src/core/ai/storage.js";
import * as aiProviders from "../../../src/core/ai/providers/index.js";

describe("Commands: ai (status, provider, model, remove, test, audit)", () => {
  let logs: string[] = [];
  const origLog = console.log;

  beforeEach(() => {
    logs = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
  });

  afterEach(() => {
    console.log = origLog;
    vi.restoreAllMocks();
  });

  describe("executeAIStatus", () => {
    it("should print status when no provider is configured", async () => {
      vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
        activeProvider: undefined as any,
        activeModel: "",
        timeoutMs: 5000,
        totalBudgetMs: 10000,
        redactionDebug: false,
        lastValidated: {},
      });

      await executeAIStatus();
      const output = logs.join("\n");
      expect(output).toContain("No AI provider currently configured");
    });

    it("should print active provider and masked key when configured", async () => {
      vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
        activeProvider: "openai",
        activeModel: "gpt-4o",
        timeoutMs: 5000,
        totalBudgetMs: 10000,
        redactionDebug: false,
        lastValidated: { openai: Date.now() },
      });
      vi.spyOn(aiStorage, "getApiKey").mockResolvedValue({
        key: "sk-proj-1234567890abcdef1234567890",
        source: "keychain",
      });

      await executeAIStatus();
      const output = logs.join("\n");
      expect(output).toContain("OpenAI");
      expect(output).toContain("gpt-4o");
      expect(output).toContain("Masked Key:");
      expect(output).toContain("Key Source:    keychain");
    });
  });

  describe("executeAIProvider", () => {
    it("should report invalid provider ID when target is unknown", async () => {
      await executeAIProvider("nonexistent-provider-xyz");
      const output = logs.join("\n");
      expect(output).toContain("Invalid provider ID: 'nonexistent-provider-xyz'");
    });

    it("should warn if target provider requires an API key but none is stored", async () => {
      vi.spyOn(aiStorage, "getApiKey").mockResolvedValue({
        key: null,
        source: "none",
      });

      await executeAIProvider("openai");
      const output = logs.join("\n");
      expect(output).toContain("No stored API key found for provider 'OpenAI'");
    });

    it("should switch provider when API key is present", async () => {
      vi.spyOn(aiStorage, "getApiKey").mockResolvedValue({
        key: "sk-mock-key",
        source: "env",
      });
      const setConfigSpy = vi.spyOn(aiConfig, "setAIConfig").mockReturnValue({} as any);

      await executeAIProvider("openai");
      const output = logs.join("\n");
      expect(output).toContain("Switched active AI provider to OpenAI");
      expect(setConfigSpy).toHaveBeenCalledWith({ activeProvider: "openai" });
    });
  });

  describe("executeAIModel", () => {
    it("should warn when no active provider is configured", async () => {
      vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
        activeProvider: undefined as any,
        activeModel: "",
        timeoutMs: 5000,
        totalBudgetMs: 10000,
        redactionDebug: false,
        lastValidated: {},
      });

      await executeAIModel("claude-3-5-sonnet");
      const output = logs.join("\n");
      expect(output).toContain("No AI provider currently configured");
    });

    it("should set custom model when targetModel argument is passed", async () => {
      vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
        activeProvider: "anthropic",
        activeModel: "claude-3-opus",
        timeoutMs: 5000,
        totalBudgetMs: 10000,
        redactionDebug: false,
        lastValidated: {},
      });
      const setModelSpy = vi.spyOn(aiConfig, "setActiveModel").mockReturnValue();

      await executeAIModel("claude-3-5-haiku-latest");
      const output = logs.join("\n");
      expect(output).toContain("Active model for Anthropic (Claude) set to 'claude-3-5-haiku-latest'");
      expect(setModelSpy).toHaveBeenCalledWith("anthropic", "claude-3-5-haiku-latest");
    });
  });

  describe("executeAIRemove", () => {
    it("should inform user when nothing to remove", async () => {
      vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
        activeProvider: undefined as any,
        activeModel: "",
        timeoutMs: 5000,
        totalBudgetMs: 10000,
        redactionDebug: false,
        lastValidated: {},
      });

      await executeAIRemove();
      const output = logs.join("\n");
      expect(output).toContain("No AI provider currently configured to remove");
    });

    it("should delete API key and clear active provider", async () => {
      vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
        activeProvider: "openai",
        activeModel: "gpt-4o",
        timeoutMs: 5000,
        totalBudgetMs: 10000,
        redactionDebug: false,
        lastValidated: {},
      });
      const delKeySpy = vi.spyOn(aiStorage, "deleteApiKey").mockResolvedValue({ success: true });
      const setConfigSpy = vi.spyOn(aiConfig, "setAIConfig").mockReturnValue({} as any);

      await executeAIRemove();
      const output = logs.join("\n");
      expect(output).toContain("Removed API key and configuration for provider 'openai'");
      expect(delKeySpy).toHaveBeenCalledWith("openai");
      expect(setConfigSpy).toHaveBeenCalledWith({ activeProvider: undefined });
    });
  });

  describe("executeAITest", () => {
    it("should warn if unconfigured", async () => {
      vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
        activeProvider: undefined as any,
        activeModel: "",
        timeoutMs: 5000,
        totalBudgetMs: 10000,
        redactionDebug: false,
        lastValidated: {},
      });

      await executeAITest();
      const output = logs.join("\n");
      expect(output).toContain("No AI provider configured");
    });

    it("should report success when provider key validates", async () => {
      vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
        activeProvider: "openai",
        activeModel: "gpt-4o",
        timeoutMs: 5000,
        totalBudgetMs: 10000,
        redactionDebug: false,
        lastValidated: {},
      });
      vi.spyOn(aiStorage, "getApiKey").mockResolvedValue({
        key: "sk-valid-key",
        source: "keychain",
      });
      const mockProvider: any = {
        name: "OpenAI",
        requiresApiKey: true,
        validateKey: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(aiProviders, "getProvider").mockReturnValue(mockProvider);
      const recValSpy = vi.spyOn(aiConfig, "recordValidation").mockReturnValue();

      await executeAITest();
      const output = logs.join("\n");
      expect(output).toContain("API key for OpenAI is valid and working");
      expect(recValSpy).toHaveBeenCalledWith("openai");
    });

    it("should report error when provider key validation fails", async () => {
      vi.spyOn(aiConfig, "getAIConfig").mockReturnValue({
        activeProvider: "openai",
        activeModel: "gpt-4o",
        timeoutMs: 5000,
        totalBudgetMs: 10000,
        redactionDebug: false,
        lastValidated: {},
      });
      vi.spyOn(aiStorage, "getApiKey").mockResolvedValue({
        key: "sk-revoked-key",
        source: "keychain",
      });
      const mockProvider: any = {
        name: "OpenAI",
        requiresApiKey: true,
        validateKey: vi.fn().mockResolvedValue(false),
      };
      vi.spyOn(aiProviders, "getProvider").mockReturnValue(mockProvider);

      await executeAITest();
      const output = logs.join("\n");
      expect(output).toContain("Validation failed for OpenAI");
    });
  });

  describe("executeAILastRequest", () => {
    it("should inform user when no request payload is stored", async () => {
      vi.spyOn(aiConfig, "getLastRequestPayload").mockReturnValue(null);

      await executeAILastRequest();
      const output = logs.join("\n");
      expect(output).toContain("No AI requests have been sent yet");
    });

    it("should print JSON payload when audit data exists", async () => {
      vi.spyOn(aiConfig, "getLastRequestPayload").mockReturnValue({
        prompt: "Check this route",
        redactedContext: { findings: [] },
      });

      await executeAILastRequest();
      const output = logs.join("\n");
      expect(output).toContain("Check this route");
    });
  });
});
