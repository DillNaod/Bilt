import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import type { ScanFinding } from "../../../src/types/index.js";
import { planPluginsAndApiFix } from "../../../src/commands/fix/strategies/plugins-and-api.js";
import { planConfigFix } from "../../../src/commands/fix/strategies/config.js";
import { planDependencyFix } from "../../../src/commands/fix/strategies/dependencies.js";
import type { FixPlanContext } from "../../../src/commands/fix/strategies/context.js";

describe("Fix Strategies Behavioral Depth", () => {
  let tmpDir: string;
  let ctx: FixPlanContext;
  let writtenFiles: Map<string, string>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-fix-depth-"));
    writtenFiles = new Map();
    ctx = {
      rootDir: tmpDir,
      addedTypes: new Set<string>(),
      writeFile: async (filePath: string, newContent: string, _oldContent: string) => {
        writtenFiles.set(filePath, newContent);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, newContent, "utf-8");
      },
    };
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("planPluginsAndApiFix", () => {
    describe("Docker .dockerignore strategy", () => {
      it("should create .dockerignore with required exclusions when file does not exist", async () => {
        const finding: ScanFinding = {
          id: "docker-no-dockerignore-1",
          file: "Dockerfile",
          category: "plugin-finding",
          severity: "warn",
          message: "No .dockerignore file found",
        };

        const fixes = await planPluginsAndApiFix(finding, ctx);
        expect(fixes).not.toBeNull();
        expect(fixes!.length).toBe(1);

        const fix = fixes![0]!;
        const preview = await fix.preview();
        expect(preview.steps.length).toBeGreaterThan(0);

        // Apply fix
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const content = await fs.readFile(path.join(tmpDir, ".dockerignore"), "utf-8");
        expect(content).toContain(".env");
        expect(content).toContain("node_modules");
        expect(content).toContain(".git");

        // Verify fix
        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });

      it("should append missing patterns to existing .dockerignore without duplicating", async () => {
        await fs.writeFile(path.join(tmpDir, ".dockerignore"), "node_modules\n.git\n");

        const finding: ScanFinding = {
          id: "docker-dockerignore-env-2",
          file: "Dockerfile",
          category: "plugin-finding",
          severity: "warn",
          message: ".env missing from .dockerignore",
        };

        const fixes = await planPluginsAndApiFix(finding, ctx);
        expect(fixes!.length).toBe(1);

        const fix = fixes![0]!;
        await fix.apply();

        const content = await fs.readFile(path.join(tmpDir, ".dockerignore"), "utf-8");
        expect(content).toContain(".env");
        expect(content).toContain("node_modules");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });
    });

    describe("Terraform .gitignore strategy", () => {
      it("should append terraform patterns to .gitignore and verify", async () => {
        await fs.writeFile(path.join(tmpDir, ".gitignore"), "node_modules/\n");

        const finding: ScanFinding = {
          id: "terraform-gitignore-1",
          file: "main.tf",
          category: "plugin-finding",
          severity: "warn",
          message: "Terraform state not ignored in .gitignore",
        };

        const fixes = await planPluginsAndApiFix(finding, ctx);
        expect(fixes!.length).toBe(1);

        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8");
        expect(content).toContain("*.tfvars");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });
    });

    describe("Prisma Hardcoded Connection String strategy", () => {
      it("should migrate hardcoded datasource url to env('DATABASE_URL') and update .env", async () => {
        const prismaDir = path.join(tmpDir, "prisma");
        await fs.mkdir(prismaDir, { recursive: true });
        const schemaPath = path.join(prismaDir, "schema.prisma");
        await fs.writeFile(
          schemaPath,
          'datasource db {\n  provider = "postgresql"\n  url      = "postgresql://user:secret@localhost:5432/mydb"\n}\n',
        );
        await fs.writeFile(path.join(tmpDir, ".env"), "PORT=3000\n");

        const finding: ScanFinding = {
          id: "prisma-hardcoded-1",
          file: "prisma/schema.prisma",
          category: "plugin-finding",
          severity: "warn",
          message: "Hardcoded datasource URL in prisma schema",
        };

        const fixes = await planPluginsAndApiFix(finding, ctx);
        expect(fixes!.length).toBe(1);

        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const updatedSchema = await fs.readFile(schemaPath, "utf-8");
        expect(updatedSchema).toContain('url = env("DATABASE_URL")');

        const updatedEnv = await fs.readFile(path.join(tmpDir, ".env"), "utf-8");
        expect(updatedEnv).toContain("DATABASE_URL=");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });

      it("should handle error when prisma schema is missing during apply", async () => {
        const finding: ScanFinding = {
          id: "prisma-hardcoded-2",
          file: "prisma/schema.prisma",
          category: "plugin-finding",
          severity: "warn",
          message: "Hardcoded datasource URL",
        };

        const fixes = await planPluginsAndApiFix(finding, ctx);
        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(false);
        expect(applyRes.error).toContain("prisma/schema.prisma not found");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(false);
      });
    });

    describe("API Exposed Docs strategy", () => {
      it("should guard Swagger/API documentation routes with NODE_ENV checks", async () => {
        const routeFile = "src/routes/api.ts";
        const fullPath = path.join(tmpDir, routeFile);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(
          fullPath,
          'import express from "express";\nconst app = express();\napp.use("/api-docs", swaggerUi.serve);\n',
        );

        const finding: ScanFinding = {
          id: "api-exposed-docs-1",
          file: routeFile,
          category: "api-exposed-docs",
          severity: "warn",
          message: "Exposed API docs without environment guard",
        };

        const fixes = await planPluginsAndApiFix(finding, ctx);
        expect(fixes!.length).toBe(1);

        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const content = await fs.readFile(fullPath, "utf-8");
        expect(content).toContain('if (process.env.NODE_ENV !== "production") {');
        expect(content).toContain('app.use("/api-docs", swaggerUi.serve);');

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });

      it("should report failure when route file does not exist", async () => {
        const finding: ScanFinding = {
          id: "api-exposed-docs-missing",
          file: "src/non-existent.ts",
          category: "api-exposed-docs",
          severity: "warn",
          message: "Exposed API docs",
        };

        const fixes = await planPluginsAndApiFix(finding, ctx);
        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(false);
        expect(applyRes.error).toContain("not found");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(false);
      });
    });

    describe("API Wildcard HTTP Method strategy", () => {
      it("should replace app.all and router.all with explicit methods", async () => {
        const routeFile = "src/routes/users.ts";
        const fullPath = path.join(tmpDir, routeFile);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(
          fullPath,
          'app.all("/users", handler);\nrouter.all("/profile", handler);\n',
        );

        const finding: ScanFinding = {
          id: "api-wildcard-method-1",
          file: routeFile,
          category: "api-wildcard-method",
          severity: "warn",
          message: "Wildcard HTTP method used",
        };

        const fixes = await planPluginsAndApiFix(finding, ctx);
        expect(fixes!.length).toBe(1);

        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const content = await fs.readFile(fullPath, "utf-8");
        expect(content).toContain('app.get("/users", handler);');
        expect(content).toContain('router.get("/profile", handler);');
        expect(content).not.toContain("app.all");
        expect(content).not.toContain("router.all");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });
    });

    it("should return null for unrecognized category", async () => {
      const finding: ScanFinding = {
        id: "unknown-1",
        file: "index.ts",
        category: "unrecognized" as any,
        severity: "info",
        message: "unknown",
      };
      const fixes = await planPluginsAndApiFix(finding, ctx);
      expect(fixes).toBeNull();
    });
  });

  describe("planConfigFix", () => {
    describe("Docker non-root USER directive", () => {
      it("should add USER node before CMD in Dockerfile", async () => {
        const dockerfilePath = path.join(tmpDir, "Dockerfile");
        await fs.writeFile(
          dockerfilePath,
          "FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nCMD [\"node\", \"server.js\"]\n",
        );

        const finding: ScanFinding = {
          id: "docker-user-1",
          file: "Dockerfile",
          category: "config-docker",
          severity: "warn",
          message: "Container runs as root, missing non-root USER node",
        };

        const fixes = await planConfigFix(finding, ctx);
        expect(fixes!.length).toBe(1);

        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const content = await fs.readFile(dockerfilePath, "utf-8");
        expect(content).toContain("USER node\n\nCMD");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });

      it("should add USER node before ENTRYPOINT if CMD is absent", async () => {
        const dockerfilePath = path.join(tmpDir, "Dockerfile");
        await fs.writeFile(
          dockerfilePath,
          "FROM node:20-alpine\nENTRYPOINT [\"/bin/sh\"]\n",
        );

        const finding: ScanFinding = {
          id: "docker-user-2",
          file: "Dockerfile",
          category: "config-docker",
          severity: "warn",
          message: "Container runs as root, missing non-root USER node",
        };

        const fixes = await planConfigFix(finding, ctx);
        const fix = fixes![0]!;
        await fix.apply();

        const content = await fs.readFile(dockerfilePath, "utf-8");
        expect(content).toContain("USER node\n\nENTRYPOINT");
      });

      it("should handle missing Dockerfile gracefully", async () => {
        const finding: ScanFinding = {
          id: "docker-user-missing",
          file: "Dockerfile",
          category: "config-docker",
          severity: "warn",
          message: "Container runs as root, missing non-root USER",
        };

        const fixes = await planConfigFix(finding, ctx);
        const fix = fixes![0]!;
        const res = await fix.apply();
        expect(res.success).toBe(false);
        expect(res.error).toContain("Dockerfile not found");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(false);
      });
    });

    describe("Docker base image pin", () => {
      it("should pin unpinned latest image to node:20-alpine", async () => {
        const dockerfilePath = path.join(tmpDir, "Dockerfile");
        await fs.writeFile(dockerfilePath, "FROM node:latest\nWORKDIR /app\n");

        const finding: ScanFinding = {
          id: "docker-pin-1",
          file: "Dockerfile",
          category: "config-docker",
          severity: "warn",
          message: "Dockerfile uses unpinned base image node:latest",
        };

        const fixes = await planConfigFix(finding, ctx);
        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const content = await fs.readFile(dockerfilePath, "utf-8");
        expect(content).toContain("FROM node:20-alpine");
        expect(content).not.toContain("node:latest");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });
    });

    describe("tsconfig compiler options", () => {
      it("should enable strict mode when disabled in tsconfig.json", async () => {
        const tsconfigPath = path.join(tmpDir, "tsconfig.json");
        await fs.writeFile(tsconfigPath, JSON.stringify({ compilerOptions: { strict: false } }, null, 2));

        const finding: ScanFinding = {
          id: "tsconfig-strict-1",
          file: "tsconfig.json",
          category: "config-tsconfig",
          severity: "warn",
          message: "tsconfig has disabled strict mode",
        };

        const fixes = await planConfigFix(finding, ctx);
        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const content = await fs.readFile(tsconfigPath, "utf-8");
        expect(content).toContain('"strict": true');

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });

      it("should enable noImplicitAny when disabled in tsconfig.json", async () => {
        const tsconfigPath = path.join(tmpDir, "tsconfig.json");
        await fs.writeFile(tsconfigPath, JSON.stringify({ compilerOptions: { noImplicitAny: false } }, null, 2));

        const finding: ScanFinding = {
          id: "tsconfig-no-implicit-any-1",
          file: "tsconfig.json",
          category: "config-tsconfig",
          severity: "warn",
          message: "tsconfig has disabled noImplicitAny",
        };

        const fixes = await planConfigFix(finding, ctx);
        const fix = fixes![0]!;
        await fix.apply();

        const content = await fs.readFile(tsconfigPath, "utf-8");
        expect(content).toContain('"noImplicitAny": true');
      });

      it("should handle missing tsconfig.json gracefully", async () => {
        const finding: ScanFinding = {
          id: "tsconfig-missing",
          file: "tsconfig.json",
          category: "config-tsconfig",
          severity: "warn",
          message: "strict mode disabled",
        };

        const fixes = await planConfigFix(finding, ctx);
        const fix = fixes![0]!;
        const res = await fix.apply();
        expect(res.success).toBe(false);
        expect(res.error).toContain("tsconfig.json not found");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(false);
      });
    });

    describe("CI workflow action upgrades", () => {
      it("should upgrade actions/checkout@v1 and @v2 to @v4 in workflow files", async () => {
        const wfPath = path.join(tmpDir, ".github/workflows/ci.yml");
        await fs.mkdir(path.dirname(wfPath), { recursive: true });
        await fs.writeFile(
          wfPath,
          "name: CI\njobs:\n  build:\n    steps:\n      - uses: actions/checkout@v2\n",
        );

        const finding: ScanFinding = {
          id: "ci-outdated-1",
          file: ".github/workflows/ci.yml",
          category: "config-ci",
          severity: "warn",
          message: "Outdated GitHub Action actions/checkout@v2",
        };

        const fixes = await planConfigFix(finding, ctx);
        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const content = await fs.readFile(wfPath, "utf-8");
        expect(content).toContain("actions/checkout@v4");
        expect(content).not.toContain("actions/checkout@v2");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });

      it("should handle missing workflow file during CI upgrade", async () => {
        const finding: ScanFinding = {
          id: "ci-outdated-missing",
          file: ".github/workflows/missing.yml",
          category: "config-ci",
          severity: "warn",
          message: "Outdated GitHub Action",
        };

        const fixes = await planConfigFix(finding, ctx);
        const fix = fixes![0]!;
        const res = await fix.apply();
        expect(res.success).toBe(false);
        expect(res.error).toContain("not found");
      });
    });
  });

  describe("planDependencyFix", () => {
    describe("Unused dependency removal", () => {
      it("should remove unused dependency from package.json", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.writeFile(
          pkgPath,
          JSON.stringify({
            name: "my-app",
            dependencies: { lodash: "^4.17.21", express: "^4.18.2" },
          }, null, 2),
        );

        const finding: ScanFinding = {
          id: "dep-unused-lodash",
          file: "package.json",
          category: "dep-unused",
          severity: "warn",
          message: "Unused dependency 'lodash' declared in package.json",
        };

        const fixes = await planDependencyFix(finding, ctx);
        expect(fixes!.length).toBe(1);

        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const content = await fs.readFile(pkgPath, "utf-8");
        const parsed = JSON.parse(content);
        expect(parsed.dependencies.lodash).toBeUndefined();
        expect(parsed.dependencies.express).toBeDefined();

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });

      it("should handle missing package.json during unused dependency removal", async () => {
        const finding: ScanFinding = {
          id: "dep-unused-missing",
          file: "package.json",
          category: "dep-unused",
          severity: "warn",
          message: "Unused dependency 'axios'",
        };

        const fixes = await planDependencyFix(finding, ctx);
        const fix = fixes![0]!;
        const res = await fix.apply();
        expect(res.success).toBe(false);
        expect(res.error).toContain("package.json not found");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(false);
      });
    });

    describe("Duplicate dependency cleanup", () => {
      it("should deduplicate dependencies appearing in both dependencies and devDependencies", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.writeFile(
          pkgPath,
          JSON.stringify({
            name: "my-app",
            dependencies: { typescript: "^5.0.0", express: "^4.18.2" },
            devDependencies: { typescript: "^5.0.0", vitest: "^1.0.0" },
          }, null, 2),
        );

        const finding: ScanFinding = {
          id: "dep-duplicate-1",
          file: "package.json",
          category: "dep-duplicate",
          severity: "warn",
          message: "Duplicate dependencies across dependencies and devDependencies",
        };

        const fixes = await planDependencyFix(finding, ctx);
        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const content = await fs.readFile(pkgPath, "utf-8");
        const parsed = JSON.parse(content);
        expect(parsed.dependencies.typescript).toBeDefined();
        expect(parsed.devDependencies.typescript).toBeUndefined();
        expect(parsed.devDependencies.vitest).toBeDefined();

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });
    });

    describe("Outdated / Vulnerable dependency bump", () => {
      it("should update dependency target version in package.json", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.writeFile(
          pkgPath,
          JSON.stringify({
            name: "my-app",
            dependencies: { axios: "~0.21.1" },
          }, null, 2),
        );

        const finding: ScanFinding = {
          id: "dep-vulnerable-axios",
          file: "package.json",
          category: "dep-vulnerable",
          severity: "critical",
          message: "Vulnerable dependency 'axios' detected",
        };

        const fixes = await planDependencyFix(finding, ctx);
        const fix = fixes![0]!;
        const applyRes = await fix.apply();
        expect(applyRes.success).toBe(true);

        const content = await fs.readFile(pkgPath, "utf-8");
        const parsed = JSON.parse(content);
        expect(parsed.dependencies.axios).toBe("^0.21.1");

        const verifyRes = await fix.verify();
        expect(verifyRes.passed).toBe(true);
      });
    });
  });
});
