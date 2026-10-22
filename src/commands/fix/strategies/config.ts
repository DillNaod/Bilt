import path from "node:path";
import { promises as fs } from "node:fs";
import type { Fix, ScanFinding } from "../../../types/index.js";
import type { FixPlanContext } from "./context.js";

export async function planConfigFix(
  finding: ScanFinding,
  ctx: FixPlanContext,
): Promise<Fix[] | null> {
  const actions: Fix[] = [];

  switch (finding.category) {
    case "config-docker": {
      const dockerfilePath = path.join(ctx.rootDir, finding.file);
      if (finding.message.includes("non-root USER")) {
        actions.push({
          id: `fix-docker-user-${Date.now()}`,
          description: "Add non-root USER node to Dockerfile",
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: ["Append 'USER node' before container CMD/ENTRYPOINT in Dockerfile"],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            let content = "";
            try {
              content = await fs.readFile(dockerfilePath, "utf-8");
            } catch {
              return { success: false, stepsApplied: [], error: "Dockerfile not found" };
            }
            if (!content.includes("USER ")) {
              let newContent = "";
              if (content.includes("CMD ")) {
                newContent = content.replace(/^(CMD\s+)/m, "USER node\n\n$1");
              } else if (content.includes("ENTRYPOINT ")) {
                newContent = content.replace(/^(ENTRYPOINT\s+)/m, "USER node\n\n$1");
              } else {
                newContent = content + "\nUSER node\n";
              }
              await ctx.writeFile(dockerfilePath, newContent, content);
              return { success: true, stepsApplied: ["Added 'USER node' directive to Dockerfile"] };
            }
            return { success: true, stepsApplied: ["USER directive already present in Dockerfile"] };
          },
          verify: async () => {
            try {
              const content = await fs.readFile(dockerfilePath, "utf-8");
              if (content.includes("USER ")) return { passed: true, message: "Verified USER directive in Dockerfile." };
            } catch {}
            return { passed: false, message: "USER directive missing from Dockerfile." };
          },
          undo: async () => {},
        });
      } else if (finding.message.includes("unpinned base image")) {
        actions.push({
          id: `fix-docker-pin-${Date.now()}`,
          description: "Pin Docker base image tag in Dockerfile",
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: ["Replace unpinned FROM tag with node:20-alpine"],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            let content = "";
            try {
              content = await fs.readFile(dockerfilePath, "utf-8");
            } catch {
              return { success: false, stepsApplied: [], error: "Dockerfile not found" };
            }
            const newContent = content
              .replace(/^FROM\s+node:latest/m, "FROM node:20-alpine")
              .replace(/^FROM\s+node:alpine/m, "FROM node:20-alpine");
            await ctx.writeFile(dockerfilePath, newContent, content);
            return { success: true, stepsApplied: ["Pinned Docker base image to node:20-alpine"] };
          },
          verify: async () => {
            try {
              const content = await fs.readFile(dockerfilePath, "utf-8");
              if (!content.includes("node:latest")) return { passed: true, message: "Verified base image pinned." };
            } catch {}
            return { passed: false, message: "Unpinned base image tag still present." };
          },
          undo: async () => {},
        });
      }
      return actions;
    }

    case "config-tsconfig": {
      const tsconfigPath = path.join(ctx.rootDir, "tsconfig.json");
      actions.push({
        id: `fix-tsconfig-${Date.now()}`,
        description: `Fix tsconfig setting: ${finding.message}`,
        type: "safe",
        findingId: finding.id,
        preview: async () => ({
          steps: ["Update tsconfig.json compilerOptions"],
          estimatedTime: "< 1s",
          risk: "Low",
        }),
        apply: async () => {
          let content = "";
          try {
            content = await fs.readFile(tsconfigPath, "utf-8");
          } catch {
            return { success: false, stepsApplied: [], error: "tsconfig.json not found" };
          }
          let newContent = content;
          if (finding.message.includes("strict mode")) {
            newContent = newContent.replace(/"strict"\s*:\s*false/g, '"strict": true');
          }
          if (finding.message.includes("noImplicitAny")) {
            newContent = newContent.replace(/"noImplicitAny"\s*:\s*false/g, '"noImplicitAny": true');
          }
          await ctx.writeFile(tsconfigPath, newContent, content);
          return { success: true, stepsApplied: ["Updated tsconfig.json compilerOptions"] };
        },
        verify: async () => {
          try {
            const content = await fs.readFile(tsconfigPath, "utf-8");
            if (!content.includes('"strict": false')) return { passed: true, message: "Verified tsconfig updated." };
          } catch {}
          return { passed: false, message: "tsconfig setting not updated." };
        },
        undo: async () => {},
      });
      return actions;
    }

    case "config-ci": {
      const wfPath = path.join(ctx.rootDir, finding.file);
      actions.push({
        id: `fix-ci-${Date.now()}`,
        description: `Upgrade GitHub Action version in ${finding.file}`,
        type: "safe",
        findingId: finding.id,
        preview: async () => ({
          steps: ["Upgrade actions/checkout to @v4"],
          estimatedTime: "< 1s",
          risk: "Low",
        }),
        apply: async () => {
          let content = "";
          try {
            content = await fs.readFile(wfPath, "utf-8");
          } catch {
            return { success: false, stepsApplied: [], error: `${finding.file} not found` };
          }
          const newContent = content
            .replace(/actions\/checkout@v1/g, "actions/checkout@v4")
            .replace(/actions\/checkout@v2/g, "actions/checkout@v4");
          await ctx.writeFile(wfPath, newContent, content);
          return { success: true, stepsApplied: ["Upgraded actions/checkout to @v4"] };
        },
        verify: async () => {
          try {
            const content = await fs.readFile(wfPath, "utf-8");
            if (content.includes("actions/checkout@v4")) return { passed: true, message: "Verified actions/checkout upgraded." };
          } catch {}
          return { passed: false, message: "Action version not upgraded." };
        },
        undo: async () => {},
      });
      return actions;
    }

    default:
      return null;
  }
}
