import { describe, it, expect } from "vitest";
import path from "node:path";
import { performApiScan } from "../../src/core/api-scan/index.js";
import { detectApiRoutes } from "../../src/core/api-scan/route-detector.js";
import { detectMassAssignment } from "../../src/core/api-scan/mass-assignment.js";
import { detectMethodAllowlisting } from "../../src/core/api-scan/method-allowlist.js";
import { detectContentValidation } from "../../src/core/api-scan/content-validation.js";
import { detectExposedDocs } from "../../src/core/api-scan/docs-exposed.js";
import { detectSensitiveSchemaExposure } from "../../src/core/api-scan/schema-exposure.js";

const FIXTURE_DIR = path.resolve(__dirname, "../fixtures/vulnerable-api-app");

describe("API Security Scan Engine", () => {
  it("should detect Express, Next.js, and OpenAPI routes", async () => {
    const routes = await detectApiRoutes(FIXTURE_DIR);
    expect(routes.length).toBeGreaterThan(0);
    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/api/users");
    expect(paths).toContain("/api/users/wildcard");
  });

  it("should flag critical mass assignment risk when model contains sensitive isAdmin field", async () => {
    const { findings } = await performApiScan(FIXTURE_DIR);
    const massAssignFinding = findings.find((f) => f.category === "api-mass-assignment");
    expect(massAssignFinding).toBeDefined();
    expect(massAssignFinding?.severity).toBe("critical");
    expect(massAssignFinding?.message).toContain("Mass assignment risk");
  });

  it("should flag wildcard HTTP method allowlisting warning", async () => {
    const { findings } = await performApiScan(FIXTURE_DIR);
    const methodFinding = findings.find((f) => f.category === "api-wildcard-method");
    expect(methodFinding).toBeDefined();
    expect(methodFinding?.severity).toBe("warning");
    expect(methodFinding?.message).toContain("Wildcard HTTP method");
  });

  it("should flag missing request body content validation on write endpoints", async () => {
    const { findings } = await performApiScan(FIXTURE_DIR);
    const valFinding = findings.find((f) => f.category === "api-missing-validation");
    expect(valFinding).toBeDefined();
    expect(valFinding?.severity).toBe("warning");
  });

  it("should flag exposed API documentation without production guard", async () => {
    const { findings } = await performApiScan(FIXTURE_DIR);
    const docsFinding = findings.find((f) => f.category === "api-exposed-docs");
    expect(docsFinding).toBeDefined();
    expect(docsFinding?.severity).toBe("warning");
    expect(docsFinding?.message).toContain("Interactive API documentation enabled");
  });

  it("should flag sensitive field password in OpenAPI response schema", async () => {
    const { findings } = await performApiScan(FIXTURE_DIR);
    const schemaFinding = findings.find((f) => f.category === "api-sensitive-exposure");
    expect(schemaFinding).toBeDefined();
    expect(schemaFinding?.severity).toBe("critical");
    expect(schemaFinding?.message).toContain("password");
  });

  it("should format findings with five-question AI explanation structure", async () => {
    const { findings } = await performApiScan(FIXTURE_DIR);
    for (const f of findings) {
      expect(f.aiExplanation).toBeDefined();
      expect(f.aiExplanation?.whatIsIt).toBeTruthy();
      expect(f.aiExplanation?.whyIsItAProblem).toBeTruthy();
      expect(f.aiExplanation?.howToFix).toBeTruthy();
    }
  });

  it("should detect Next.js App, Next.js Pages, Fastify, FastAPI, Django, and Rails routes", async () => {
    const syntheticFiles = [
      {
        path: "src/app/api/products/[id]/route.ts",
        content: `
          export async function GET(req: Request) { return Response.json({ id: 1 }); }
          export async function DELETE(req: Request) { return Response.json({ ok: true }); }
        `,
      },
      {
        path: "pages/api/orders.ts",
        content: `
          export default function handler(req, res) {
            if (req.method === 'POST') { res.status(201).json({}); }
            else if (req.method === 'GET') { res.json([]); }
          }
        `,
      },
      {
        path: "src/server.ts",
        content: `
          fastify.get('/api/health', async () => ({ status: 'ok' }));
          fastify.post('/api/auth/login', async () => ({ token: 'abc' }));
        `,
      },
      {
        path: "main.py",
        content: `
          @app.get("/items/{item_id}")
          def read_item(item_id: int):
              return {"item_id": item_id}

          @router.post("/items")
          def create_item():
              return {"ok": True}
        `,
      },
      {
        path: "urls.py",
        content: `
          urlpatterns = [
              path('api/v1/users/', views.UserList.as_view()),
          ]
        `,
      },
      {
        path: "config/routes.rb",
        content: `
          Rails.application.routes.draw do
            resources :articles
            get '/ping', to: 'status#ping'
          end
        `,
      },
    ];

    const routes = await detectApiRoutes("/mock/root", syntheticFiles);
    expect(routes.length).toBeGreaterThan(5);

    const frameworks = new Set(routes.map((r) => r.framework));
    expect(frameworks.has("nextjs")).toBe(true);
    expect(frameworks.has("fastify")).toBe(true);
    expect(frameworks.has("fastapi")).toBe(true);
    expect(frameworks.has("django")).toBe(true);
    expect(frameworks.has("rails")).toBe(true);
  });
});
