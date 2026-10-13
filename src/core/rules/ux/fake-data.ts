// ─── Fake / Decorative Data Rules ────────────────────────────────────────────
// Detects hardcoded product metrics, CTA buttons with no action, and fake
// testimonials that create a false impression of real product usage.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { Finding, PrecisionTier } from "../../finding/types.js";
import type { RegisteredRule, RuleFinding } from "../../rule-registry/types.js";

// ---------------------------------------------------------------------------
// Model types
// ---------------------------------------------------------------------------

interface HardcodedMetricModel {
  /** The display text, e.g. "2,481 active users" */
  text: string;
  file: string;
  line: number;
  /** Whether a data-fetch / API call was detected near this metric in the same component */
  hasNearbyDataFetch?: boolean;
  /** Whether a prop passes dynamic data into this metric display */
  hasDynamicProp?: boolean;
}

interface InteractiveElementModel {
  type: "button" | "link" | "div-clickable" | string;
  text?: string;
  href?: string;
  onClickIsEmpty?: boolean;
  file: string;
  line: number;
}

interface ComponentModel {
  name: string;
  file: string;
  line: number;
  rawText: string;
  interactiveElements?: InteractiveElementModel[];
}

interface ContentModel {
  hardcodedMetrics?: HardcodedMetricModel[];
  /** Count of components containing testimonial-like markup */
  fakeTestimonialCount?: number;
}

