import type { FilePayload } from './types.js';

/**
 * Detect framework from package.json dependencies.
 */
export function detectFramework(payloads: FilePayload[]): string | undefined {
  for (const f of payloads) {
    if (!f.relPath.endsWith('package.json') || f.relPath.includes('/')) {
      // Only root package.json
      if (f.relPath !== 'package.json') continue;
    }
    try {
      const pkg = JSON.parse(f.content) as Record<string, unknown>;
      const deps = {
        ...((pkg['dependencies'] ?? {}) as Record<string, string>),
        ...((pkg['devDependencies'] ?? {}) as Record<string, string>),
      };
      if (deps['next']) return 'nextjs';
      if (deps['@remix-run/react']) return 'remix';
      if (deps['nuxt']) return 'nuxt';
      if (deps['@sveltejs/kit']) return 'sveltekit';
      if (deps['astro']) return 'astro';
      if (deps['react']) return 'react';
      if (deps['vue']) return 'vue';
    } catch {
      // Malformed JSON
    }
  }
  return undefined;
}
