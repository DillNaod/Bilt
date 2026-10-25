import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executePlugin } from "../../../src/commands/plugin.js";
import { executeRequirement } from "../../../src/commands/requirements.js";
import { loadRequirementsContract } from "../../../src/core/contract/requirements.js";

describe("Commands: plugin and requirements", () => {
  let tmpDir: string;
  let logs: string[] = [];
  const origLog = console.log;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-plugin-reqs-"));
    logs = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
  });

  afterEach(async () => {
    console.log = origLog;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("executePlugin", () => {
    it("should list official and configured plugins", async () => {
      await executePlugin("list", undefined, { dir: tmpDir });
      const output = logs.join("\n");
      expect(output).toContain("BILT PLUGINS");
      expect(output).toContain("docker");
      expect(output).toContain("terraform");
      expect(output).toContain("prisma");
    });

    it("should install a plugin in .biltrc.json", async () => {
      await executePlugin("install", "custom-security-plugin", { dir: tmpDir });

      const biltrc = JSON.parse(await fs.readFile(path.join(tmpDir, ".biltrc.json"), "utf-8"));
      expect(biltrc.plugins).toContain("custom-security-plugin");

      logs = [];
      await executePlugin("list", undefined, { dir: tmpDir });
      expect(logs.join("\n")).toContain("custom-security-plugin");
    });

    it("should reject install without plugin name", async () => {
      await expect(executePlugin("install", "", { dir: tmpDir })).rejects.toThrow(
        /Please specify a plugin name/,
      );
    });

    it("should create scaffolded plugin file", async () => {
      await executePlugin("create", "auth-checker", { dir: tmpDir });
      const scaffoldPath = path.join(tmpDir, "bilt-plugin-auth-checker.ts");
      const content = await fs.readFile(scaffoldPath, "utf-8");
      expect(content).toContain('name: "bilt-plugin-auth-checker"');
      expect(content).toContain("export default plugin;");
    });

    it("should reject invalid plugin name or unknown action", async () => {
      await expect(executePlugin("create", "???///", { dir: tmpDir })).rejects.toThrow(
        /Invalid plugin name/,
      );
      await expect(executePlugin("unknownAction", "test", { dir: tmpDir })).rejects.toThrow(
        /Unknown plugin action/,
      );
    });
  });

  describe("executeRequirement", () => {
    it("should add, list, and remove contract requirements", async () => {
      // 1. Add requirement
      const addCode = await executeRequirement(tmpDir, "add", {
        id: "REQ-SEC-001",
        description: "All API routes must require JWT authentication",
        type: "security",
        priority: "critical",
        target: "src/api/**",
        format: "agent",
      });
      expect(addCode).toBe(0);

      // Verify contract state
      const contract = await loadRequirementsContract(tmpDir);
      expect(contract.requirements.length).toBe(1);
      expect(contract.requirements[0]?.id).toBe("REQ-SEC-001");
      expect(contract.requirements[0]?.targetFiles).toEqual(["src/api/**"]);

      // 2. List requirements
      logs = [];
      const listCode = await executeRequirement(tmpDir, "list", { format: "agent" });
      expect(listCode).toBe(0);
      const parsedList = JSON.parse(logs.join("\n"));
      expect(parsedList.requirements.length).toBe(1);

      // 3. Remove requirement
      const removeCode = await executeRequirement(tmpDir, "remove", {
        id: "REQ-SEC-001",
        format: "agent",
      });
      expect(removeCode).toBe(0);

      const afterRemove = await loadRequirementsContract(tmpDir);
      expect(afterRemove.requirements.length).toBe(0);
    });

    it("should fail with error if required fields are missing on add or remove", async () => {
      const failAdd = await executeRequirement(tmpDir, "add", {
        id: "REQ-001",
        // missing description
      });
      expect(failAdd).toBe(1);

      const failRemove = await executeRequirement(tmpDir, "remove", {
        // missing id
      });
      expect(failRemove).toBe(1);
    });
  });
});
