// ─── L0: Safe Repository Walker ───────────────────────────────────────────────
// Traverses untrusted directories with strict bounds: blocks symlink escaping,
// limits path lengths, skips binaries, and never follows out-of-repo targets.
// ─────────────────────────────────────────────────────────────────────────────

import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { LIMITS, type IngestedFile } from "./limits.js";

function isBinary(buffer: Buffer): boolean {
  // Check the first 1024 bytes for null bytes
  const len = Math.min(buffer.length, 1024);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export async function* walkRepo(
  root: string,
  ignore?: (rel: string) => boolean,
): AsyncGenerator<IngestedFile> {
  const realRoot = await realpath(root);
  let files = 0;
  let totalBytes = 0;

  async function* visit(dir: string): AsyncGenerator<IngestedFile> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = path
        .relative(realRoot, abs)
        .split(path.sep)
        .join("/")
        .normalize("NFC");

      if (rel.length > LIMITS.maxPathLength) {
        continue;
      }

      if (ignore && ignore(rel)) {
        continue;
      }

      const st = await lstat(abs).catch(() => null);
      if (!st) continue;

      if (st.isSymbolicLink()) {
        // Never follow symlinks that leave the repo root
        const target = await realpath(abs).catch(() => null);
        if (!target || !target.startsWith(realRoot + path.sep)) {
          yield {
            path: rel,
            bytes: Buffer.alloc(0),
            sha256: "",
            skipped: "symlink-escape",
          };
        }
        // In-repo symlinks are reached via their actual target directory traversal
        continue;
      }

      if (st.isDirectory()) {
        yield* visit(abs);
        continue;
      }

      if (!st.isFile()) {
        continue;
      }

      if (++files > LIMITS.maxFiles || (totalBytes += st.size) > LIMITS.maxTotalBytes) {
        yield {
          path: rel,
          bytes: Buffer.alloc(0),
          sha256: "",
          skipped: "limit-reached",
        };
        return;
      }

      if (st.size > LIMITS.maxFileBytes) {
        yield {
          path: rel,
          bytes: Buffer.alloc(0),
          sha256: "",
          skipped: "too-large",
        };
        continue;
      }

      const bytes = await readFile(abs).catch(() => null);
      if (!bytes) continue;

      if (isBinary(bytes)) {
        yield {
          path: rel,
          bytes: Buffer.alloc(0),
          sha256: "",
          skipped: "binary",
        };
        continue;
      }

      const sha256 = createHash("sha256").update(bytes).digest("hex");
      yield {
        path: rel,
        bytes,
        sha256,
      };
    }
  }

  yield* visit(realRoot);
}
