import { describe, it, expect } from "vitest";
import { createExtractCtx } from "../../src/core/facts/extractor.js";
import { CoverageRecorder } from "../../src/core/facts/coverage.js";
import type { IngestedFile } from "../../src/core/ingest/limits.js";
import {
  buildCrossPage,
  buildCrudFlow,
  detectUserFlows,
} from "../../src/core/project-model/extractors/flows.js";
import type {
  ComponentModel,
  RouteModel,
  ApiEndpointModel,
  ProjectModel,
} from "../../src/core/project-model/types.js";
import { detectFlowsInFile } from "../../src/core/product/flows.js";
import { uxFlow001, uxFlow002 } from "../../src/core/rules/ux/flows.js";

describe("Facts & User Flows In-Depth", () => {
  describe("Facts Extractor Context", () => {
    it("should parse and cache AST for valid TypeScript/JavaScript files", () => {
      const coverage = new CoverageRecorder();
      const ctx = createExtractCtx(coverage);

      const code = 'export const greeting: string = "hello world";';
      const file: IngestedFile = {
        path: "src/greet.ts",
        bytes: Buffer.from(code, "utf8"),
        skipped: false,
      };

      const ast1 = ctx.parseAst(file);
      expect(ast1).not.toBeNull();
      expect(ast1?.type).toBe("File");

      // Verify AST caching: repeated call returns exact same AST reference
      const ast2 = ctx.parseAst(file);
      expect(ast2).toBe(ast1);
    });

    it("should record parse failure in coverage when given invalid syntax", () => {
      const coverage = new CoverageRecorder();
      const ctx = createExtractCtx(coverage);

      const corruptCode = "const foo = { unclosed_bracket: ";
      const file: IngestedFile = {
        path: "src/broken.ts",
        bytes: Buffer.from(corruptCode, "utf8"),
        skipped: false,
      };

      const ast = ctx.parseAst(file);
      expect(ast).toBeNull();
    });

    it("should return null immediately for skipped files", () => {
      const coverage = new CoverageRecorder();
      const ctx = createExtractCtx(coverage);

      const file: IngestedFile = {
        path: "src/oversized.ts",
        bytes: Buffer.from("console.log('hi');"),
        skipped: true,
        skipReason: "file-size-limit",
      };

      const ast = ctx.parseAst(file);
      expect(ast).toBeNull();
    });
  });

  describe("Cross-Page Model & Terminology Inconsistencies", () => {
    it("should detect terminology inconsistencies when different action verbs represent the same concept", () => {
      const components: ComponentModel[] = [
        {
          name: "UserList",
          file: "src/components/UserList.tsx",
          line: 10,
          framework: "react",
          isPage: true,
          isForm: false,
          hasLoadingState: false,
          hasErrorState: false,
          hasSuccessState: false,
          hasDisabledState: false,
          hasEmptyState: false,
          ctaTexts: ["Create User"],
          headings: ["Users"],
          formFields: [],
        },
        {
          name: "ProjectList",
          file: "src/components/ProjectList.tsx",
          line: 25,
          framework: "react",
          isPage: true,
          isForm: false,
          hasLoadingState: false,
          hasErrorState: false,
          hasSuccessState: false,
          hasDisabledState: false,
          hasEmptyState: false,
          ctaTexts: ["Add Project", "New Project"],
          headings: ["Projects"],
          formFields: [],
        },
      ];

      const crossPage = buildCrossPage(components, []);
      expect(crossPage.pageCtaTexts.size).toBe(2);

      // 'Create User', 'Add Project', 'New Project' all map to the 'create' concept bucket
      const createInconsistency = crossPage.terminologyInconsistencies.find(
        (t) => t.concept === "create",
      );
      expect(createInconsistency).toBeDefined();
      expect(createInconsistency?.variants.length).toBeGreaterThan(1);
    });

    it("should return empty terminology inconsistencies when vocabulary is consistent", () => {
      const components: ComponentModel[] = [
        {
          name: "PageA",
          file: "src/PageA.tsx",
          line: 5,
          framework: "react",
          isPage: true,
          isForm: false,
          hasLoadingState: false,
          hasErrorState: false,
          hasSuccessState: false,
          hasDisabledState: false,
          hasEmptyState: false,
          ctaTexts: ["Submit Form"],
          headings: [],
          formFields: [],
        },
      ];

      const crossPage = buildCrossPage(components, []);
      expect(crossPage.terminologyInconsistencies).toHaveLength(0);
    });
  });

  describe("CRUD Flow & User Flow Detection", () => {
    it("should construct CRUD flow with detected and missing states", () => {
      const endpoints: ApiEndpointModel[] = [
        {
          method: "POST",
          path: "/api/posts",
          file: "src/api/posts.ts",
          line: 15,
          hasAuth: true,
        },
      ];

      const components: ComponentModel[] = [
        {
          name: "PostForm",
          file: "src/components/PostForm.tsx",
          line: 20,
          framework: "react",
          isPage: false,
          isForm: true,
          hasLoadingState: true,
          hasErrorState: true,
          hasSuccessState: false,
          hasDisabledState: true,
          hasEmptyState: false,
          ctaTexts: ["Publish"],
          headings: [],
          formFields: [],
        },
      ];

      const flow = buildCrudFlow(endpoints, components);
      expect(flow.name).toBe("crud");
      expect(flow.detectedStates.some((s) => s.name === "entry")).toBe(true);
      expect(flow.detectedStates.some((s) => s.name === "loading")).toBe(true);
      expect(flow.detectedStates.some((s) => s.name === "error")).toBe(true);
      expect(flow.detectedStates.some((s) => s.name === "disabled")).toBe(true);

      // Missing 'success' and 'validation-error'
      expect(flow.missingStates).toContain("success");
      expect(flow.missingStates).toContain("validation-error");
    });

    it("should detect both auth flows and write endpoint CRUD flows", () => {
      const routes: RouteModel[] = [
        { path: "/login", file: "src/pages/login.tsx", line: 1, type: "auth" },
        { path: "/dashboard", file: "src/pages/dashboard.tsx", line: 1, type: "page" },
      ];
      const components: ComponentModel[] = [];
      const apiEndpoints: ApiEndpointModel[] = [
        { method: "DELETE", path: "/api/items/:id", file: "src/routes/items.ts", line: 40, hasAuth: true },
      ];

      const flows = detectUserFlows(routes, components, apiEndpoints);
      expect(flows.length).toBe(2);
      expect(flows.some((f) => f.name === "auth")).toBe(true);
      expect(flows.some((f) => f.name === "crud")).toBe(true);
    });
  });

  describe("Finite State Product Flow Templates (File Analysis)", () => {
    it("should detect upload flow and identify missing retry state", () => {
      const uploadCode = `
        import React, { useState } from 'react';
        export function FileUploader() {
          const [uploading, setUploading] = useState(false);
          const [uploadedUrl, setUploadedUrl] = useState('');
          const [uploadError, setUploadError] = useState('');
          const handleUpload = (e) => {
            const file = e.target.files[0];
          };
          return (
            <div>
              <input type="file" onChange={handleUpload} />
              {uploading && <span>Uploading...</span>}
              {uploadedUrl && <span>Upload successful!</span>}
              {uploadError && <span>Upload failed</span>}
            </div>
          );
        }
      `;

      const flows = detectFlowsInFile("src/components/FileUploader.tsx", uploadCode);
      expect(flows.length).toBe(1);

      const uploadFlow = flows[0]!;
      expect(uploadFlow.template).toBe("upload");
      expect(uploadFlow.stagesFound).toContain("select");
      expect(uploadFlow.stagesFound).toContain("uploading");
      expect(uploadFlow.stagesFound).toContain("success");
      expect(uploadFlow.stagesFound).toContain("error");
      expect(uploadFlow.stagesMissing).toContain("retry");
    });

    it("should detect destructive delete flow and verify confirmation stage", () => {
      const deleteCode = `
        export function DeleteButton({ id }) {
          const handleDelete = async () => {
            if (confirm("Are you sure?")) {
              await api.delete(id);
              toast.success("Deleted!");
            }
          };
          return <Button onClick={handleDelete}>Delete Item</Button>;
        }
      `;

      const flows = detectFlowsInFile("src/components/DeleteButton.tsx", deleteCode);
      expect(flows.length).toBe(1);

      const deleteFlow = flows[0]!;
      expect(deleteFlow.template).toBe("delete");
      expect(deleteFlow.stagesFound).toContain("trigger");
      expect(deleteFlow.stagesFound).toContain("confirm");
      expect(deleteFlow.stagesFound).toContain("success");
    });
  });

  describe("UX Completeness Rules (uxFlow001, uxFlow002)", () => {
    it("UX-FLOW-001 should flag upload flow missing progress or error handling", () => {
      const mockModel: ProjectModel = {
        rootDir: "/app",
        framework: "next",
        routes: [],
        components: [],
        apiEndpoints: [],
        totalFilesScanned: 5,
        scanDurationMs: 10,
        userFlows: [
          {
            name: "upload",
            entryPoints: [{ file: "src/upload.tsx", line: 12 }],
            detectedStates: [{ name: "entry", location: { file: "src/upload.tsx", line: 12 } }],
            missingStates: ["loading", "error"],
          },
        ],
      };

      const findings = uxFlow001.detect(mockModel);
      expect(findings.length).toBe(1);
      expect(findings[0]!.ruleId).toBe("UX-FLOW-001");
      expect(findings[0]!.title).toContain("File Upload Flow Lacks Asynchronous Progress");
    });

    it("UX-FLOW-001 should flag payment/checkout flow missing loading or error states", () => {
      const mockModel: ProjectModel = {
        rootDir: "/app",
        framework: "next",
        routes: [],
        components: [],
        apiEndpoints: [],
        totalFilesScanned: 5,
        scanDurationMs: 10,
        userFlows: [
          {
            name: "checkout",
            entryPoints: [{ file: "src/checkout.tsx", line: 50 }],
            detectedStates: [{ name: "entry", location: { file: "src/checkout.tsx", line: 50 } }],
            missingStates: ["loading", "error"],
          },
        ],
      };

      const findings = uxFlow001.detect(mockModel);
      expect(findings.length).toBe(1);
      expect(findings[0]!.severity).toBe("critical");
      expect(findings[0]!.title).toContain("Payment/Checkout Flow Missing Loading");
    });

    it("UX-FLOW-001 should flag delete flow missing confirmation guard", () => {
      const mockModel: ProjectModel = {
        rootDir: "/app",
        framework: "next",
        routes: [],
        components: [],
        apiEndpoints: [],
        totalFilesScanned: 5,
        scanDurationMs: 10,
        userFlows: [
          {
            name: "delete",
            entryPoints: [{ file: "src/delete-user.tsx", line: 30 }],
            detectedStates: [{ name: "entry", location: { file: "src/delete-user.tsx", line: 30 } }],
            missingStates: ["confirmation"],
          },
        ],
      };

      const findings = uxFlow001.detect(mockModel);
      expect(findings.length).toBe(1);
      expect(findings[0]!.severity).toBe("high");
      expect(findings[0]!.title).toContain("Destructive Delete Flow Missing Confirmation Guard");
    });

    it("UX-FLOW-002 should flag multi-input form lacking validation error messages", () => {
      const mockModel: ProjectModel = {
        rootDir: "/app",
        framework: "react",
        routes: [],
        components: [
          {
            name: "RegistrationForm",
            file: "src/Register.tsx",
            line: 15,
            framework: "react",
            isPage: true,
            isForm: true,
            hasLoadingState: true,
            hasErrorState: false,
            hasSuccessState: false,
            hasDisabledState: false,
            hasEmptyState: false,
            ctaTexts: ["Submit"],
            headings: [],
            formFields: [
              { name: "email", type: "email", hasLabel: true, hasErrorMessage: false },
              { name: "password", type: "password", hasLabel: true, hasErrorMessage: false },
            ],
          },
        ],
        apiEndpoints: [],
        totalFilesScanned: 5,
        scanDurationMs: 10,
      };

      const findings = uxFlow002.detect(mockModel);
      expect(findings.length).toBe(1);
      expect(findings[0]!.ruleId).toBe("UX-FLOW-002");
      expect(findings[0]!.title).toContain("RegistrationForm");
    });
  });
});
