// ─── Env File Discovery ──────────────────────────────────────────────────────

import fg from "fast-glob";

/**
 * Discover all `.env*` files in a directory tree, following common
 * naming conventions: `.env`, `.env.local`, `.env.development`, etc.
 *
 * Excludes `node_modules`, `.git`, `dist`, and `build` directories.
 */
export async function findEnvFiles(dir: string): Promise<string[]> {
  const matches = await fg(["**/.env", "**/.env.*"], {
    cwd: dir,
    dot: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.bilt/**",
      "**/venv/**",
      "**/.venv/**",
      "**/__pycache__/**",
      "**/.next/**",
      "**/.nuxt/**",
      "**/.cache/**",
      "**/.vercel/**",
      "**/.netlify/**",
    ],
    absolute: true,
    onlyFiles: true,
  });
  return matches;
}
