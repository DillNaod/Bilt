import { describe, it, expect } from "vitest";
import {
  designBrief010,
  designBrief011,
  designBrief012,
} from "../../../src/core/rules/design/brief-alignment.js";
import type { ProjectModel } from "../../../src/core/project-model/types.js";
import type { DesignBrief } from "../../../src/core/design/brief/types.js";

describe("Design Brief Alignment Rules", () => {
  function createMockModel(brief?: DesignBrief, overrides?: Partial<ProjectModel>): ProjectModel {
    return {
      framework: { name: "react", displayName: "React" },
      rootDir: "/test",
      routes: [],
      components: [],
      navigation: { links: [], navbarsCount: 0, footersCount: 0, sidebarCount: 0 },
      userFlows: [],
      apiEndpoints: [],
      auth: { detected: false, providers: [], usesSession: false, usesJwt: false },
      designSystem: {
        colors: new Map(),
        spacing: new Set(),
        radii: new Set(),
        fonts: new Set(),
        totalTokens: 0,
      },
      content: { genericWordCount: 0, domainWordCount: 0, placeholderImagesCount: 0 },
      crossPage: { consistentNav: true, consistentFooter: true, totalPages: 1 },
      requirements: [],
      designBrief: brief,
      totalFilesScanned: 1,
      buildTimeMs: 10,
      ...overrides,
    };
  }

  describe("DESIGN-BRIEF-010 (Minimal vs Clutter)", () => {
    it("returns empty when no brief or non-minimal direction", () => {
      expect(designBrief010.detect(createMockModel())).toHaveLength(0);

      const nonMinimalBrief: DesignBrief = {
        schemaVersion: "1",
        createdAt: "",
        updatedAt: "",
        visualDirection: { value: ["brutalist"], source: "developer" },
        brandColors: { value: [], source: "not-provided" },
        desiredFeeling: { value: [], source: "not-provided" },
        creativeFreedom: "guided",
      };
      expect(designBrief010.detect(createMockModel(nonMinimalBrief))).toHaveLength(0);
    });

    it("detects minimal direction contradicted by high decorative density", () => {
      const minimalBrief: DesignBrief = {
        schemaVersion: "1",
        createdAt: "",
        updatedAt: "",
        visualDirection: { value: ["minimal & clean"], source: "developer" },
        brandColors: { value: [], source: "not-provided" },
        desiredFeeling: { value: [], source: "not-provided" },
        creativeFreedom: "guided",
      };

      const clutteredModel = createMockModel(minimalBrief, {
        components: [
          {
            name: "Hero",
            file: "Hero.tsx",
            line: 1,
            structuralSignature: "section",
            isSection: true,
            isCard: false,
            isNavigation: false,
            isForm: false,
            isModal: false,
            isHero: true,
            isDataDisplay: false,
            hasLoadingState: false,
            hasErrorState: false,
            hasEmptyState: false,
            hasSuccessState: false,
            hasDisabledState: false,
            interactiveElements: [],
            formFields: [],
            ctaTexts: [],
            headings: [],
            iconNames: [],
            rawText: "",
            decorativeSignals: [
              { type: "radial-orb", line: 5, snippet: "radial" },
              { type: "radial-orb", line: 6, snippet: "radial" },
              { type: "bento-grid", line: 10, snippet: "bento" },
              { type: "bento-grid", line: 12, snippet: "bento" },
            ],
          },
        ],
      });

      const findings = designBrief010.detect(clutteredModel);
      expect(findings).toHaveLength(1);
      expect(findings[0]!.ruleId).toBe("DESIGN-BRIEF-010");
    });
  });

  describe("DESIGN-BRIEF-011 (Editorial vs Generic SaaS)", () => {
    it("detects editorial intent contradicted by generic SaaS feature patterns", () => {
      const editorialBrief: DesignBrief = {
        schemaVersion: "1",
        createdAt: "",
        updatedAt: "",
        visualDirection: { value: ["editorial / warm"], source: "developer" },
        brandColors: { value: [], source: "not-provided" },
        desiredFeeling: { value: [], source: "not-provided" },
        creativeFreedom: "guided",
      };

      const templateModel = createMockModel(editorialBrief, {
        components: [
          {
            name: "Landing",
            file: "Landing.tsx",
            line: 1,
            structuralSignature: "section",
            isSection: true,
            isCard: false,
            isNavigation: false,
            isForm: false,
            isModal: false,
            isHero: true,
            isDataDisplay: false,
            hasLoadingState: false,
            hasErrorState: false,
            hasEmptyState: false,
            hasSuccessState: false,
            hasDisabledState: false,
            interactiveElements: [],
            formFields: [],
            ctaTexts: ["Get Started for Free"],
            headings: [],
            iconNames: [],
            rawText: "",
            decorativeSignals: [
              { type: "three-column", line: 15, snippet: "grid-cols-3" },
              { type: "hero-eyebrow", line: 5, snippet: "tag" },
            ],
          },
        ],
      });

      const findings = designBrief011.detect(templateModel);
      expect(findings).toHaveLength(1);
      expect(findings[0]!.ruleId).toBe("DESIGN-BRIEF-011");
    });
  });

  describe("DESIGN-BRIEF-012 (Brand Color Absence)", () => {
    it("detects missing brand colors in design tokens", () => {
      const briefWithColors: DesignBrief = {
        schemaVersion: "1",
        createdAt: "",
        updatedAt: "",
        visualDirection: { value: ["minimal"], source: "developer" },
        brandColors: { value: ["#2563eb", "#ff5500"], source: "developer" },
        desiredFeeling: { value: [], source: "not-provided" },
        creativeFreedom: "guided",
      };

      const tokens = new Map<string, string>();
      tokens.set("color-blue-2563eb", "#2563eb");
      // #ff5500 is missing!

      const model = createMockModel(briefWithColors, {
        designSystem: {
          colors: tokens,
          spacing: new Set(),
          radii: new Set(),
          fonts: new Set(),
          totalTokens: 1,
        },
      });

      const findings = designBrief012.detect(model);
      expect(findings).toHaveLength(1);
      expect(findings[0]!.ruleId).toBe("DESIGN-BRIEF-012");
      expect(findings[0]!.evidence.some((e) => e.includes("#ff5500"))).toBe(true);
    });
  });
});
