import type {
  ComponentModel,
  RouteModel,
  CrossPageModel,
  UserFlowModel,
  ApiEndpointModel,
  FlowState,
  Location,
} from '../types.js';
import { buildAuthFlow } from './auth.js';

export function buildCrossPage(components: ComponentModel[], routes: RouteModel[]): CrossPageModel {
  const pageCtaTexts = new Map<string, string[]>();
  const actionVerbs = new Map<string, string[]>();

  // Gather CTA texts per page file
  for (const comp of components) {
    if (comp.ctaTexts.length > 0) {
      pageCtaTexts.set(comp.file, comp.ctaTexts);
    }

    // Bucket action verbs
    for (const cta of comp.ctaTexts) {
      const buckets: Array<[string, RegExp]> = [
        ['create', /\bcreate|add|new\b/i],
        ['edit', /\bedit|update|modify\b/i],
        ['delete', /\bdelete|remove\b/i],
        ['save', /\bsave|submit\b/i],
        ['cancel', /\bcancel|dismiss\b/i],
        ['view', /\bview|see|show|open\b/i],
      ];
      for (const [bucket, re] of buckets) {
        if (re.test(cta)) {
          const arr = actionVerbs.get(bucket) ?? [];
          if (!arr.includes(cta)) arr.push(cta);
          actionVerbs.set(bucket, arr);
        }
      }
    }
  }

  // Detect terminology inconsistencies: same concept, different words across files
  const terminologyInconsistencies: CrossPageModel['terminologyInconsistencies'] = [];
  for (const [concept, variants] of actionVerbs.entries()) {
    if (variants.length > 1) {
      // Multiple different texts for same concept action = inconsistency
      const variantDetails = variants.map((text) => {
        const comp = components.find((c) => c.ctaTexts.includes(text));
        return { text, file: comp?.file ?? 'unknown', line: comp?.line ?? 0 };
      });
      terminologyInconsistencies.push({ concept, variants: variantDetails });
    }
  }

  return { pageCtaTexts, terminologyInconsistencies, actionVerbs };
}

export function buildCrudFlow(writeEndpoints: ApiEndpointModel[], components: ComponentModel[]): UserFlowModel {
  const detectedStates: FlowState[] = [];
  const entryPoints: Location[] = writeEndpoints.map((e) => ({ file: e.file, line: e.line }));

  // Entry: write endpoint exists
  for (const e of writeEndpoints.slice(0, 3)) {
    detectedStates.push({ name: 'entry', location: { file: e.file, line: e.line } });
  }

  // Check components that have form elements for state coverage
  const formComps = components.filter((c) => c.isForm || c.formFields.length > 0);
  for (const comp of formComps) {
    if (comp.hasLoadingState) {
      detectedStates.push({ name: 'loading', location: { file: comp.file, line: comp.line } });
    }
    if (comp.hasErrorState) {
      detectedStates.push({ name: 'error', location: { file: comp.file, line: comp.line } });
    }
    if (comp.hasSuccessState) {
      detectedStates.push({ name: 'success', location: { file: comp.file, line: comp.line } });
    }
    if (comp.hasDisabledState) {
      detectedStates.push({ name: 'disabled', location: { file: comp.file, line: comp.line } });
    }
  }

  const foundStateNames = new Set(detectedStates.map((s) => s.name));
  const expectedStates: FlowState['name'][] = ['entry', 'loading', 'success', 'error', 'validation-error'];
  const missingStates = expectedStates.filter((s) => !foundStateNames.has(s));

  return {
    name: 'crud',
    detectedStates,
    missingStates,
    entryPoints,
  };
}

export function detectUserFlows(
  routes: RouteModel[],
  components: ComponentModel[],
  apiEndpoints: ApiEndpointModel[],
): UserFlowModel[] {
  const flows: UserFlowModel[] = [];

  // Auth flow
  const authRoutes = routes.filter((r) => r.type === 'auth');
  if (authRoutes.length > 0) {
    const isLogin = authRoutes.find((r) => /login|sign-in/i.test(r.path));
    const isSignup = authRoutes.find((r) => /signup|register|sign-up/i.test(r.path));

    if (isLogin || isSignup) {
      flows.push(buildAuthFlow(authRoutes, components));
    }
  }

  // CRUD flows — detect from API endpoints with write operations
  const writeEndpoints = apiEndpoints.filter((e) =>
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.method.toUpperCase()),
  );

  if (writeEndpoints.length > 0) {
    flows.push(buildCrudFlow(writeEndpoints, components));
  }

  return flows;
}
