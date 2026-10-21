import { describe, it, expect } from "vitest";
import { createQueryFacade } from "../../src/core/model/query-facade.js";
import type { ProjectModel } from "../../src/core/model/project-model.js";
import { confirmed } from "../../src/core/facts/fact.js";

describe("QueryFacade (L2)", () => {
  const dummyModel: ProjectModel = {
    rootDir: "/app",
    files: [{ path: "src/index.ts", absolutePath: "/app/src/index.ts", size: 100, content: "console.log('hi')" }],
    dependencies: [{ name: "express", version: "^4.18.0", isDev: false }],
    routes: [
      {
        id: "r1",
        path: "/api/users",
        kind: "api",
        methods: ["GET"],
        handler: { name: "getUsers", file: "src/users.ts" },
        middlewareChain: confirmed([]),
        params: [],
        isPublic: confirmed(false),
        source: { file: "src/users.ts", line: 1 },
      },
      {
        id: "r2",
        path: "/home",
        kind: "page",
        methods: ["GET"],
        handler: { name: "Home", file: "src/Home.tsx" },
        middlewareChain: confirmed([]),
        params: [],
        isPublic: confirmed(true),
        source: { file: "src/Home.tsx", line: 1 },
      },
    ],
    components: [
      {
        id: "c1",
        name: "Navbar",
        file: "src/Navbar.tsx",
        line: 1,
        isSection: true,
      },
    ],
    componentGraph: [],
    apiEndpoints: [
      {
        id: "ep1",
        method: "GET",
        path: "/api/users",
        file: "src/users.ts",
        line: 10,
        handler: { name: "getUsers", file: "src/users.ts" },
        isPublic: confirmed(false),
        middlewareChain: confirmed([]),
      },
    ],
    entities: [
      {
        name: "User",
        file: "src/models/user.ts",
        fields: [{ name: "id", type: "string" }],
        operations: [],
      },
    ],
    claims: [
      {
        text: "99.9% uptime",
        category: "metric",
        provenance: { file: "src/Landing.tsx", line: 5 },
      },
    ],
    auth: {
      detected: true,
      providers: ["nextauth"],
      hasMiddleware: true,
    },
    authorization: {
      detected: true,
      hasRoleChecks: true,
      unprotectedRoutesCount: 0,
    },
    database: {
      detected: true,
      orm: "prisma",
      hasDirectQueries: false,
    },
    environment: {
      envFiles: [".env"],
      missingVarsCount: 0,
    },
    requirements: [
      {
        id: "REQ-001",
        category: "auth",
        title: "Require Auth",
        description: "All API routes must require auth",
        severity: "critical",
      },
    ],
    archetype: confirmed("saas-dashboard"),
    coverage: {
      frameworks: [],
      routes: { resolved: 2, unresolved: 0, unresolvedReasons: [] },
      files: { parsed: 1, skipped: { "too-large": 0, binary: 0, "symlink-escape": 0, "depth-limit": 0, "parse-timeout": 0, ignored: 0, "limit-reached": 0 }, parseFailed: [] },
      dynamicConstructs: [],
      rules: [],
    },
    timestamp: new Date().toISOString(),
  };

  it("provides filtered indexed queries and tracks consumed facts", () => {
    const facade = createQueryFacade(dummyModel);

    // Routes
    expect(facade.routes()).toHaveLength(2);
    expect(facade.routes({ kind: "api" })).toHaveLength(1);
    expect(facade.routes({ public: true })).toHaveLength(1);

    // Endpoints & Entities
    expect(facade.endpoint("GET", "/api/users")).toBeDefined();
    expect(facade.endpoint("POST", "/api/users")).toBeUndefined();
    expect(facade.entity("User")?.name).toBe("User");
    expect(facade.entity("NonExistent")).toBeUndefined();

    // Components
    expect(facade.components()).toHaveLength(1);
    expect(facade.components({ name: /Navbar/ })).toHaveLength(1);
    expect(facade.components({ name: /Footer/ })).toHaveLength(0);

    // Claims, Archetype, Coverage, Auth, DB, Requirements
    expect(facade.claims()).toHaveLength(1);
    expect(facade.archetype()).toBe("saas-dashboard");
    expect(facade.coverage().routes.resolved).toBe(2);
    expect(facade.auth().detected).toBe(true);
    expect(facade.authorization().hasRoleChecks).toBe(true);
    expect(facade.database().orm).toBe("prisma");
    expect(facade.requirements()).toHaveLength(1);
    expect(facade.files()).toHaveLength(1);

    // Tracking
    const consumed = facade.consumed();
    expect(consumed).toContain("routes");
    expect(consumed).toContain("endpoints");
    expect(consumed).toContain("entities");
    expect(consumed).toContain("components");
    expect(consumed).toContain("claims");
    expect(consumed).toContain("archetype");
  });
});
