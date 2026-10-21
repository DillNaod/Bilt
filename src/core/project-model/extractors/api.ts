import type { ApiEndpointModel, DbOperation } from '../types.js';
import type { FilePayload } from './types.js';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

export function detectDbOperations(content: string): DbOperation[] {
  const ops: DbOperation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNum = i + 1;

    // Read operations
    if (/\.find(?:One|Many|First|Unique)?\s*\(|\.get\s*\(|SELECT\b/i.test(line)) {
      const usesParamDirectly = /params\.|req\.params|request\.params/i.test(line) &&
        !/userId|ownerId/i.test(line);
      const modelMatch = line.match(/(\w+)\.(find|get|select)/i);
      ops.push({ type: 'read', model: modelMatch?.[1], usesParamDirectly, line: lineNum });
    }
    // Write operations
    if (/\.create\s*\(|\.update(?:One|Many)?\s*\(|\.upsert\s*\(|INSERT\b|UPDATE\b/i.test(line)) {
      const usesParamDirectly = /params\./i.test(line) && !/userId/i.test(line);
      const modelMatch = line.match(/(\w+)\.(create|update|upsert)/i);
      ops.push({ type: 'write', model: modelMatch?.[1], usesParamDirectly, line: lineNum });
    }
    // Delete operations
    if (/\.delete(?:One|Many)?\s*\(|\.remove\s*\(|DELETE\b/i.test(line)) {
      const usesParamDirectly = /params\./i.test(line) && !/userId/i.test(line);
      const modelMatch = line.match(/(\w+)\.(delete|remove)/i);
      ops.push({ type: 'delete', model: modelMatch?.[1], usesParamDirectly, line: lineNum });
    }
  }

  return ops;
}

export function detectSensitiveFields(content: string): string[] {
  const sensitive: string[] = [];
  const fields = ['password', 'passwordHash', 'secret', 'token', 'apiKey', 'privateKey', 'ssn', 'creditCard'];
  for (const field of fields) {
    if (new RegExp(`\\b${field}\\b`, 'i').test(content)) {
      sensitive.push(field);
    }
  }
  return sensitive;
}

export function analyzeEndpoint(
  method: string,
  apiPath: string,
  file: string,
  line: number,
  framework: string,
  handlerContent: string,
): ApiEndpointModel {
  const c = handlerContent;

  // Auth check detection
  const hasAuthCheck =
    /getServerSession|auth\(\)|getSession|verifyToken|requireAuth|currentUser|protect|middleware/i.test(c) ||
    /authorization|bearer|jwt\.verify|clerkClient|validateSession/i.test(c);
  let authCheckType: ApiEndpointModel['authCheckType'];
  if (hasAuthCheck) {
    if (/session|getServerSession|getSession/i.test(c)) authCheckType = 'session';
    else if (/jwt|verifyToken|bearer/i.test(c)) authCheckType = 'jwt';
    else if (/middleware|protect/i.test(c)) authCheckType = 'middleware';
    else authCheckType = 'unknown';
  }

  // Ownership check: does the handler compare userId with resource.userId?
  const hasOwnershipCheck = /(?:userId|user_id|ownerId|owner_id).*(?:===|!==|==)|where.*userId/i.test(c);

  // Input validation
  const hasInputValidation = /\.parse\(|\.safeParse\(|validate\(|check\(|schema\.validate|Joi\.object|yup\.object/i.test(c);
  let validationLibrary: string | undefined;
  if (hasInputValidation) {
    if (/zod|\.parse\(|z\./i.test(c)) validationLibrary = 'zod';
    else if (/joi|Joi\./i.test(c)) validationLibrary = 'joi';
    else if (/yup|yup\./i.test(c)) validationLibrary = 'yup';
    else if (/express-validator|check\(/i.test(c)) validationLibrary = 'express-validator';
  }

  // Body usage
  const acceptsReqBody = /req\.body|request\.json\(\)|formData\(\)/i.test(c);
  const hasExplicitFieldSelection = /const\s*\{[^}]+\}\s*=\s*(?:req\.body|await\s+req|body)/i.test(c);
  // Mass assignment: passing req.body directly to db call
  const passesBodyToDb = acceptsReqBody && !hasExplicitFieldSelection &&
    (/(?:create|update|upsert|insert|save|findOneAndUpdate)\s*\(\s*(?:req\.body|body)/i.test(c) ||
     /data\s*:\s*(?:req\.body|body)/i.test(c) ||
     /Object\.assign\s*\([^,]+,\s*(?:req\.body|body)/i.test(c));

  // DB operations
  const dbOperations: DbOperation[] = detectDbOperations(c);

  // Sensitive fields in response
  const sensitiveFieldsInResponse = detectSensitiveFields(c);

  return {
    method,
    path: apiPath,
    file,
    line,
    framework,
    handlerContent,
    hasAuthCheck,
    authCheckType,
    hasOwnershipCheck,
    hasInputValidation,
    validationLibrary,
    acceptsReqBody,
    passesBodyToDb,
    hasExplicitFieldSelection,
    dbOperations,
    sensitiveFieldsInResponse,
  };
}

export function extractNextAppRouteEndpoints(
  file: string,
  content: string,
  out: ApiEndpointModel[],
): void {
  let apiPath = file
    .replace(/^.*?(?:src[/\\])?app[/\\]/i, '/')
    .replace(/[/\\]route\.(ts|js|tsx|jsx)$/i, '')
    .replace(/\\/g, '/');
  if (!apiPath.startsWith('/')) apiPath = '/' + apiPath;
  apiPath = apiPath.replace(/\[([^\]]+)\]/g, ':$1');

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    for (const method of HTTP_METHODS) {
      const re = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`, 'i');
      const re2 = new RegExp(`export\\s+const\\s+${method}\\b`, 'i');
      if (re.test(line) || re2.test(line)) {
        const handlerContent = lines.slice(i, Math.min(lines.length, i + 50)).join('\n');
        out.push(analyzeEndpoint(method, apiPath, file, i + 1, 'nextjs', handlerContent));
      }
    }
  }
}

export function extractNextPagesApiEndpoints(
  file: string,
  content: string,
  out: ApiEndpointModel[],
): void {
  let apiPath = file
    .replace(/^.*?(?:src[/\\])?pages[/\\]/i, '/')
    .replace(/\.(ts|js|tsx|jsx)$/i, '')
    .replace(/\/index$/, '')
    .replace(/\\/g, '/');
  if (!apiPath.startsWith('/')) apiPath = '/' + apiPath;
  apiPath = apiPath.replace(/\[([^\]]+)\]/g, ':$1');

  const methodMatches = content.matchAll(/req\.method\s*===\s*['"]([A-Z]+)['"]/g);
  const methods = new Set<string>();
  for (const m of methodMatches) {
    if (m[1]) methods.add(m[1]);
  }
  if (methods.size === 0) methods.add('ALL');

  for (const method of methods) {
    out.push(analyzeEndpoint(method, apiPath, file, 1, 'nextjs', content));
  }
}

export function extractExpressEndpoints(
  file: string,
  content: string,
  out: ApiEndpointModel[],
): void {
  const lines = content.split('\n');
  const routeRe = /(?:app|router|fastify|server)\.(get|post|put|patch|delete|all|use)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    routeRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = routeRe.exec(line)) !== null) {
      const method = (m[1] ?? 'all').toUpperCase();
      const routePath = m[2] ?? '/';
      let endIdx = Math.min(lines.length, i + 40);
      for (let j = i + 1; j < endIdx; j++) {
        if (/^(?:router|app|fastify|server)\.(?:get|post|put|patch|delete|all|use)\b/i.test(lines[j]?.trim() ?? '')) {
          endIdx = j;
          break;
        }
      }
      const handlerContent = lines.slice(i, endIdx).join('\n');
      const framework = content.includes('fastify') ? 'fastify' : 'express';
      out.push(analyzeEndpoint(method, routePath, file, i + 1, framework, handlerContent));
    }
  }
}

export function extractApiEndpoints(payloads: FilePayload[]): ApiEndpointModel[] {
  const endpoints: ApiEndpointModel[] = [];

  for (const f of payloads) {
    const rel = f.relPath;
    const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
    if (!['.ts', '.js', '.tsx', '.jsx'].includes(ext)) continue;

    // Next.js App Router: app/**/route.ts
    if (/(?:^|[/\\])(?:src[/\\])?app[/\\].*route\.(ts|js|tsx|jsx)$/i.test(rel)) {
      extractNextAppRouteEndpoints(rel, f.content, endpoints);
    }
    // Next.js Pages Router: pages/api/**
    else if (/(?:^|[/\\])(?:src[/\\])?pages[/\\]api[/\\]/i.test(rel)) {
      extractNextPagesApiEndpoints(rel, f.content, endpoints);
    }
    // Express/Fastify patterns
    else if (/(?:app|router|fastify)\.(get|post|put|patch|delete|all)\s*\(/i.test(f.content)) {
      extractExpressEndpoints(rel, f.content, endpoints);
    }
  }

  return endpoints;
}
