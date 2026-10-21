import type { ApiEndpointModel } from '../types.js';

export interface AuthorizationSummary {
  roleChecksCount: number;
  ownershipChecksCount: number;
  tenantChecksCount: number;
  unprotectedMutations: string[];
}

/**
 * Analyze authorization patterns across API endpoints and components.
 */
export function extractAuthorizationPatterns(
  endpoints: ApiEndpointModel[],
): AuthorizationSummary {
  let roleChecksCount = 0;
  let ownershipChecksCount = 0;
  let tenantChecksCount = 0;
  const unprotectedMutations: string[] = [];

  for (const ep of endpoints) {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(ep.method.toUpperCase());
    const content = ep.handlerContent || '';

    if (/role|isAdmin|permission|hasRole|can\(/i.test(content)) {
      roleChecksCount++;
    }
    if (ep.hasOwnershipCheck || /ownerId|userId.*===/i.test(content)) {
      ownershipChecksCount++;
    }
    if (/tenantId|organizationId|workspaceId|orgId/i.test(content)) {
      tenantChecksCount++;
    }

    if (isMutation && !ep.hasAuthCheck && !/public/i.test(ep.path)) {
      unprotectedMutations.push(`${ep.method} ${ep.path}`);
    }
  }

  return {
    roleChecksCount,
    ownershipChecksCount,
    tenantChecksCount,
    unprotectedMutations,
  };
}
