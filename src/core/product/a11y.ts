// ─── L5: Structural Accessibility ─────────────────────────────────────────────
// Analyzes focus management in dialogs, non-interactive clickables, and ARIA relationships.
// ─────────────────────────────────────────────────────────────────────────────

import type { Provenance } from "../facts/fact.js";

export interface DialogA11yModel {
  name: string;
  file: string;
  line: number;
  isManagedByLib: boolean;
  movesFocusIn: boolean;
  restoresFocus: boolean;
  hasTrap: boolean;
  at: Provenance;
}

export function analyzeDialogA11y(
  name: string,
  filePath: string,
  content: string,
  line: number = 1
): DialogA11yModel | null {
  const isDialog =
    /dialog|modal|drawer|sheet/i.test(name) ||
    /role\s*=\s*["']dialog["']|aria-modal\s*=\s*["']true["']/i.test(content) ||
    /<Dialog|<Modal/i.test(content);

  if (!isDialog) return null;

  // Recognized accessibility libraries that automatically handle focus traps & restoration
  const isManagedByLib =
    /@radix-ui\/react-dialog|@headlessui\/react|react-aria|@ark-ui\/react|ariakit|@reach\/dialog/i.test(
      content
    ) || /Dialog\.Root|Dialog\.Content/i.test(content);

  const movesFocusIn =
    isManagedByLib ||
    /\.focus\s*\(\)|autoFocus|initialFocus|focusTrap|FocusTrap/i.test(content);

  const restoresFocus =
    isManagedByLib ||
    /returnFocus|restoreFocus|useRef.*previousFocus/i.test(content);

  const hasTrap =
    isManagedByLib || /FocusTrap|<FocusScope|trapFocus/i.test(content);

  return {
    name,
    file: filePath,
    line,
    isManagedByLib,
    movesFocusIn,
    restoresFocus,
    hasTrap,
    at: { file: filePath, startLine: line, endLine: line },
  };
}

export interface ClickableDivModel {
  file: string;
  line: number;
  hasRole: boolean;
  hasTabIndex: boolean;
  hasKeyHandler: boolean;
  at: Provenance;
}

export function detectClickableDivs(filePath: string, content: string): ClickableDivModel[] {
  const models: ClickableDivModel[] = [];

  // Look for <div onClick=... or <span onClick=...
  const divClickRegex = /<(div|span)[^>]*\bonClick\s*=[^>]*>/g;
  let match: RegExpExecArray | null;

  while ((match = divClickRegex.exec(content)) !== null) {
    const tagSnippet = match[0]!;
    const hasRole = /role\s*=\s*["'](?:button|link|tab)["']/.test(tagSnippet);
    const hasTabIndex = /tabIndex\s*=/.test(tagSnippet);
    const hasKeyHandler = /onKeyDown|onKeyUp|onKeyPress/.test(tagSnippet);

    if (!hasRole || !hasTabIndex || !hasKeyHandler) {
      const line = content.slice(0, match.index).split("\n").length;
      models.push({
        file: filePath,
        line,
        hasRole,
        hasTabIndex,
        hasKeyHandler,
        at: { file: filePath, startLine: line, endLine: line },
      });
    }
  }

  return models;
}
