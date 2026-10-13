// ─── ProjectModel Normalizer ───────────────────────────────────────────────────
// Converts raw JSX/HTML text into structural signatures for structural comparison.
// Content-agnostic: ignores classes, ids, text — only structure matters.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Structural Node Representation ──────────────────────────────────────────

interface StructNode {
  tag: string;
  children: StructNode[];
}

// ─── Tag Normalisation ────────────────────────────────────────────────────────

/** Map JSX/HTML tags to canonical compact names for structural signatures */
function normalizeTag(raw: string): string {
  const t = raw.toLowerCase();

  // Structural containers
  if (t === 'section' || t === 'article' || t === 'main') return 'section';
  if (t === 'header') return 'header';
  if (t === 'footer') return 'footer';
  if (t === 'nav') return 'nav';
  if (t === 'div' || t === 'span') return 'div';
  if (t === 'ul' || t === 'ol') return 'list';
  if (t === 'li') return 'li';
  if (t === 'form') return 'form';
  if (t === 'fieldset') return 'fieldset';
  if (t === 'label') return 'label';

  // Typography
  if (/^h[1-6]$/.test(t)) return 'h';
  if (t === 'p' || t === 'span' || t === 'em' || t === 'strong') return 'p';

  // Interactive
  if (t === 'button') return 'button';
  if (t === 'a') return 'a';
  if (t === 'input') return 'input';
  if (t === 'select') return 'select';
  if (t === 'textarea') return 'textarea';

  // Media
  if (t === 'img' || t === 'picture' || t === 'video' || t === 'audio') return 'img';
  if (t === 'svg') return 'icon';
  if (t === 'table') return 'table';
  if (t === 'thead' || t === 'tbody' || t === 'tr' || t === 'th' || t === 'td') return 'tr';

  // Common PascalCase components - icon detection
  if (/icon$/i.test(raw)) return 'icon';
  if (/^(Skeleton|Spinner|Loading)/i.test(raw)) return 'loading';
  if (/^(Modal|Dialog|Drawer)/i.test(raw)) return 'modal';
  if (/^(Badge|Tag|Chip|Pill)/i.test(raw)) return 'badge';
  if (/^(Avatar|Image|Img)/i.test(raw)) return 'img';
  if (/^(Card)/i.test(raw)) return 'card';
  if (/^(Button|Btn)/i.test(raw)) return 'button';
  if (/^(Link)/i.test(raw)) return 'a';
  if (/^(Input|TextField)/i.test(raw)) return 'input';
  if (/^(Select|Dropdown|Combobox)/i.test(raw)) return 'select';

  // Unknown PascalCase component
  if (/^[A-Z]/.test(raw)) return 'comp';

  return 'el';
}

// ─── JSX/HTML Tokenizer ───────────────────────────────────────────────────────

interface Token {
  type: 'open' | 'selfclose' | 'close' | 'text';
  tag?: string;
}

/**
 * Minimal JSX/HTML tokenizer — extracts open, close, and self-closing tags.
 * Does not parse attributes. Ignores comments and string literals.
 */
