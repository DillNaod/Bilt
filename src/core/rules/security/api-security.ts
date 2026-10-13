// ─── API Security Rules ───────────────────────────────────────────────────────
// Evaluates per-endpoint security models: authentication boundaries, authorization,
// resource ownership (IDOR/BOLA), mass assignment, and sensitive data exposure.
// ─────────────────────────────────────────────────────────────────────────────

import type { RegisteredRule, RuleFinding } from '../../rule-registry/types.js';
import type { ProjectModel } from '../../project-model/types.js';

// ---------------------------------------------------------------------------
// SEC-API-001: Missing Authentication on Sensitive Endpoints
// ---------------------------------------------------------------------------
export const secApi001: RegisteredRule = {
  id: 'SEC-API-001',
  category: 'security-api',
  title: 'Missing Authentication on Sensitive API Endpoint',
  severity: 'critical',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const sensitiveRegex = /\/(admin|users?|account|billing|payments?|settings|api\/keys)\b/i;

    for (const ep of model.apiEndpoints) {
      const hasAuth = ep.hasAuthCheck || ep.hasAuth;
      if (hasAuth) continue;

      if (sensitiveRegex.test(ep.path)) {
        findings.push({
          ruleId: 'SEC-API-001',
          title: `Sensitive API Endpoint Lacks Authentication Guard: ${ep.method} ${ep.path}`,
          severity: 'critical',
          precision: 'high',
          maturity: 'stable',
          category: 'security-api',
          evidence: [
            `${ep.method} ${ep.path} exposed without authentication middleware`,
            `Route handles sensitive resources matching /admin|users|account|billing|settings/`,
            `Handler located at: ${ep.file}:${ep.line}`,
            'Any unauthenticated caller on the public network can invoke this endpoint directly.',
          ],
          locations: [{ file: ep.file, line: ep.line }],
          agentObjective:
            'Attach authentication middleware (e.g. requireAuth, withAuth) to this route handler before executing any handler logic.',
        });
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// SEC-API-002: Authentication Without Authorization (IDOR / BOLA)
// ---------------------------------------------------------------------------
export const secApi002: RegisteredRule = {
  id: 'SEC-API-002',
  category: 'security-api',
  title: 'Authentication Without Authorization: Parameter Query Lacks Resource Ownership Check (IDOR)',
  severity: 'critical',
  precision: 'medium',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const ep of model.apiEndpoints) {
      // Dynamic route parameter detected
      const hasParam = ep.path.includes(':') || ep.path.includes('[') || /req\.params\./i.test(ep.handlerContent);
      if (!hasParam) continue;

      // Has authentication, but NO ownership check
      const hasAuth = ep.hasAuthCheck || ep.hasAuth;
      if (hasAuth && !ep.hasOwnershipCheck) {
        // Look for database operations querying by param ID
        const dbQueryByParam = ep.dbOperations.some((op) => op.usesParamDirectly) ||
          /findUnique|findById|findOne|findFirst|update|delete/i.test(ep.handlerContent);

        if (dbQueryByParam) {
          findings.push({
            ruleId: 'SEC-API-002',
            title: `IDOR / BOLA Risk: Parameter-Based Query Without Ownership Check on ${ep.method} ${ep.path}`,
            severity: 'critical',
            precision: 'medium',
            maturity: 'stable',
            category: 'security-api',
            evidence: [
              `Endpoint: ${ep.method} ${ep.path}`,
              'Authentication check detected, but no resource ownership verification was found.',
              'Database lookup uses client route parameter directly without scoping to authenticated session user ID.',
              `Handler code: ${ep.file}:${ep.line}`,
              'An authenticated user can replace the numeric/UUID parameter with another user\'s ID to view or mutate their records.',
            ],
            locations: [{ file: ep.file, line: ep.line }],
            agentObjective:
              'Scope database queries by both resource ID AND the authenticated user\'s session ID: e.g. db.findFirst({ where: { id: req.params.id, userId: session.user.id } }).',
          });
        }
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// SEC-API-003: Mass Assignment Vulnerability
// ---------------------------------------------------------------------------
export const secApi003: RegisteredRule = {
  id: 'SEC-API-003',
  category: 'security-api',
  title: 'Mass Assignment: Uncontrolled Request Body Passed to Persistence Layer',
  severity: 'high',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const ep of model.apiEndpoints) {
      const isUnsafe = ep.passesBodyToDb || ep.acceptsRawBody;
      const isDestructured = ep.hasExplicitFieldSelection;

      if (isUnsafe && !isDestructured) {
        findings.push({
          ruleId: 'SEC-API-003',
          title: `Mass Assignment Risk on ${ep.method} ${ep.path}`,
          severity: 'high',
          precision: 'high',
          maturity: 'stable',
          category: 'security-api',
          evidence: [
            `Endpoint: ${ep.method} ${ep.path} passes unvalidated request body directly into database mutation.`,
            'Pattern detected: Model.update(req.body) or db.model.update({ data: req.body }) without field allowlisting.',
            `Location: ${ep.file}:${ep.line}`,
            'Callers can inject extra fields (e.g. isAdmin: true, role: "admin", balance: 9999) to overwrite protected model properties.',
          ],
          locations: [{ file: ep.file, line: ep.line }],
          agentObjective:
            'Explicitly destructure allowed fields (const { name, bio } = req.body) or validate with a strict Zod schema before persisting.',
        });
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// SEC-API-004: Missing Input Validation Boundary
// ---------------------------------------------------------------------------
export const secApi004: RegisteredRule = {
  id: 'SEC-API-004',
  category: 'security-api',
  title: 'Missing Schema Validation Boundary on Mutation Endpoint',
  severity: 'medium',
  precision: 'medium',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const mutationMethods = new Set(['POST', 'PUT', 'PATCH']);

    for (const ep of model.apiEndpoints) {
      if (!mutationMethods.has(ep.method.toUpperCase())) continue;

      if (ep.acceptsReqBody && !ep.hasInputValidation) {
        findings.push({
          ruleId: 'SEC-API-004',
          title: `Mutation Endpoint Lacks Input Schema Validation: ${ep.method} ${ep.path}`,
          severity: 'medium',
          precision: 'medium',
          maturity: 'stable',
          category: 'security-api',
          evidence: [
            `${ep.method} ${ep.path} accepts request payloads but lacks schema validation (Zod, Joi, Yup, etc.).`,
            `File: ${ep.file}:${ep.line}`,
            'Unvalidated payloads can cause runtime type errors, unhandled exceptions, or database corruption.',
          ],
          locations: [{ file: ep.file, line: ep.line }],
          agentObjective:
            'Define a strict validation schema (e.g. schema.parse(req.body)) at the controller boundary before business logic execution.',
        });
      }
    }

    return findings;
  },
};

// ---------------------------------------------------------------------------
// SEC-API-005: Sensitive Response Data Exposure
// ---------------------------------------------------------------------------
export const secApi005: RegisteredRule = {
  id: 'SEC-API-005',
  category: 'security-api',
  title: 'Sensitive Data Exposure in API Response',
  severity: 'critical',
  precision: 'high',
  maturity: 'stable',

  detect(model: ProjectModel): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const ep of model.apiEndpoints) {
      if (ep.sensitiveFieldsInResponse && ep.sensitiveFieldsInResponse.length > 0) {
        findings.push({
          ruleId: 'SEC-API-005',
          title: `Sensitive Fields Exposed in API Response on ${ep.method} ${ep.path}`,
          severity: 'critical',
          precision: 'high',
          maturity: 'stable',
          category: 'security-api',
          evidence: [
            `Response from ${ep.method} ${ep.path} appears to leak sensitive internal fields:`,
            ...ep.sensitiveFieldsInResponse.map((f) => `  - "${f}"`),
            `File: ${ep.file}:${ep.line}`,
            'Leaking password hashes, tokens, or private secrets in JSON responses compromises user accounts and violates security compliance.',
          ],
          locations: [{ file: ep.file, line: ep.line }],
          agentObjective:
            'Use an explicit response DTO or Prisma select / exclude clause to omit sensitive columns (passwordHash, secret, token) before serializing to JSON.',
        });
      }
    }

    return findings;
  },
};
