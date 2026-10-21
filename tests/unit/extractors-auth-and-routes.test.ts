import { describe, it, expect } from "vitest";
import { buildAuthFlow, extractAuth } from "../../src/core/project-model/extractors/auth.js";
import {
  extractLinkedRoutes,
  extractPrimaryAction,
  extractReactRouterRoutes,
  extractRoutes,
} from "../../src/core/project-model/extractors/routes.js";
import type { RouteModel, ComponentModel } from "../../src/core/project-model/types.js";

describe("Project Model Extractors: Auth & Routes", () => {
  describe("Auth Extractor", () => {
    it("builds user auth flow with detected and missing states", () => {
      const authRoutes: RouteModel[] = [
        {
          path: "/login",
          file: "src/app/login/page.tsx",
          type: "auth",
          isDynamic: false,
          hasLoadingState: true,
          hasErrorState: true,
          hasEmptyState: false,
          reachableFromNav: true,
          linkedRoutes: [],
        },
      ];

      const components: ComponentModel[] = [
        {
          name: "LoginForm",
          file: "src/app/login/LoginForm.tsx",
          line: 1,
          structuralSignature: "form",
          isSection: false,
          isCard: false,
          isNavigation: false,
          isForm: true,
          isModal: false,
          isHero: false,
          isDataDisplay: false,
          hasLoadingState: true,
          hasErrorState: true,
          hasSuccessState: true,
          hasDisabledState: false,
          interactiveElements: [],
          formFields: [],
          ctaTexts: [],
          headings: [],
          iconNames: [],
          rawText: "",
          decorativeSignals: [],
        },
      ];

      const flow = buildAuthFlow(authRoutes, components);
      expect(flow.name).toBe("auth");
      expect(flow.detectedStates.some((s) => s.name === "entry")).toBe(true);
      expect(flow.detectedStates.some((s) => s.name === "loading")).toBe(true);
      expect(flow.detectedStates.some((s) => s.name === "error")).toBe(true);
      expect(flow.detectedStates.some((s) => s.name === "success")).toBe(true);
      expect(flow.missingStates).toContain("validation-error");
    });

    it("extracts multiple auth providers and middleware files", () => {
      const payloads = [
        {
          relPath: "src/auth/clerk.ts",
          absPath: "/app/src/auth/clerk.ts",
          content: "import { ClerkProvider } from '@clerk/nextjs';",
        },
        {
          relPath: "src/auth/nextauth.ts",
          absPath: "/app/src/auth/nextauth.ts",
          content: "import { NextAuthProvider } from 'next-auth/react';",
        },
        {
          relPath: "src/auth/supabase.ts",
          absPath: "/app/src/auth/supabase.ts",
          content: "import { createClient } from '@supabase/auth-helpers-nextjs';",
        },
        {
          relPath: "src/auth/firebase.ts",
          absPath: "/app/src/auth/firebase.ts",
          content: "import { getAuth } from 'firebase/auth';",
        },
        {
          relPath: "src/auth/lucia.ts",
          absPath: "/app/src/auth/lucia.ts",
          content: "import { new Lucia } from 'lucia';",
        },
        {
          relPath: "src/auth/better.ts",
          absPath: "/app/src/auth/better.ts",
          content: "import { betterAuth } from 'better-auth';",
        },
        {
          relPath: "src/auth/passport.ts",
          absPath: "/app/src/auth/passport.ts",
          content: "passport.use(new LocalStrategy());",
        },
        {
          relPath: "src/middleware.ts",
          absPath: "/app/src/middleware.ts",
          content: "export default clerkMiddleware();",
        },
      ];

      const routes: RouteModel[] = [
        {
          path: "/dashboard",
          file: "src/dashboard.tsx",
          type: "page",
          isDynamic: false,
          hasLoadingState: false,
          hasErrorState: false,
          hasEmptyState: false,
          reachableFromNav: true,
          linkedRoutes: [],
        },
        {
          path: "/login",
          file: "src/login.tsx",
          type: "auth",
          isDynamic: false,
          hasLoadingState: false,
          hasErrorState: false,
          hasEmptyState: false,
          reachableFromNav: true,
          linkedRoutes: [],
        },
        {
          path: "/pricing",
          file: "src/pricing.tsx",
          type: "page",
          isDynamic: false,
          hasLoadingState: false,
          hasErrorState: false,
          hasEmptyState: false,
          reachableFromNav: true,
          linkedRoutes: [],
        },
      ];

      const auth = extractAuth(payloads, routes);
      expect(auth.hasAuthentication).toBe(true);
      expect(auth.providers).toContain("clerk");
      expect(auth.providers).toContain("nextauth");
      expect(auth.providers).toContain("supabase");
      expect(auth.providers).toContain("firebase");
      expect(auth.providers).toContain("lucia");
      expect(auth.providers).toContain("better-auth");
      expect(auth.providers).toContain("passport");
      expect(auth.authMiddlewareFiles).toContain("src/middleware.ts");
      expect(auth.protectedRoutes).toContain("/dashboard");
      expect(auth.publicRoutes).toContain("/login");
      expect(auth.publicRoutes).toContain("/pricing");
    });
  });

  describe("Routes Extractor", () => {
    it("extracts linked routes from content", () => {
      const content = `<a href="/about">About</a><Link href="/contact">Contact</Link><div href="/ignore" />`;
      const links = extractLinkedRoutes(content);
      expect(links).toContain("/about");
      expect(links).toContain("/contact");
    });

    it("extracts primary action from buttons and CTA links", () => {
      const buttonHtml = `<button className="primary">Start Project</button>`;
      expect(extractPrimaryAction(buttonHtml)).toBe("Start Project");

      const linkHtml = `<a href="/signup">Get Started Today</a>`;
      expect(extractPrimaryAction(linkHtml)).toBe("Get Started Today");
    });

    it("extracts React Router JSX routes and browser router definitions", () => {
      const content = `
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/users/:id" element={<User />} />
        </Routes>
        const router = createBrowserRouter([
          { path: "/settings", element: <Settings /> },
          { path: "/auth/signup", element: <Signup /> }
        ]);
      `;

      const routes = extractReactRouterRoutes("src/App.tsx", content);
      expect(routes.length).toBe(5);
      expect(routes.some((r) => r.path === "/home" && r.type === "page")).toBe(true);
      expect(routes.some((r) => r.path === "/auth/login" && r.type === "auth")).toBe(true);
      expect(routes.some((r) => r.path === "/users/:id" && r.isDynamic)).toBe(true);
      expect(routes.some((r) => r.path === "/settings")).toBe(true);
    });

    it("extracts routes across payloads based on detected framework", () => {
      const payloads = [
        {
          relPath: "src/app/page.tsx",
          absPath: "/app/src/app/page.tsx",
          content: "export default function Page() { return <h1>Home</h1>; }",
        },
        {
          relPath: "pages/about.tsx",
          absPath: "/app/pages/about.tsx",
          content: "export default function About() { return <h1>About</h1>; }",
        },
        {
          relPath: "src/App.tsx",
          absPath: "/app/src/App.tsx",
          content: `<Route path="/features" element={<Features />} />`,
        },
      ];

      const nextAppRoutes = extractRoutes(payloads, "nextjs");
      expect(nextAppRoutes.length).toBeGreaterThan(0);

      const reactRoutes = extractRoutes(payloads, "react");
      expect(reactRoutes.some((r) => r.path === "/features")).toBe(true);
    });
  });
});