function tokenize(raw: string): Token[] {
  const tokens: Token[] = [];
  // Strip JSX expressions and string literals to avoid false tag matches
  const cleaned = raw
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')       // JSX comments
    .replace(/<!--[\s\S]*?-->/g, '')              // HTML comments
    .replace(/`[^`]*`/g, '``')                   // template literals
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')         // double-quoted strings
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");        // single-quoted strings

  // Match tags: <Tag attrs />, <Tag attrs>, </Tag>
  const tagRe = /<(\/?)([A-Za-z][A-Za-z0-9._-]*)(?:[^>]*)?(\/?)>/g;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(cleaned)) !== null) {
    const isClose = m[1] === '/';
    const tagName = m[2] ?? '';
    const isSelf = m[3] === '/';

    if (isClose) {
      tokens.push({ type: 'close', tag: tagName });
    } else if (isSelf) {
      tokens.push({ type: 'selfclose', tag: tagName });
    } else {
      tokens.push({ type: 'open', tag: tagName });
    }
  }

  return tokens;
}

// ─── Token → Tree ─────────────────────────────────────────────────────────────

/** Maximum depth to descend — prevents runaway recursion on deeply nested templates */
const MAX_DEPTH = 12;
/** Maximum children captured per node */
const MAX_CHILDREN = 20;

function buildTree(tokens: Token[], idx: number, depth: number): { node: StructNode; next: number } {
  const tok = tokens[idx];
  if (!tok || tok.type !== 'open') {
    return { node: { tag: 'el', children: [] }, next: idx + 1 };
  }

  const node: StructNode = { tag: normalizeTag(tok.tag ?? 'el'), children: [] };
  let i = idx + 1;

  while (i < tokens.length) {
    const cur = tokens[i];
    if (!cur) break;

    if (cur.type === 'close') {
      i++;
      break;
    }

    if (cur.type === 'selfclose') {
      if (depth < MAX_DEPTH && node.children.length < MAX_CHILDREN) {
        node.children.push({ tag: normalizeTag(cur.tag ?? 'el'), children: [] });
      }
      i++;
      continue;
    }

    if (cur.type === 'open') {
      if (depth < MAX_DEPTH && node.children.length < MAX_CHILDREN) {
        const child = buildTree(tokens, i, depth + 1);
        node.children.push(child.node);
        i = child.next;
      } else {
        // Skip subtree: advance past matching close
        i = skipSubtree(tokens, i);
      }
      continue;
    }

    i++;
  }

  return { node, next: i };
}

/** Advance past a subtree rooted at tokens[start] (which is an 'open' token) */
function skipSubtree(tokens: Token[], start: number): number {
  let depth = 0;
  for (let i = start; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) break;
    if (t.type === 'open') depth++;
    else if (t.type === 'close') {
      depth--;
      if (depth <= 0) return i + 1;
    }
  }
  return tokens.length;
}

// ─── Tree → Signature ─────────────────────────────────────────────────────────

/**
 * Serialise a StructNode tree into a compact, content-free structural signature.
 * Consecutive identical children are collapsed with *N notation.
 *
 * Examples:
 *   section>div>(div>(icon+h+p+button))*3
 *   form>(label+input)*4+button
 */
function serializeNode(node: StructNode): string {
  if (node.children.length === 0) return node.tag;

  const childSigs: string[] = node.children.map(serializeNode);
  const collapsed = collapseRepeating(childSigs);
  const childStr = collapsed.length === 1 ? (collapsed[0] ?? '') : collapsed.join('+');
  return `${node.tag}>(${childStr})`;
}

function collapseRepeating(sigs: string[]): string[] {
  if (sigs.length === 0) return [];
  const result: string[] = [];
  let i = 0;

  while (i < sigs.length) {
    const cur = sigs[i]!;
    let count = 1;
    while (i + count < sigs.length && sigs[i + count] === cur) count++;
    result.push(count > 1 ? `(${cur})*${count}` : cur);
    i += count;
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse JSX/HTML structure from raw text and return a canonical structural
 * signature string like `"section>(div>(icon+h+p+button))*3"`.
 *
 * Content-agnostic: ignores classes, ids, and text — only element structure matters.
 * Used to detect structurally identical/similar components.
 */
export function normalizeComponentTree(rawText: string): string {
  const tokens = tokenize(rawText.slice(0, 50_000)); // cap at 50k chars
  if (tokens.length === 0) return 'unknown';

  // Find the first open token as root
  const rootIdx = tokens.findIndex((t) => t.type === 'open');
  if (rootIdx === -1) {
    // Only self-closing tags (e.g. pure icon or input)
    const selfTags = tokens
      .filter((t) => t.type === 'selfclose')
      .map((t) => normalizeTag(t.tag ?? 'el'));
    return selfTags.slice(0, 10).join('+') || 'el';
  }

  const { node } = buildTree(tokens, rootIdx, 0);
  const sig = serializeNode(node);
  // Truncate very long signatures
  return sig.length > 500 ? sig.slice(0, 497) + '...' : sig;
}

// ─── Structural Similarity ────────────────────────────────────────────────────

/**
 * Compute structural similarity between two signatures on a 0–1 scale.
 *
 * Strategy: normalised edit distance on the signature token sequences.
 * Fast and deterministic — no LLM involved.
 */
export function structuralSimilarity(sig1: string, sig2: string): number {
  if (sig1 === sig2) return 1.0;
  if (!sig1 || !sig2) return 0.0;

  // Tokenise signatures by splitting on structural punctuation
  const tok1 = tokenizeSignature(sig1);
  const tok2 = tokenizeSignature(sig2);

  const distance = levenshtein(tok1, tok2);
  const maxLen = Math.max(tok1.length, tok2.length);
  if (maxLen === 0) return 1.0;

  return 1.0 - distance / maxLen;
}

/** Split a structural signature into tokens for comparison */
function tokenizeSignature(sig: string): string[] {
  // Split on '>', '(', ')', '+', '*', and numbers — each is a meaningful unit
  return sig.split(/([>()+*]|\d+)/).filter((s) => s.trim().length > 0);
}

/** Classic Levenshtein distance on string arrays (token edit distance) */
function levenshtein(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use two rows to save memory
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,        // deletion
        (curr[j - 1] ?? 0) + 1,   // insertion
        (prev[j - 1] ?? 0) + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n] ?? 0;
}
