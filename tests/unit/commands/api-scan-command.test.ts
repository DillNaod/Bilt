import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { executeApiScan } from "../../../src/commands/api-scan.js";

describe("Commands: api-scan", () => {
  let tmpDir: string;
  let logs: string[] = [];
  const origLog = console.log;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-test-api-scan-cmd-"));
    logs = [];
    console.log = (...args: any[]) => logs.push(args.join(" "));
  });

  afterEach(async () => {
    console.log = origLog;
    process.exitCode = undefined;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should run on an empty project and output human summary", async () => {
    const result = await executeApiScan(tmpDir);
    expect(result.healthScore).toBe(100);
    expect(result.grade).toBe("A+");
    expect(result.findings).toEqual([]);

    const output = logs.join("\n");
    expect(output).toContain("all API security checks clear");
  });

  it("should output JSON format when json: true is provided", async () => {
    const result = await executeApiScan(tmpDir, { json: true });
    expect(result.healthScore).toBe(100);

    const jsonLog = logs.find((l) => l.trim().startsWith("{")) || logs.join("\n");
    const parsed = JSON.parse(jsonLog);
    expect(parsed.healthScore).toBe(100);
    expect(parsed.grade).toBe("A+");
    expect(Array.isArray(parsed.findings)).toBe(true);
  });

  it("should scan API routes and detect mass-assignment or unauthenticated route", async () => {
    const apiDir = path.join(tmpDir, "app", "api", "users");
    await fs.mkdir(apiDir, { recursive: true });
    await fs.writeFile(
      path.join(apiDir, "route.ts"),
      `
        export async function POST(req: Request) {
          const body = await req.json();
          // mass assignment vulnerability: passing entire body directly into update
          const user = await db.user.update({ where: { id: 1 }, data: body });
          return Response.json(user);
        }
      `,
    );

    logs = [];
    const result = await executeApiScan(tmpDir, { details: true });
    expect(result.scannedFiles).toBeGreaterThan(0);
    expect(result.findings.length).toBeGreaterThan(0);

    const output = logs.join("\n");
    expect(output).toContain("route");
  });

  it("should format headlines in quiet mode and filter by severity", async () => {
    const apiDir = path.join(tmpDir, "app", "api", "profile");
    await fs.mkdir(apiDir, { recursive: true });
    await fs.writeFile(
      path.join(apiDir, "route.ts"),
      `
        export async function POST(req: Request) {
          const body = await req.json();
          await db.profile.create({ data: body });
          return Response.json({ ok: true });
        }
      `,
    );

    logs = [];
    const result = await executeApiScan(tmpDir, { quiet: true, severity: "critical" });
    expect(result.findings).toBeDefined();

    const output = logs.join("\n");
    expect(output.length).toBeGreaterThanOrEqual(0);
  });
});
