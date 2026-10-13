// ─── L6: Component Tree Normalization ─────────────────────────────────────────
// Normalizes JSX/HTML component trees into canonical structural nodes by stripping
// presentational wrappers, class names, and text content.
// ─────────────────────────────────────────────────────────────────────────────

export type Slot =
  | "icon"
  | "media"
  | "eyebrow"
  | "heading"
  | "text"
  | "cta"
  | "badge"
  | "list"
  | "container"
  | "decoration";

export interface NormalizedNode {
  slot: Slot;
  layout?: "row" | "col" | "grid" | "stack";
  children: NormalizedNode[];
}

export function shapeKey(n: NormalizedNode): string {
  const childKeys = n.children.map(shapeKey).join(",");
  const layoutSuffix = n.layout ? `:${n.layout}` : "";
  return `${n.slot}${layoutSuffix}(${childKeys})`;
}

export function classifySlot(tagName: string, classes: string = "", text: string = ""): Slot {
  const lowerTag = tagName.toLowerCase();
  const lowerCls = classes.toLowerCase();

  if (/h[1-6]/.test(lowerTag) || lowerCls.includes("text-4xl") || lowerCls.includes("text-5xl")) {
    return "heading";
  }
  if (
    lowerCls.includes("eyebrow") ||
    lowerCls.includes("uppercase") && lowerCls.includes("tracking-wider")
  ) {
    return "eyebrow";
  }
  if (
    lowerTag === "button" ||
    lowerTag === "a" ||
    lowerCls.includes("btn") ||
    lowerCls.includes("cta")
  ) {
    return "cta";
  }
  if (
    lowerTag === "img" ||
    lowerTag === "video" ||
    lowerTag === "svg" ||
    lowerTag === "icon" ||
    lowerCls.includes("icon") ||
    lowerCls.includes("lucide")
  ) {
    return "icon";
  }
  if (lowerTag === "p" || lowerTag === "span") {
    return "text";
  }
  if (lowerTag === "ul" || lowerTag === "ol" || lowerCls.includes("grid-cols-") || lowerCls.includes("flex-row")) {
    return "list";
  }
  if (
    lowerCls.includes("blur") ||
    lowerCls.includes("gradient-radial") ||
    lowerCls.includes("absolute")
  ) {
    return "decoration";
  }

  return "container";
}

export function normalizeComponentTree(jsxText: string): NormalizedNode {
  const rootChildren: NormalizedNode[] = [];

  // Match JSX elements: <TagName className="..." ...>
  const tagRegex = /<([a-zA-Z0-9_.-]+)([^>]*)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(jsxText)) !== null) {
    const tagName = match[1]!;
    if (tagName.startsWith("/") || tagName === "React.Fragment" || tagName === "") continue;

    const attrs = match[2] || "";
    const classMatch = /className\s*=\s*["']([^"']+)["']/.exec(attrs);
    const classes = classMatch ? classMatch[1]! : "";

    const slot = classifySlot(tagName, classes);
    if (slot !== "container") {
      rootChildren.push({
        slot,
        children: [],
      });
    }
  }

  return {
    slot: "container",
    layout: "col",
    children: rootChildren,
  };
}

export function structuralSimilarity(a: string | NormalizedNode, b: string | NormalizedNode): number {
  const keyA = typeof a === "string" ? a : shapeKey(a);
  const keyB = typeof b === "string" ? b : shapeKey(b);
  if (keyA === keyB) return 1.0;
  const tokensA = keyA.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const tokensB = keyB.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 1.0 : intersection / union;
}
