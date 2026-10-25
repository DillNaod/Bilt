import { describe, it, expect, vi } from "vitest";
import readline from "node:readline";
import { EventEmitter } from "node:events";
import { MCP_TOOLS, handleMcpToolCall, startMcpServer } from "../../src/mcp/server.js";

describe("Model Context Protocol (MCP) Server", () => {
  it("should expose all required MCP tools with schemas", () => {
    const toolNames = MCP_TOOLS.map((t) => t.name);

    expect(toolNames).toContain("bilt_check");
    expect(toolNames).toContain("bilt_explain");
    expect(toolNames).toContain("bilt_list_rules");
    expect(toolNames).toContain("bilt_scan");
    expect(toolNames).toContain("bilt_doctor");
    expect(MCP_TOOLS.length).toBe(5);
  });

  it("should execute bilt_list_rules and return rule definitions", async () => {
    const res = await handleMcpToolCall("bilt_list_rules");

    expect(res.isError).toBeFalsy();
    expect(res.content.length).toBe(1);

    const parsed = JSON.parse(res.content[0]!.text);
    expect(Array.isArray(parsed)).toBe(true);

    const ruleIds = parsed.map((r: any) => r.rule_id);
    expect(ruleIds).toContain("RULE-SEC-001");
    expect(ruleIds).toContain("RULE-AUTH-001");
  });

  it("should execute bilt_explain and return static rule template", async () => {
    const res = await handleMcpToolCall("bilt_explain", {
      rule_id: "RULE-SEC-001",
    });

    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.content[0]!.text);

    expect(parsed.rule_id).toBe("RULE-SEC-001");
    expect(parsed.precision).toBe("high");
    expect(parsed.maturity).toBe("stable");
    expect(parsed.explanation).toContain("Hardcoded secrets");
    expect(parsed.agent_action).toContain("Remove the hardcoded secret");
  });

  it("should execute bilt_explain with security engine rule ID", async () => {
    const res = await handleMcpToolCall("bilt_explain", {
      rule_id: "SEC-AUTH-001",
    });

    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.content[0]!.text);
    expect(parsed.id).toBe("SEC-AUTH-001");
  });

  it("should execute bilt_explain with concept fallback template", async () => {
    const res = await handleMcpToolCall("bilt_explain", {
      rule_id: "unknown-custom-rule",
    });

    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.content[0]!.text);
    expect(parsed.rule_id).toBe("UNKNOWN-CUSTOM-RULE");
  });

  it("should return error for missing rule_id in bilt_explain", async () => {
    const res = await handleMcpToolCall("bilt_explain", {});
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("rule_id argument is required");
  });

  it("should return error for unknown tool call", async () => {
    const res = await handleMcpToolCall("non_existent_tool");
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("Unknown tool");
  });

  it("should execute bilt_check and return agent output", async () => {
    const res = await handleMcpToolCall("bilt_check", { dir: ".", snippets: true });

    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.content[0]!.text);

    expect(parsed.schema_version).toBe("1.0.0");
    expect(parsed.status).toBeDefined();
    expect(Array.isArray(parsed.findings)).toBe(true);
  }, 30000);

  it("should execute bilt_scan and return scan results", async () => {
    const res = await handleMcpToolCall("bilt_scan", { dir: "." });
    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.content[0]!.text);
    expect(parsed.findings).toBeDefined();
    expect(parsed.healthScore).toBeDefined();
  }, 30000);

  it("should execute bilt_doctor and return doctor summary", async () => {
    const res = await handleMcpToolCall("bilt_doctor", { dir: "." });
    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.content[0]!.text);
    expect(parsed.grade).toBeDefined();
    expect(parsed.domainScores).toBeDefined();
    expect(parsed.framework).toBeDefined();
  }, 30000);

  it("should handle JSON-RPC protocol via startMcpServer", async () => {
    const mockEmitter = new EventEmitter();
    const readlineSpy = vi.spyOn(readline, "createInterface").mockReturnValue(mockEmitter as any);

    const stdoutMessages: any[] = [];
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((data: any, cb?: any) => {
      try {
        stdoutMessages.push(JSON.parse(String(data).trim()));
      } catch {
        // ignore non-json
      }
      if (typeof cb === "function") cb();
      return true;
    });

    startMcpServer();

    // 1. initialize
    mockEmitter.emit("line", JSON.stringify({ jsonrpc: "2.0", id: "req-1", method: "initialize" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(stdoutMessages.some((m) => m.id === "req-1" && m.result.serverInfo.name === "bilt-mcp")).toBe(true);

    // 2. tools/list
    mockEmitter.emit("line", JSON.stringify({ jsonrpc: "2.0", id: "req-2", method: "tools/list" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(stdoutMessages.some((m) => m.id === "req-2" && Array.isArray(m.result.tools))).toBe(true);

    // 3. tools/call
    mockEmitter.emit("line", JSON.stringify({
      jsonrpc: "2.0",
      id: "req-3",
      method: "tools/call",
      params: { name: "bilt_list_rules" },
    }));
    await new Promise((r) => setTimeout(r, 20));

    expect(stdoutMessages.some((m) => m.id === "req-3" && Array.isArray(m.result.content))).toBe(true);

    // 4. blank lines / non-json handling
    mockEmitter.emit("line", "");
    mockEmitter.emit("line", "some plain text");

    readlineSpy.mockRestore();
    writeSpy.mockRestore();
  });
});
