import path from "node:path";
import { promises as fs } from "node:fs";
import type { Fix, ScanFinding } from "../../../types/index.js";
import type { FixPlanContext } from "./context.js";
import { addToGitignore, addMissingEnvVars } from "../../../core/fix/env-fix.js";

export async function planPluginsAndApiFix(
  finding: ScanFinding,
  ctx: FixPlanContext,
): Promise<Fix[] | null> {
  const actions: Fix[] = [];

  switch (finding.category) {
    case "plugin-finding": {
      if (finding.id.startsWith("docker-no-dockerignore") || finding.id.startsWith("docker-dockerignore-env")) {
        if (!ctx.addedTypes.has("dockerignore")) {
          ctx.addedTypes.add("dockerignore");
          actions.push({
            id: `fix-dockerignore-${Date.now()}`,
            description: "Create or update .dockerignore with .env and build artifacts",
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: ["Add .env*, node_modules, .git to .dockerignore"],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              const dockerignorePath = path.join(ctx.rootDir, ".dockerignore");
              let content = "";
              try {
                content = await fs.readFile(dockerignorePath, "utf-8");
              } catch {}
              const entries = [".env", ".env.*", "node_modules", ".git", ".bilt"];
              const existing = new Set(content.split("\n").map((l) => l.trim()));
              const toAdd = entries.filter((e) => !existing.has(e));
              const newContent =
                content +
                (content && !content.endsWith("\n") ? "\n" : "") +
                "# Added by bilt\n" +
                toAdd.join("\n") +
                "\n";
              await ctx.writeFile(dockerignorePath, newContent, content);
              return { success: true, stepsApplied: ["Updated .dockerignore with .env and build artifact exclusions"] };
            },
            verify: async () => {
              const dockerignorePath = path.join(ctx.rootDir, ".dockerignore");
              try {
                const content = await fs.readFile(dockerignorePath, "utf-8");
                if (content.includes(".env")) return { passed: true, message: "Verified .dockerignore updated." };
              } catch {}
              return { passed: false, message: ".dockerignore not properly configured." };
            },
            undo: async () => {},
          });
        }
      } else if (finding.id.startsWith("terraform-gitignore")) {
        if (!ctx.addedTypes.has("terraform-gitignore")) {
          ctx.addedTypes.add("terraform-gitignore");
          actions.push({
            id: `fix-tf-gitignore-${Date.now()}`,
            description: "Add Terraform state & tfvars patterns to .gitignore",
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: ["Append *.tfvars, *.tfvars.json, .terraform/ to .gitignore"],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              const gitignorePath = path.join(ctx.rootDir, ".gitignore");
              const newContent = await addToGitignore(
                ["*.tfvars", "*.tfvars.json", ".terraform/"],
                gitignorePath,
              );
              let oldContent = "";
              try {
                oldContent = await fs.readFile(gitignorePath, "utf-8");
              } catch {}
              await ctx.writeFile(gitignorePath, newContent, oldContent);
              return { success: true, stepsApplied: ["Appended Terraform patterns to .gitignore"] };
            },
            verify: async () => {
              const gitignorePath = path.join(ctx.rootDir, ".gitignore");
              try {
                const content = await fs.readFile(gitignorePath, "utf-8");
                if (content.includes("*.tfvars")) return { passed: true, message: "Verified .gitignore updated for Terraform." };
              } catch {}
              return { passed: false, message: ".gitignore not updated for Terraform." };
            },
            undo: async () => {},
          });
        }
      } else if (finding.id.startsWith("prisma-hardcoded") || finding.id.startsWith("prisma-missing-env")) {
        if (!ctx.addedTypes.has("prisma-hardcoded")) {
          ctx.addedTypes.add("prisma-hardcoded");
          actions.push({
            id: `fix-prisma-env-${Date.now()}`,
            description: 'Migrate hardcoded Prisma connection string to env("DATABASE_URL")',
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: ['Update url in prisma/schema.prisma to env("DATABASE_URL") and add to .env'],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              const schemaPath = path.join(ctx.rootDir, "prisma/schema.prisma");
              let content = "";
              try {
                content = await fs.readFile(schemaPath, "utf-8");
              } catch {
                return { success: false, stepsApplied: [], error: "prisma/schema.prisma not found" };
              }
              const newContent = content.replace(/url\s*=\s*(?:"[^"]+"|'[^']+')/g, 'url = env("DATABASE_URL")');
              await ctx.writeFile(schemaPath, newContent, content);

              const envPath = path.join(ctx.rootDir, ".env");
              let envContent = "";
              try {
                envContent = await fs.readFile(envPath, "utf-8");
              } catch {}
              const updatedEnv = addMissingEnvVars(envContent, ["DATABASE_URL"]);
              await ctx.writeFile(envPath, updatedEnv, envContent);

              return {
                success: true,
                stepsApplied: ['Migrated Prisma datasource URL to env("DATABASE_URL") and updated .env'],
              };
            },
            verify: async () => {
              const schemaPath = path.join(ctx.rootDir, "prisma/schema.prisma");
              try {
                const content = await fs.readFile(schemaPath, "utf-8");
                if (content.includes('env("DATABASE_URL")')) {
                  return { passed: true, message: 'Verified Prisma schema uses env("DATABASE_URL").' };
                }
              } catch {}
              return { passed: false, message: "Prisma schema still uses hardcoded URL." };
            },
            undo: async () => {},
          });
        }
      }
      return actions;
    }

    case "api-exposed-docs": {
      const targetFile = finding.file;
      if (targetFile && !ctx.addedTypes.has(`api-exposed-docs-${targetFile}`)) {
        ctx.addedTypes.add(`api-exposed-docs-${targetFile}`);
        actions.push({
          id: `fix-api-docs-${Date.now()}`,
          description: `Wrap API documentation route in environment check in ${targetFile}`,
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: [`Add 'if (process.env.NODE_ENV !== "production")' guard around API docs route in ${targetFile}`],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const filePath = path.join(ctx.rootDir, targetFile);
            let content = "";
            try {
              content = await fs.readFile(filePath, "utf-8");
            } catch {
              return { success: false, stepsApplied: [], error: `${targetFile} not found` };
            }
            const lines = content.split("\n");
            const newLines: string[] = [];
            let guarded = false;
            for (const l of lines) {
              if (
                !guarded &&
                (l.includes("/docs") || l.includes("/swagger") || l.includes("/api-docs") || l.includes("/graphiql")) &&
                (l.includes(".use(") || l.includes(".get("))
              ) {
                newLines.push(`if (process.env.NODE_ENV !== "production") {`);
                newLines.push(`  ${l}`);
                newLines.push(`}`);
                guarded = true;
              } else {
                newLines.push(l);
              }
            }
            const newContent = newLines.join("\n");
            await ctx.writeFile(filePath, newContent, content);
            return { success: true, stepsApplied: [`Wrapped API docs route in production environment check in ${targetFile}`] };
          },
          verify: async () => {
            const filePath = path.join(ctx.rootDir, targetFile);
            try {
              const content = await fs.readFile(filePath, "utf-8");
              if (
                content.includes("process.env.NODE_ENV !== 'production'") ||
                content.includes('process.env.NODE_ENV !== "production"')
              ) {
                return { passed: true, message: "Verified API docs route is environment guarded." };
              }
            } catch {}
            return { passed: false, message: "API docs route not guarded." };
          },
          undo: async () => {},
        });
      }
      return actions;
    }

    case "api-wildcard-method": {
      const targetFile = finding.file;
      if (targetFile && !ctx.addedTypes.has(`api-wildcard-${targetFile}`)) {
        ctx.addedTypes.add(`api-wildcard-${targetFile}`);
        actions.push({
          id: `fix-api-wildcard-${Date.now()}`,
          description: `Replace wildcard HTTP method handler with explicit methods in ${targetFile}`,
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: [`Replace app.all / router.all with explicit route handler in ${targetFile}`],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const filePath = path.join(ctx.rootDir, targetFile);
            let content = "";
            try {
              content = await fs.readFile(filePath, "utf-8");
            } catch {
              return { success: false, stepsApplied: [], error: `${targetFile} not found` };
            }
            const newContent = content
              .replace(/\bapp\.all\(/g, "app.get(")
              .replace(/\brouter\.all\(/g, "router.get(");
            await ctx.writeFile(filePath, newContent, content);
            return { success: true, stepsApplied: [`Replaced wildcard route handlers with explicit HTTP methods in ${targetFile}`] };
          },
          verify: async () => {
            const filePath = path.join(ctx.rootDir, targetFile);
            try {
              const content = await fs.readFile(filePath, "utf-8");
              if (!content.includes(".all(")) return { passed: true, message: "Verified wildcard route handlers replaced." };
            } catch {}
            return { passed: false, message: "Wildcard route handler still present." };
          },
          undo: async () => {},
        });
      }
      return actions;
    }

    default:
      return null;
  }
}
