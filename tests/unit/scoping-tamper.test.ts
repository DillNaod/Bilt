import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { simpleGit } from "simple-git";
import {
  parseChangedLinesFromDiff,
  isFindingIntroducedByChange,
  getGitScope,
} from "../../src/core/scoping/git-scope.js";
import {
  analyzeConfigDiff,
  detectTampering,
} from "../../src/core/trust/tamper.js";

describe("Scoping and Tamper Detection", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-scoping-tamper-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("git-scope", () => {
    it("parses unified diff hunks correctly", () => {
      const sampleDiff = `
diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,3 +10,5 @@
 const x = 1;
+const y = 2;
+const z = 3;
diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,4 @@
+export const hello = 'world';
`;

      const { fileChangedLines, newFiles } = parseChangedLinesFromDiff(sampleDiff);

      expect(newFiles.has("src/new-file.ts")).toBe(true);
      expect(fileChangedLines.has("src/app.ts")).toBe(true);

      const appLines = fileChangedLines.get("src/app.ts")!;
      expect(appLines.has(10)).toBe(true);
      expect(appLines.has(11)).toBe(true);
    });

    it("evaluates isFindingIntroducedByChange", () => {
      const scope = {
        changedFiles: new Set(["src/server.ts"]),
        changedLines: new Map([["src/server.ts", new Set([42])]]),
        newFiles: new Set(["src/brand-new.ts"]),
      };

      // No scope -> returns true
      expect(isFindingIntroducedByChange("any/file.ts", 10, null)).toBe(true);

      // Test files / fixtures -> returns false (not considered introduced prod vuln)
      expect(isFindingIntroducedByChange("tests/unit/test.ts", 5, scope)).toBe(false);
      expect(isFindingIntroducedByChange("src/fixtures/mock.ts", 5, scope)).toBe(false);

      // New files -> returns true
      expect(isFindingIntroducedByChange("src/brand-new.ts", 10, scope)).toBe(true);

      // Modified file, matching line -> true
      expect(isFindingIntroducedByChange("src/server.ts", 42, scope)).toBe(true);

      // Modified file, non-matching line -> false
      expect(isFindingIntroducedByChange("src/server.ts", 99, scope)).toBe(false);

      // Unchanged file -> false
      expect(isFindingIntroducedByChange("src/other.ts", 10, scope)).toBe(false);
    });

    it("handles getGitScope for git repository and non-repo", async () => {
      // Non-repo returns null
      const nonRepoScope = await getGitScope(tmpDir, { changed: true });
      expect(nonRepoScope).toBeNull();

      // No options returns null
      const noOptScope = await getGitScope(tmpDir, {});
      expect(noOptScope).toBeNull();

      // Initialize real git repo
      const git = simpleGit(tmpDir);
      await git.init();
      await git.addConfig("user.name", "Bilt Tester");
      await git.addConfig("user.email", "tester@bilt.dev");

      await fs.writeFile(path.join(tmpDir, "initial.txt"), "hello");
      await git.add(".");
      await git.commit("Initial commit");

      // Add a new file and modify existing
      await fs.writeFile(path.join(tmpDir, "initial.txt"), "hello\nworld");
      await fs.writeFile(path.join(tmpDir, "untracked.ts"), "export const x = 1;");

      const repoScope = await getGitScope(tmpDir, { changed: true });
      expect(repoScope).not.toBeNull();
      expect(repoScope?.changedFiles.has("initial.txt")).toBe(true);
      expect(repoScope?.newFiles.has("untracked.ts")).toBe(true);
    });
  });

  describe("tamper detection", () => {
    it("analyzes config diff to detect broad ignores, downgrades, and deletions", () => {
      const diff = `
+ "src/**"
+ "RULE-SEC-001": "off"
- "SEC-AUTH-001"
`;

      const result = analyzeConfigDiff(diff);
      expect(result.addedIgnores).toContain("src/**");
      expect(result.severityDowngrades.some((d) => d.ruleId === "RULE-SEC-001" && d.to === "off")).toBe(true);
      expect(result.disabledRules).toContain("SEC-AUTH-001");
    });

    it("detectTampering finds changes in config files", async () => {
      const git = simpleGit(tmpDir);
      await git.init();
      await git.addConfig("user.name", "Bilt Tester");
      await git.addConfig("user.email", "tester@bilt.dev");

      // Initial commit with standard .biltrc.json
      await fs.writeFile(
        path.join(tmpDir, ".biltrc.json"),
        JSON.stringify({ rules: { "RULE-SEC-001": "critical" } }, null, 2),
      );
      await git.add(".");
      await git.commit("Initial config");

      // Commit 2: Agent tries to tamper by downgrading rule and adding broad ignore
      await fs.writeFile(
        path.join(tmpDir, ".biltrc.json"),
        JSON.stringify({
          ignore: ["src/**"],
          rules: { "RULE-SEC-001": "off" },
        }, null, 2),
      );

      const findings = await detectTampering(tmpDir, "HEAD");
      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some((f) => f.rule_id === "TAMPER-BROAD-IGNORE")).toBe(true);
    });
  });
});
