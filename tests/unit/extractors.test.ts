import { describe, it, expect } from "vitest";
import { extractAuthorizationPatterns } from "../../src/core/project-model/extractors/authorization.js";
import type { ApiEndpointModel } from "../../src/core/project-model/types.js";

describe("Project Model Extractors", () => {
  describe("extractAuthorizationPatterns", () => {
    it("identifies role checks, ownership checks, tenant checks, and unprotected mutations", () => {
      const endpoints: ApiEndpointModel[] = [
        {
          path: "/api/admin/users",
          file: "src/routes/admin.ts",
          method: "DELETE",
          handlerContent: "if (!req.user.isAdmin || !req.user.hasRole('admin')) return 403;",
          hasAuthCheck: true,
          hasOwnershipCheck: false,
          hasInputValidation: true,
          passesBodyToDb: false,
          sensitiveFieldsReturned: [],
        },
        {
          path: "/api/projects/:id",
          file: "src/routes/projects.ts",
          method: "PUT",
          handlerContent: "if (project.ownerId !== req.user.userId) throw new Error('Forbidden');",
          hasAuthCheck: true,
          hasOwnershipCheck: true,
          hasInputValidation: true,
          passesBodyToDb: false,
          sensitiveFieldsReturned: [],
        },
        {
          path: "/api/tenants/:orgId/data",
          file: "src/routes/tenants.ts",
          method: "POST",
          handlerContent: "const data = await db.find({ orgId: req.params.orgId, workspaceId: req.user.workspaceId });",
          hasAuthCheck: true,
          hasOwnershipCheck: false,
          hasInputValidation: true,
          passesBodyToDb: false,
          sensitiveFieldsReturned: [],
        },
        {
          path: "/api/posts",
          file: "src/routes/posts.ts",
          method: "POST",
          handlerContent: "return db.insert(req.body);",
          hasAuthCheck: false, // unprotected mutation!
          hasOwnershipCheck: false,
          hasInputValidation: false,
          passesBodyToDb: true,
          sensitiveFieldsReturned: [],
        },
        {
          path: "/api/public/contact",
          file: "src/routes/public.ts",
          method: "POST",
          handlerContent: "return sendEmail(req.body);",
          hasAuthCheck: false, // public mutation, intentional
          hasOwnershipCheck: false,
          hasInputValidation: true,
          passesBodyToDb: false,
          sensitiveFieldsReturned: [],
        },
      ];

      const summary = extractAuthorizationPatterns(endpoints);

      expect(summary.roleChecksCount).toBe(1);
      expect(summary.ownershipChecksCount).toBe(1);
      expect(summary.tenantChecksCount).toBe(1);
      expect(summary.unprotectedMutations).toContain("POST /api/posts");
      // Public route should not be counted as unprotected mutation
      expect(summary.unprotectedMutations).not.toContain("POST /api/public/contact");
    });
  });
});
