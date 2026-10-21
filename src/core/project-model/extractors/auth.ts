import path from 'node:path';
import type { AuthModel, RouteModel, ComponentModel, UserFlowModel, FlowState, Location } from '../types.js';
import type { FilePayload } from './types.js';

export function buildAuthFlow(authRoutes: RouteModel[], components: ComponentModel[]): UserFlowModel {
  const detectedStates: FlowState[] = [];
  const entryPoints: Location[] = authRoutes.map((r) => ({ file: r.file }));

  // Entry: auth route exists
  for (const r of authRoutes) {
    detectedStates.push({ name: 'entry', location: { file: r.file } });
  }

  // Loading: check components in auth files
  const authComps = components.filter((c) =>
    authRoutes.some((r) => r.file.includes(path.dirname(c.file))),
  );
  for (const comp of authComps) {
    if (comp.hasLoadingState) {
      detectedStates.push({ name: 'loading', location: { file: comp.file, line: comp.line } });
    }
    if (comp.hasErrorState) {
      detectedStates.push({ name: 'error', location: { file: comp.file, line: comp.line } });
    }
    if (comp.hasSuccessState) {
      detectedStates.push({ name: 'success', location: { file: comp.file, line: comp.line } });
    }
  }

  // Missing states
  const foundStateNames = new Set(detectedStates.map((s) => s.name));
  const expectedStates = ['entry', 'loading', 'error', 'validation-error'];
  const missingStates = expectedStates.filter((s) => !foundStateNames.has(s as FlowState['name']));

  return {
    name: 'auth',
    detectedStates,
    missingStates,
    entryPoints,
  };
}

export function extractAuth(payloads: FilePayload[], routes: RouteModel[]): AuthModel {
  const providers = new Set<string>();
  const authMiddlewareFiles: string[] = [];
  let hasAuthentication = false;

  for (const f of payloads) {
    const content = f.content;

    // Provider detection from imports
    if (/from ['"]@clerk\//i.test(content) || /ClerkProvider/i.test(content)) {
      providers.add('clerk'); hasAuthentication = true;
    }
    if (/from ['"]next-auth/i.test(content) || /NextAuthProvider/i.test(content)) {
      providers.add('nextauth'); hasAuthentication = true;
    }
    if (/from ['"]@supabase\/auth/i.test(content) || /supabase\.auth\./i.test(content)) {
      providers.add('supabase'); hasAuthentication = true;
    }
    if (/from ['"]firebase\/auth/i.test(content) || /getAuth\(\)/i.test(content)) {
      providers.add('firebase'); hasAuthentication = true;
    }
    if (/from ['"]lucia/i.test(content) || /new Lucia\(/i.test(content)) {
      providers.add('lucia'); hasAuthentication = true;
    }
    if (/from ['"]better-auth/i.test(content)) {
      providers.add('better-auth'); hasAuthentication = true;
    }
    if (/passport\.use|PassportStrategy/i.test(content)) {
      providers.add('passport'); hasAuthentication = true;
    }

    // Middleware file detection
    if (
      f.relPath.includes('middleware') &&
      /auth|protect|requireAuth|getServerSession|clerkMiddleware/i.test(content)
    ) {
      authMiddlewareFiles.push(f.relPath);
    }
  }

  const protectedRoutes = routes
    .filter((r) => r.type !== 'auth' && r.type !== 'api')
    .map((r) => r.path)
    .filter((p) => !['/', '/about', '/pricing', '/blog'].includes(p));

  const publicRoutes = routes
    .filter((r) => r.type === 'auth' || ['/', '/about', '/pricing', '/blog'].includes(r.path))
    .map((r) => r.path);

  return {
    hasAuthentication,
    providers: Array.from(providers),
    protectedRoutes: protectedRoutes.slice(0, 50),
    publicRoutes: publicRoutes.slice(0, 20),
    authMiddlewareFiles,
  };
}
