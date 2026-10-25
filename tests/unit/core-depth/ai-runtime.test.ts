import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeAICompletion } from "../../../src/core/ai/runtime.js";
import * as configMod from "../../../src/core/ai/config.js";
import * as storageMod from "../../../src/core/ai/storage.js";
import * as providersMod from "../../../src/core/ai/providers/index.js";
import type { AIProvider } from "../../../src/core/ai/types.js";

describe("AI Runtime: executeAICompletion & Provider Fallbacks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should successfully complete with preferred provider", async () => {
    vi.spyOn(configMod, "getAIConfig").mockReturnValue({
      activeProvider: "openai",
      activeModel: "gpt-4o-mini",
      timeoutMs: 5000,
      totalBudgetMs: 10000,
      redactionDebug: false,
    });

    vi.spyOn(configMod, "getProviderRuntime").mockReturnValue({
      enabled: true,
      retries: 1,
      timeoutMs: 5000,
      maxRequestsPerMinute: 60,
    });

    vi.spyOn(storageMod, "getApiKey").mockResolvedValue({
      provider: "openai",
      key: "sk-test-key",
      source: "memory",
    });

    const mockProvider: AIProvider = {
      id: "openai",
      name: "OpenAI",
      requiresApiKey: true,
      defaultModel: "gpt-4o-mini",
      availableModels: ["gpt-4o-mini"],
      validateKey: async () => ({ valid: true }),
      complete: async () => "The secret key should be stored in .env instead of source files.",
    };

    vi.spyOn(providersMod, "getAllProviders").mockReturnValue([mockProvider]);

    const result = await executeAICompletion(
      "How do I secure this key?",
      { findings: [], projectName: "demo" },
      { timeoutMs: 2000 },
    );

    expect(result.providerId).toBe("openai");
    expect(result.content).toContain("secret key should be stored in .env");
    expect(result.fellBack).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("should failover to next provider when preferred provider encounters error", async () => {
    vi.spyOn(configMod, "getAIConfig").mockReturnValue({
      activeProvider: "openai",
      activeModel: "gpt-4o-mini",
      timeoutMs: 5000,
      totalBudgetMs: 10000,
      redactionDebug: false,
    });

    vi.spyOn(configMod, "getProviderRuntime").mockReturnValue({
      enabled: true,
      retries: 0,
      timeoutMs: 5000,
      maxRequestsPerMinute: 60,
    });

    vi.spyOn(storageMod, "getApiKey").mockImplementation(async (providerId) => ({
      provider: providerId,
      key: `sk-test-${providerId}`,
      source: "memory",
    }));

    const failingProvider: AIProvider = {
      id: "openai",
      name: "OpenAI",
      requiresApiKey: true,
      defaultModel: "gpt-4o-mini",
      availableModels: ["gpt-4o-mini"],
      validateKey: async () => ({ valid: true }),
      complete: async () => {
        throw new Error("503 Service Unavailable");
      },
    };

    const fallbackProvider: AIProvider = {
      id: "anthropic",
      name: "Anthropic",
      requiresApiKey: true,
      defaultModel: "claude-3-haiku",
      availableModels: ["claude-3-haiku"],
      validateKey: async () => ({ valid: true }),
      complete: async () => "Remediation response from fallback Anthropic model.",
    };

    vi.spyOn(providersMod, "getAllProviders").mockReturnValue([failingProvider, fallbackProvider]);

    const result = await executeAICompletion(
      "Fix this",
      { findings: [], projectName: "demo" },
      { timeoutMs: 2000 },
    );

    expect(result.providerId).toBe("anthropic");
    expect(result.fellBack).toBe(true);
    expect(result.content).toContain("Remediation response from fallback Anthropic model");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should throw when total budget is exceeded", async () => {
    vi.spyOn(configMod, "getAIConfig").mockReturnValue({
      activeProvider: "openai",
      activeModel: "gpt-4o-mini",
      timeoutMs: 5000,
      totalBudgetMs: 10000,
      redactionDebug: false,
    });

    vi.spyOn(configMod, "getProviderRuntime").mockReturnValue({ enabled: true });
    vi.spyOn(storageMod, "getApiKey").mockResolvedValue({ provider: "openai", key: "sk-123", source: "memory" });

    const slowProvider: AIProvider = {
      id: "openai",
      name: "OpenAI",
      requiresApiKey: true,
      defaultModel: "gpt-4o-mini",
      availableModels: ["gpt-4o-mini"],
      validateKey: async () => ({ valid: true }),
      complete: async () => "done",
    };

    vi.spyOn(providersMod, "getAllProviders").mockReturnValue([slowProvider]);

    // Pass an expired budget
    await expect(
      executeAICompletion("prompt", { findings: [] }, { totalBudgetMs: -1 }),
    ).rejects.toThrow(/AI budget exceeded/);
  });
});
