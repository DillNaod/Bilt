import { describe, it, expect } from "vitest";
import {
  detectDbOperations,
  detectSensitiveFields,
  analyzeEndpoint,
  extractNextAppRouteEndpoints,
  extractNextPagesApiEndpoints,
  extractExpressEndpoints,
  extractApiEndpoints,
} from "../../src/core/project-model/extractors/api.js";

describe("Project Model API Extractor", () => {
  it("detects read, write, and delete DB operations", () => {
    const code = `
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      const post = await db.post.create({ data: req.body });
      await db.comment.delete({ where: { id: req.params.commentId } });
    `;

    const ops = detectDbOperations(code);
    expect(ops).toHaveLength(3);
    expect(ops.some((o) => o.type === "read")).toBe(true);
    expect(ops.some((o) => o.type === "write")).toBe(true);
    expect(ops.some((o) => o.type === "delete")).toBe(true);
  });

  it("detects sensitive fields", () => {
    const code = `return res.json({ id: 1, passwordHash: 'hash', token: 'jwt', ssn: '123' });`;
    const fields = detectSensitiveFields(code);
    expect(fields).toContain("passwordHash");
    expect(fields).toContain("token");
    expect(fields).toContain("ssn");
  });

  it("analyzes endpoints with different auth and validation libraries", () => {
    // 1. Session auth + zod validation
    const ep1 = analyzeEndpoint(
      "POST",
      "/api/posts",
      "src/routes/posts.ts",
      1,
      "express",
      `
        const session = await getSession(req);
        const validated = postSchema.parse(req.body);
        if (post.userId === session.user.id) {
          const { title, body } = req.body;
          await db.post.update({ where: { id: req.params.id }, data: { title, body } });
        }
      `,
    );
    expect(ep1.hasAuthCheck).toBe(true);
    expect(ep1.authCheckType).toBe("session");
    expect(ep1.hasInputValidation).toBe(true);
    expect(ep1.validationLibrary).toBe("zod");
    expect(ep1.hasOwnershipCheck).toBe(true);
    expect(ep1.hasExplicitFieldSelection).toBe(true);
    expect(ep1.passesBodyToDb).toBe(false);

    // 2. JWT auth + Joi validation + Mass assignment
    const ep2 = analyzeEndpoint(
      "PUT",
      "/api/users/:id",
      "src/routes/users.ts",
      1,
      "express",
      `
        const token = jwt.verify(req.headers.authorization);
        Joi.object().validate(req.body);
        await db.user.update(req.body);
      `,
    );
    expect(ep2.authCheckType).toBe("jwt");
    expect(ep2.validationLibrary).toBe("joi");
    expect(ep2.passesBodyToDb).toBe(true);

    // 3. Middleware auth + Yup validation
    const ep3 = analyzeEndpoint(
      "DELETE",
      "/api/items/:id",
      "src/routes/items.ts",
      1,
      "express",
      `
        // protect middleware
        yup.object().validate(req.body);
      `,
    );
    expect(ep3.authCheckType).toBe("middleware");
    expect(ep3.validationLibrary).toBe("yup");

    // 4. Unknown auth + express-validator
    const ep4 = analyzeEndpoint(
      "PATCH",
      "/api/settings",
      "src/routes/settings.ts",
      1,
      "express",
      `
        requireAuth();
        check('email').isEmail();
      `,
    );
    expect(ep4.authCheckType).toBe("unknown");
    expect(ep4.validationLibrary).toBe("express-validator");
  });

  it("extracts Next.js App, Next.js Pages, and Express endpoints", () => {
    const nextAppCode = `
      export async function GET(req) { return Response.json({ ok: true }); }
      export const POST = async (req) => { return Response.json({ created: true }); }
    `;
    const appEndpoints: any[] = [];
    extractNextAppRouteEndpoints("src/app/api/items/[id]/route.ts", nextAppCode, appEndpoints);
    expect(appEndpoints).toHaveLength(2);
    expect(appEndpoints[0].path).toBe("/api/items/:id");

    const nextPagesCode = `
      export default function handler(req, res) {
        if (req.method === 'GET') res.json([]);
        else if (req.method === 'POST') res.status(201).json({});
      }
    `;
    const pagesEndpoints: any[] = [];
    extractNextPagesApiEndpoints("pages/api/orders/index.ts", nextPagesCode, pagesEndpoints);
    expect(pagesEndpoints).toHaveLength(2);
    expect(pagesEndpoints[0].path).toBe("/api/orders");

    const expressCode = `
      app.get('/api/health', (req, res) => res.send('ok'));
      router.delete('/api/cache', (req, res) => res.send('cleared'));
    `;
    const expressEndpoints: any[] = [];
    extractExpressEndpoints("src/server.ts", expressCode, expressEndpoints);
    expect(expressEndpoints).toHaveLength(2);

    const all = extractApiEndpoints([
      { relPath: "src/app/api/v1/route.ts", absPath: "/app/src/app/api/v1/route.ts", content: "export async function GET() {}" },
      { relPath: "pages/api/test.ts", absPath: "/app/pages/api/test.ts", content: "export default function handler() {}" },
      { relPath: "src/api.ts", absPath: "/app/src/api.ts", content: "app.post('/api/save', () => {});" },
    ]);
    expect(all.length).toBeGreaterThanOrEqual(3);
  });
});