interface FakeDataAnalysisModel {
  content?: ContentModel;
  components?: ComponentModel[];
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function fingerprint(ruleId: string, ...parts: Array<string | number>): string {
  const hash = crypto.createHash("sha256");
  hash.update(ruleId);
  for (const part of parts) {
    hash.update(`:${part}`);
  }
  return hash.digest("hex");
}

// ---------------------------------------------------------------------------
// RULE UX-FAKE-001: Hardcoded Product Metrics
// ---------------------------------------------------------------------------

/**
 * RULE UX-FAKE-001: Hardcoded Product Metrics
 *
 * Fires when a UI component displays a product-facing metric (e.g. "2,481 active
 * users") but no corresponding data source (API endpoint, state variable, or
 * prop with dynamic data) is detected in the same component.
 *
 * Both conditions must be met: metric text found AND no obvious data fetch.
 * Precision: medium
 */
export function detectHardcodedProductMetrics(model: FakeDataAnalysisModel): Finding[] {
  const findings: Finding[] = [];

  const metrics = model.content?.hardcodedMetrics ?? [];

  for (const metric of metrics) {
    // Only fire if BOTH conditions hold
    if (metric.hasNearbyDataFetch || metric.hasDynamicProp) continue;

    findings.push({
      rule_id: "UX-FAKE-001",
      fingerprint: fingerprint("UX-FAKE-001", metric.file, String(metric.line)),
      severity: "warning",
      precision: "medium" as PrecisionTier,
      maturity: "experimental",
      category: "product-authenticity",
      file: metric.file,
      line: metric.line,
      end_line: metric.line,
      title: `Hardcoded product metric "${metric.text}" has no data source`,
      explanation: [
        `UI displays "${metric.text}" as a product-facing metric at ${metric.file}:${metric.line}.`,
        `No corresponding data source, API call, or dynamic prop was detected in the same component.`,
        `Hardcoded metrics create a false impression of real traction and mislead users about product usage.`,
      ].join(" "),
      agent_action: `Replace the hardcoded value "${metric.text}" with a real data fetch (API call, database query, or analytics event). If the metric is genuinely static, document why in a comment.`,
      fixable: false,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// RULE UX-FAKE-002: CTA Button With No Action
// ---------------------------------------------------------------------------

/** Product-level CTA text patterns that should always lead somewhere meaningful */
const CTA_PATTERNS: RegExp[] = [
  /^get\s+started$/i,
  /^sign\s+up$/i,
  /^start\s+free\s+trial$/i,
  /^book\s+a\s+demo$/i,
  /^request\s+access$/i,
  /^start\s+your\s+trial$/i,
  /^try\s+for\s+free$/i,
];

function isCTAText(text: string): boolean {
  const trimmed = text.trim();
  return CTA_PATTERNS.some((p) => p.test(trimmed));
}

/**
 * RULE UX-FAKE-002: CTA Button With No Action
 *
 * Product-facing call-to-action buttons (Get Started, Sign Up, etc.) that have
 * an empty onClick or href="#" lead nowhere and signal an incomplete product.
 *
 * Precision: high (structural model + known CTA text match)
 */
export function detectCTAButtonWithNoAction(model: FakeDataAnalysisModel): Finding[] {
  const findings: Finding[] = [];

  const components = model.components ?? [];

  for (const comp of components) {
    const elements = comp.interactiveElements ?? [];
    for (const el of elements) {
      if (el.type !== "button" && el.type !== "link") continue;

      const isDeadHref = el.href === "#" || el.href === "";
      const isEmptyClick = el.onClickIsEmpty === true;
      if (!isDeadHref && !isEmptyClick) continue;

      const text = el.text ?? "";
      if (!isCTAText(text)) continue;

      const targetFile = (el as any).file ?? comp.file;

      findings.push({
        rule_id: "UX-FAKE-002",
        fingerprint: fingerprint("UX-FAKE-002", targetFile, String(el.line), text),
        severity: "warning",
        precision: "high" as PrecisionTier,
        maturity: "stable",
        category: "product-authenticity",
        file: targetFile,
        line: el.line,
        end_line: el.line,
        title: `CTA button "${text}" has no action`,
        explanation: [
          `The CTA button "${text}" at ${targetFile}:${el.line} has no real destination or handler.`,
          isDeadHref
            ? `Its href is "${el.href}", which goes nowhere.`
            : `Its onClick handler is empty.`,
          `Product CTAs like "${text}" are conversion-critical. A non-functional CTA signals an unfinished product to potential users.`,
        ].join(" "),
        agent_action: `Wire up the "${text}" CTA to a real destination (route, sign-up flow, waitlist, or demo booking page). Remove placeholder href="#" or empty click handlers.`,
        fixable: false,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// RULE UX-FAKE-003: Fake Testimonials
// ---------------------------------------------------------------------------

/** Generic company names that indicate fake testimonials */
const FAKE_COMPANY_NAMES: RegExp[] = [
  /\bacme\s+corp\b/i,
  /\btechcorp\b/i,
  /\bstartupxyz\b/i,
  /\binnovate\s+inc\b/i,
  /\bglobal\s+solutions\b/i,
  /\bexample\s+co\b/i,
];

/** Generic executive title patterns */
const FAKE_TITLE_PATTERNS: RegExp[] = [
  /\bceo\s+at\b/i,
  /\bfounder\s+of\b/i,
  /\bcto\s+at\b/i,
  /\bcoo\s+at\b/i,
  /\bvp\s+of\b/i,
];

function hasFakeCompanyName(text: string): boolean {
  return FAKE_COMPANY_NAMES.some((p) => p.test(text));
}

function hasFakeTitle(text: string): boolean {
  return FAKE_TITLE_PATTERNS.some((p) => p.test(text));
}

/**
 * RULE UX-FAKE-003: Fake Testimonials
 *
 * Detects testimonial components using generic company names (Acme Corp,
 * TechCorp, etc.) combined with generic executive titles (CEO at, Founder of).
 * Precision is 'high' when BOTH a fake company name AND a CEO/CTO title
 * are present together; 'medium' when only one signal is found.
 *
 * Precision: high (both signals) / medium (single signal)
 */
export function detectFakeTestimonials(model: FakeDataAnalysisModel): Finding[] {
  const findings: Finding[] = [];

  const components = model.components ?? [];

  for (const comp of components) {
    const text = comp.rawText;
    if (!text) continue;

    // Also leverage aggregate count from content model as a fast gate
    const fakeCount = model.content?.fakeTestimonialCount ?? 0;
    const compIsTestimonial =
      /testimonial|review|quote|avatar/i.test(comp.name) ||
      /testimonial|blockquote/i.test(text);

    // We need at least one testimonial signal
    if (!compIsTestimonial && fakeCount === 0) continue;

    const foundFakeCompany = hasFakeCompanyName(text);
    const foundFakeTitle = hasFakeTitle(text);

    if (!foundFakeCompany && !foundFakeTitle) continue;

    const precision: PrecisionTier =
      foundFakeCompany && foundFakeTitle ? "high" : "medium";

    const companyRegex = FAKE_COMPANY_NAMES.find((p) => p.test(text));
    const companyMatch = companyRegex ? text.match(companyRegex)?.[0] : undefined;
    const titleRegex = FAKE_TITLE_PATTERNS.find((p) => p.test(text));
    const titleMatch = titleRegex ? text.match(titleRegex)?.[0] : undefined;

    const evidenceParts: string[] = [];
    if (companyMatch) evidenceParts.push(`generic company name: "${companyMatch}"`);
    if (titleMatch) evidenceParts.push(`generic title: "${titleMatch}"`);

    findings.push({
      rule_id: "UX-FAKE-003",
      fingerprint: fingerprint("UX-FAKE-003", comp.file, comp.name),
      severity: "warning",
      precision,
      maturity: "experimental",
      category: "product-authenticity",
      file: comp.file,
      line: comp.line,
      end_line: comp.line,
      title: `Component "${comp.name}" contains fake testimonial signals`,
      explanation: [
        `Component "${comp.name}" at ${comp.file}:${comp.line} contains signals of a fake or placeholder testimonial:`,
        evidenceParts.join("; ") + ".",
        `Fake testimonials using placeholder company names and generic titles undermine product credibility.`,
        precision === "high"
          ? `Both a generic company name AND an executive title were detected together (high confidence).`
          : `Only one signal was detected; verify manually.`,
      ].join(" "),
      agent_action: `Replace the placeholder testimonial in "${comp.name}" with a real customer quote, or remove it entirely. Generic testimonials (Acme Corp CEO) can harm trust more than having no testimonials.`,
      fixable: false,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Aggregated export
// ---------------------------------------------------------------------------

export const uxFakeDataRules = {
  "UX-FAKE-001": detectHardcodedProductMetrics,
  "UX-FAKE-002": detectCTAButtonWithNoAction,
  "UX-FAKE-003": detectFakeTestimonials,
} as const;

export function runUXFakeDataRules(model: FakeDataAnalysisModel): Finding[] {
  return [
    ...detectHardcodedProductMetrics(model),
    ...detectCTAButtonWithNoAction(model),
    ...detectFakeTestimonials(model),
  ];
}

function findingToRuleFinding(f: Finding): RuleFinding {
  return {
    ruleId: f.rule_id,
    title: f.title,
    severity: f.severity === "critical" ? "critical" : f.severity === "warning" ? "medium" : "low",
    precision: f.precision,
    maturity: f.maturity,
    category: "ux-fake-data",
    evidence: [f.explanation],
    locations: [{ file: f.file, line: f.line, endLine: f.end_line }],
    agentObjective: f.agent_action,
    description: f.explanation,
    recommendation: f.agent_action,
    file: f.file,
    line: f.line,
    endLine: f.end_line,
    fingerprint: f.fingerprint,
    fixable: f.fixable,
  };
}

export const uxFake001: RegisteredRule = {
  id: "UX-FAKE-001",
  category: "ux-fake-data",
  title: "Hardcoded Product Metrics Presented as Live Data",
  severity: "medium",
  precision: "medium",
  maturity: "stable",
  detect(model: any) {
    return detectHardcodedProductMetrics(model).map(findingToRuleFinding);
  },
};

export const uxFake002: RegisteredRule = {
  id: "UX-FAKE-002",
  category: "ux-fake-data",
  title: "CTA Button With No Functional Action",
  severity: "medium",
  precision: "high",
  maturity: "stable",
  detect(model: any) {
    return detectCTAButtonWithNoAction(model).map(findingToRuleFinding);
  },
};

export const uxFake003: RegisteredRule = {
  id: "UX-FAKE-003",
  category: "ux-fake-data",
  title: "Placeholder Testimonial Signals Undermine Credibility",
  severity: "low",
  precision: "medium",
  maturity: "experimental",
  detect(model: any) {
    return detectFakeTestimonials(model).map(findingToRuleFinding);
  },
};

