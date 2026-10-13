// ─── ProjectModel Types ────────────────────────────────────────────────────────
// Normalized, structured representation of a project for deterministic analysis.
// All sub-interfaces capture structural facts — not scores or opinions.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Location Reference ──────────────────────────────────────────────────────

export interface Location {
  file: string;
  line?: number;
  endLine?: number;
}

// ─── Route Model ─────────────────────────────────────────────────────────────

/** Frontend navigation route (Next.js page, React Router route, etc.) */
export interface RouteModel {
  path: string;           // URL path e.g. /dashboard/settings
  file: string;           // source file
  type: 'page' | 'layout' | 'api' | 'auth' | 'error' | 'loading' | 'unknown';
  isDynamic: boolean;     // has [param] segments
  hasLoadingState: boolean;
  hasErrorState: boolean;
  hasEmptyState: boolean;
  reachableFromNav: boolean;   // linked from navigation (populated later)
  linkedRoutes: string[];      // routes this page links to
  primaryAction?: string;      // main CTA text if detectable
}

// ─── Component Model ─────────────────────────────────────────────────────────

/** A UI component/section analyzed structurally */
export interface ComponentModel {
  name: string;
  file: string;
  line: number;
  structuralSignature: string;  // normalized tree e.g. "section>div>(div>(icon+h3+p))*3"
  isSection: boolean;
  isCard: boolean;
  isNavigation: boolean;
  isForm: boolean;
  isModal: boolean;
  isHero: boolean;
  isDataDisplay: boolean;       // table, list, data grid
  hasLoadingState: boolean;
  hasErrorState: boolean;
  hasEmptyState: boolean;
  hasSuccessState: boolean;
  hasDisabledState: boolean;
  interactiveElements: InteractiveElementModel[];
  formFields: FormFieldModel[];
  ctaTexts: string[];           // button/link text
  headings: HeadingModel[];     // h1-h6 with text and level
  iconNames: string[];
  rawText: string;              // first 2000 chars for copy analysis
  decorativeSignals: DecorativeSignal[];  // visual pattern signals
}

/** Heading in a component */
export interface HeadingModel {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  tailwindClasses: string[];    // for size analysis
}

/** Interactive elements (buttons, links, inputs) */
export interface InteractiveElementModel {
  type: 'button' | 'link' | 'input' | 'select' | 'textarea' | 'div-clickable';
  text?: string;
  href?: string;
  hasAriaLabel: boolean;
  isDestructive: boolean;       // contains delete/remove/destroy text
  hasConfirmation: boolean;     // preceded by dialog/confirm
  hasOnClick: boolean;
  onClickIsEmpty: boolean;      // onClick={() => {}} or href="#"
  line: number;
}

/** Form field */
export interface FormFieldModel {
  type: string;                 // input type or element
  name?: string;
  hasLabel: boolean;
  hasAriaLabel: boolean;
  hasErrorMessage: boolean;
  hasRequired: boolean;
  line: number;
}

/** Decorative visual signal for composition analysis */
export interface DecorativeSignal {
  type: string;
  evidence: string;
  line?: number;
}

// ─── Design System Model ──────────────────────────────────────────────────────

/** Design system facts — extracted from CSS/Tailwind classes across all files */
export interface DesignSystemModel {
  // Distribution maps: value -> {count, locations[]}
  radii: Map<string, { count: number; locations: Location[] }>;
  spacing: Map<string, { count: number; locations: Location[] }>;
  colors: Map<string, { count: number; locations: Location[] }>;
  fontSizes: Map<string, { count: number; locations: Location[] }>;
  fontWeights: Map<string, { count: number; locations: Location[] }>;
  shadows: Map<string, { count: number; locations: Location[] }>;
  // Summary
  colorCount: number;
  uniqueRadiusCount: number;
  uniqueSpacingCount: number;
  hasDesignTokenFile: boolean;  // tailwind.config, tokens.css, etc.
  detectedFonts: string[];
}

// ─── Navigation Model ─────────────────────────────────────────────────────────

/** Navigation model */
export interface NavigationModel {
  items: NavItem[];
  hasDesktopNav: boolean;
  hasMobileNav: boolean;
  framework: 'sidebar' | 'topbar' | 'tabs' | 'bottombar' | 'unknown';
}

export interface NavItem {
  label: string;
  href: string;
  resolvedRoute?: RouteModel;   // matched route
  isExternal: boolean;
  isDeadLink: boolean;          // href='#' or no route match
  line: number;
  file: string;
}

