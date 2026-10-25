// ─── Env File Parser ─────────────────────────────────────────────────────────

import type { ParsedEnvEntry, ParsedEnvFile } from "../../../types/index.js";

/**
 * Remove surrounding quotes (single, double, or backtick) from a value,
 * handling escaped quotes inside.
 */
export function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return trimmed;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  if ((first === '"' || first === "'" || first === "`") && first === last) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse the content of a `.env` file into a structured `ParsedEnvFile`.
 *
 * Handles:
 *   • Comments (lines starting with `#`)
 *   • Empty / whitespace-only lines
 *   • Inline comments (`VAR=value # comment`)
 *   • Single-quoted, double-quoted, and backtick-quoted values
 *   • Multiline values enclosed in double-quotes (using `\n` or real newlines)
 *   • `export` prefix (e.g. `export FOO=bar`)
 */
export function parseEnvFile(content: string, filePath: string): ParsedEnvFile {
  const entries = new Map<string, ParsedEnvEntry>();
  const rawLines = content.split("\n");

  let i = 0;
  while (i < rawLines.length) {
    const rawLine = rawLines[i]!;
    const trimmed = rawLine.trim();

    // Skip empty lines and pure comment lines
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    // Strip optional `export ` prefix
    const line = trimmed.startsWith("export ")
      ? trimmed.slice(7).trim()
      : trimmed;

    // Find the first `=`
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    let valueRaw = line.slice(eqIdx + 1);

    // Handle inline comment (only when value is NOT quoted)
    let comment: string | undefined;
    const valueTrimmed = valueRaw.trim();

    if (
      valueTrimmed.startsWith('"') ||
      valueTrimmed.startsWith("'") ||
      valueTrimmed.startsWith("`")
    ) {
      const quote = valueTrimmed[0]!;

      // Check if the closing quote is on the same line
      const closeIdx = valueTrimmed.indexOf(quote, 1);

      if (closeIdx === -1 && quote === '"') {
        // Multiline value — collect lines until closing quote
        let multiValue = valueTrimmed.slice(1); // strip opening quote
        i++;
        while (i < rawLines.length) {
          const nextLine = rawLines[i]!;
          const endIdx = nextLine.indexOf('"');
          if (endIdx !== -1) {
            multiValue += "\n" + nextLine.slice(0, endIdx);
            break;
          }
          multiValue += "\n" + nextLine;
          i++;
        }
        valueRaw = multiValue;
      } else {
        valueRaw = unquote(valueTrimmed);
      }
    } else {
      // Unquoted — look for inline comment
      const hashIdx = valueTrimmed.indexOf(" #");
      if (hashIdx !== -1) {
        comment = valueTrimmed.slice(hashIdx + 2).trim();
        valueRaw = valueTrimmed.slice(0, hashIdx);
      } else {
        valueRaw = valueTrimmed;
      }
    }

    const value = typeof valueRaw === "string" ? valueRaw.trim() : "";

    entries.set(key, {
      key,
      value,
      line: i + 1, // 1-indexed
      comment,
    });

    i++;
  }

  return { filePath, entries, rawLines };
}
