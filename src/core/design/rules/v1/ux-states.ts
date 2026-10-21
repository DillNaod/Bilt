import type { DesignRule, DesignSnapshot, DesignRuleCheckResult } from "../../types.js";
import { getUXStateTotals } from "../../types.js";

export const UX_STATE_RULES: DesignRule[] = [
  // ─── UX Completeness (ux-completeness) ─────────────────────────────────────
  {
    id: "UX-STATE-001",
    category: "ux-completeness",
    severity: "medium",
    title: "Missing loading or skeleton states in dynamic components",
    whyItMatters:
      "Deploying interactive applications without asynchronous loading or skeleton states causes content layout shifts (CLS) and leaves users wondering if data is arriving.",
    recommendation:
      "Implement skeleton screens or loading spinners during async data fetches and page transitions.",
    agentAction:
      "Add skeleton loaders or fallback suspense states for data-fetching views.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const dynamicRoutes = snapshot.routes.filter((r) => r.type === "app");
      const routesWithoutLoading = dynamicRoutes.filter((r) => !r.hasLoadingState);
      if (dynamicRoutes.length > 0 && routesWithoutLoading.length > 0) {
        return [
          {
            matches: true,
            evidence: [`${routesWithoutLoading.length} application route(s) lack loading states (${routesWithoutLoading.map((r) => r.file).join(", ")})`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "UX-STATE-002",
    category: "ux-completeness",
    severity: "medium",
    title: "Missing empty states for collection and listing components",
    whyItMatters:
      "When a search, table, or user collection returns zero results, displaying a blank container confuses users.",
    recommendation:
      "Provide an intentional empty state featuring an informative message and a clear next action.",
    agentAction:
      "Add empty state conditions with action buttons to collection views.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const appRoutes = snapshot.routes.filter((r) => r.type === "app");
      const routesWithoutEmpty = appRoutes.filter((r) => !r.hasEmptyState);
      if (appRoutes.length >= 2 && routesWithoutEmpty.length === appRoutes.length) {
        return [
          {
            matches: true,
            evidence: ["Application routes show no handling for empty collection states"],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "UX-STATE-006",
    category: "ux-completeness",
    severity: "medium",
    title: "Missing dedicated error boundary or error handling state",
    whyItMatters:
      "When client-side rendering fails or an API call rejects, lacking an error boundary crashes the entire app to a white screen.",
    recommendation:
      "Add an ErrorBoundary component or dedicated error state route with a reload/retry button.",
    agentAction:
      "Implement ErrorBoundary components or route-level error handlers.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const appRoutes = snapshot.routes.filter((r) => r.type === "app");
      const routesWithoutError = appRoutes.filter((r) => !r.hasErrorState);
      if (appRoutes.length >= 2 && routesWithoutError.length === appRoutes.length) {
        return [
          {
            matches: true,
            evidence: ["Application routes lack error boundary or error handling state"],
          },
        ];
      }
      return [];
    },
  },

  // ─── Production UX (production-ux) ─────────────────────────────────────────
  {
    id: "UX-STATE-003",
    category: "production-ux",
    severity: "medium",
    title: "Missing mobile navigation drawer or responsive menu",
    whyItMatters:
      "Navigation bars designed exclusively for desktop screens break on mobile viewports, leaving mobile users unable to navigate.",
    recommendation:
      "Implement a responsive mobile navigation drawer or bottom navigation bar.",
    agentAction:
      "Add mobile navigation toggle and drawer for viewports under 768px.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const uxStates = getUXStateTotals(snapshot);
      if (uxStates.missingMobileNav) {
        return [
          {
            matches: true,
            evidence: ["Desktop navbar present without corresponding mobile hamburger or drawer"],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "UX-STATE-004",
    category: "production-ux",
    severity: "high",
    title: "Destructive actions lack confirmation dialog",
    whyItMatters:
      "Providing immediate delete, purge, or remove buttons without confirmation dialogs leads to accidental data loss.",
    recommendation:
      "Require modal confirmation or a two-step verification flow for permanent delete actions.",
    agentAction:
      "Wrap destructive triggers in confirmation dialogs.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const uxStates = getUXStateTotals(snapshot);
      if (uxStates.destructiveWithoutConfirmCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${uxStates.destructiveWithoutConfirmCount} destructive button(s) lack confirmation dialogs`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "UX-STATE-005",
    category: "production-ux",
    severity: "low",
    title: "Missing 404 error page experience",
    whyItMatters:
      "Production web applications must provide a user-friendly 404 page that guides users back to the homepage or documentation when broken links occur.",
    recommendation:
      "Create a custom 404 (or not-found) route providing helpful recovery navigation.",
    agentAction:
      "Add a 404.html or not-found route with clear recovery links.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const hasWebRoutes = snapshot.routes.length > 0;
      const has404 = snapshot.assets.some((a) => a.has404Page);
      if (hasWebRoutes && !has404) {
        return [
          {
            matches: true,
            evidence: ["No 404 or not-found route detected in project routes"],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "UX-STATE-007",
    category: "production-ux",
    severity: "low",
    title: "Missing Terms of Service or Privacy Policy disclosures",
    whyItMatters:
      "Production SaaS platforms collecting user data or offering authenticated accounts must link to Terms of Service and Privacy Policy documentation.",
    recommendation:
      "Add Terms of Service and Privacy Policy pages accessible from the site footer.",
    agentAction:
      "Add /terms and /privacy routes or link legal documents in the footer.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const hasAuthRoutes = snapshot.routes.some((r) => r.type === "auth");
      const hasLegal = snapshot.assets.some((a) => a.hasTos || a.hasPrivacyPolicy);
      if (hasAuthRoutes && !hasLegal) {
        return [
          {
            matches: true,
            evidence: ["Authentication routes detected without corresponding Terms of Service or Privacy Policy"],
          },
        ];
      }
      return [];
    },
  },
];