// ─── User Flow Model ──────────────────────────────────────────────────────────

/** User flow state machine */
export interface UserFlowModel {
  name: string;                 // 'signup' | 'login' | 'checkout' | 'create' | 'upload' | 'delete' etc.
  detectedStates: FlowState[];
  missingStates: string[];      // expected states that weren't found
  entryPoints: Location[];
}

export interface FlowState {
  name: 'entry' | 'loading' | 'success' | 'error' | 'empty' | 'validation-error' | 'cancel' | 'retry' | 'confirmation' | 'disabled';
  location: Location;
}

// ─── API Endpoint Security Model ──────────────────────────────────────────────

/** API endpoint security model */
export interface ApiEndpointModel {
  method: string;
  path: string;
  file: string;
  line: number;
  framework: string;
  handlerContent: string;
  // Security facts
  hasAuthCheck: boolean;
  hasAuth?: boolean;
  authCheckType?: 'session' | 'jwt' | 'middleware' | 'unknown';
  hasOwnershipCheck: boolean;
  hasInputValidation: boolean;
  validationLibrary?: string;   // zod, joi, yup, express-validator etc.
  acceptsReqBody: boolean;
  acceptsRawBody?: boolean;
  passesBodyToDb: boolean;      // mass assignment risk
  hasExplicitFieldSelection: boolean;  // destructures req.body
  dbOperations: DbOperation[];
  sensitiveFieldsInResponse: string[];
}

export interface DbOperation {
  type: 'read' | 'write' | 'delete' | 'unknown';
  model?: string;
  usesParamDirectly: boolean;   // db.find(req.params.id) without userId filter
  line: number;
}

// ─── Content Model ────────────────────────────────────────────────────────────

/** Content model — text quality and copy patterns */
export interface ContentModel {
  terminology: Map<string, string[]>;                              // concept -> [synonyms found across pages]
  genericPhrases: Array<{ phrase: string; file: string; line: number }>;
  hardcodedMetrics: Array<{ text: string; file: string; line: number }>;  // "2,481 active users"
  ctaTexts: Map<string, string[]>;                                 // page -> cta texts (for consistency)
  loremIpsumCount: number;
  fakeTestimonialCount: number;
}

// ─── Auth Model ───────────────────────────────────────────────────────────────

/** Auth model */
export interface AuthModel {
  hasAuthentication: boolean;
  providers: string[];          // 'clerk', 'nextauth', 'supabase', 'firebase', etc.
  protectedRoutes: string[];
  publicRoutes: string[];
  authMiddlewareFiles: string[];
}

// ─── Requirements Traceability ────────────────────────────────────────────────

/** Requirements traceability */
export interface RequirementModel {
  id: string;
  statement: string;
  source: 'developer-required' | 'developer-preference' | 'inferred';
  evidence: RequirementEvidence[];
  status: 'satisfied' | 'unsatisfied' | 'partial' | 'needs-review';
}

export interface RequirementEvidence {
  type: 'route' | 'component' | 'api-endpoint' | 'service' | 'library';
  description: string;
  location: Location;
}

// ─── Cross-Page Analysis ──────────────────────────────────────────────────────

/** Cross-page analysis */
export interface CrossPageModel {
  // Per-page CTA texts
  pageCtaTexts: Map<string, string[]>;
  // Navigation consistency: same concept referred to differently
  terminologyInconsistencies: Array<{
    concept: string;
    variants: Array<{ text: string; file: string; line: number }>;
  }>;
  // Button/action naming consistency
  actionVerbs: Map<string, string[]>;  // action-type -> [variants found]
}

// ─── Top-Level ProjectModel ───────────────────────────────────────────────────

/** Top-level normalized project model */
export interface ProjectModel {
  framework: string | undefined;
  rootDir: string;
  routes: RouteModel[];
  components: ComponentModel[];
  navigation: NavigationModel;
  userFlows: UserFlowModel[];
  apiEndpoints: ApiEndpointModel[];
  auth: AuthModel;
  designSystem: DesignSystemModel;
  content: ContentModel;
  crossPage: CrossPageModel;
  requirements: RequirementModel[];
  designBrief?: import('../design/brief/types.js').DesignBrief;
  // Legacy snapshot preserved for backward compat with existing rules during migration
  legacySnapshot?: import('../design/types.js').DesignSnapshot;
  totalFilesScanned: number;
  buildTimeMs: number;
}
