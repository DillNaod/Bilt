import type { DesignRule, DesignSnapshot, DesignRuleCheckResult } from "../../types.js";
import { getInteractionTotals, getUXStateTotals } from "../../types.js";

export const AUTHENTICITY_RULES: DesignRule[] = [
  {
    id: "DESIGN-AUTHENTICITY-001",
    category: "product-authenticity",
    severity: "high",
    title: "Marketing interface does not appear to represent the actual product",
    whyItMatters:
      "Landing pages that showcase decorative mockups, fake terminal typing, or placeholder screenshots without showing the actual application UI mislead users.",
    recommendation:
      "Incorporate authentic screenshots, code samples, interactive sandboxes, or actual component states directly from the application codebase.",
    agentAction:
      "Replace decorative mockups with authentic product interface snapshots or live interactive component demos.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const evidence: string[] = [];
      const interactions = getInteractionTotals(snapshot);
      const hasTerminal = interactions.fakeTypingCount > 0;
      const hasScreenshots = snapshot.assets.some((a) => a.images.some((img) => img.isScreenshot));
      const hasMarketing = snapshot.routes.some((r) => r.type === "marketing");

      if (hasTerminal) evidence.push("simulated terminal window with non-functional command output");
      if (interactions.fakeLiveIndicatorCount > 0) evidence.push("simulated fake live status indicators");
      if (interactions.fakeCounterCount > 0) evidence.push("unconnected metric counter animation");
      if (hasMarketing && !hasScreenshots && snapshot.assets.every((a) => a.images.length === 0)) {
        evidence.push("landing page contains no authentic application screenshots or previews");
      }

      if (evidence.length >= 2) {
        return [{ matches: true, evidence }];
      }
      return [];
    },
  },

  {
    id: "DESIGN-AUTHENTICITY-002",
    category: "product-authenticity",
    severity: "medium",
    title: "Primary Call-to-Action buttons lead to dead links",
    whyItMatters:
      "Landing page CTA buttons pointing to '#' or empty callback handlers break user flows and demonstrate incomplete implementation.",
    recommendation:
      "Connect primary buttons to working authentication routes, application views, or functional registration dialogs.",
    agentAction:
      "Update button href/onClick attributes to navigate to real application routes.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const uxStates = getUXStateTotals(snapshot);
      if (uxStates.deadLinkCtaCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${uxStates.deadLinkCtaCount} call-to-action buttons configured with '#' or empty onClick handlers`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-AUTHENTICITY-003",
    category: "product-authenticity",
    severity: "medium",
    title: "Placeholder company names used in social proof and brand logos",
    whyItMatters:
      "Displaying fictional placeholder companies ('Acme Corp', 'TechCorp', 'StartupX', 'Initech') damages trust and signals unverified template copy.",
    recommendation:
      "Either display verified partner or customer logos, or replace the logo strip with concrete product architectural highlights or community stats.",
    agentAction:
      "Remove placeholder brand names and replace with authentic customer references or open source stats.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.fakeCompanyCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.fakeCompanyCount} placeholder company name(s) detected in copy/logos`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-AUTHENTICITY-004",
    category: "product-authenticity",
    severity: "low",
    title: "Simulated live visitor or activity indicators",
    whyItMatters:
      "Displaying hardcoded fake live activity badges ('24 people viewing right now') is a manipulative pattern that reduces authenticity.",
    recommendation:
      "Replace simulated real-time indicators with real WebSocket presence telemetry or remove the indicator.",
    agentAction:
      "Connect presence indicators to authentic real-time metrics or remove fake live badges.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const interactions = getInteractionTotals(snapshot);
      if (interactions.fakeOnlineUsersCount > 0 || interactions.fakeLiveIndicatorCount > 0) {
        return [
          {
            matches: true,
            evidence: [
              interactions.fakeOnlineUsersCount > 0 ? "Hardcoded online visitor count detected" : "",
              interactions.fakeLiveIndicatorCount > 0 ? "Simulated live ping indicator detected" : "",
            ].filter(Boolean),
          },
        ];
      }
      return [];
    },
  },
];
