import path from 'node:path';
import { normalizeComponentTree } from '../normalizer.js';
import type {
  ComponentModel,
  HeadingModel,
  InteractiveElementModel,
  FormFieldModel,
  DecorativeSignal,
} from '../types.js';
import type { FilePayload } from './types.js';

export function extractHeadings(lines: string[]): HeadingModel[] {
  const headings: HeadingModel[] = [];
  // Match: <h1 className="...">text</h1>  or  <h2>text</h2>
  const hRe = /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    let m: RegExpExecArray | null;
    hRe.lastIndex = 0;
    while ((m = hRe.exec(line)) !== null) {
      const level = parseInt(m[1] ?? '1', 10) as 1 | 2 | 3 | 4 | 5 | 6;
      const attrs = m[2] ?? '';
      const inner = (m[3] ?? '').replace(/<[^>]+>/g, '').trim(); // strip child tags
      if (!inner) continue;

      // Extract tailwind classes from attrs
      const classMatch = attrs.match(/class(?:Name)?=["']([^"']+)["']/);
      const tailwindClasses = classMatch
        ? classMatch[1]!.split(/\s+/).filter((c) => c.length > 0)
        : [];

      headings.push({ level, text: inner.slice(0, 200), tailwindClasses });
    }
  }

  return headings.slice(0, 50);
}

export function extractInteractiveElements(lines: string[], fullContent: string): InteractiveElementModel[] {
  const elements: InteractiveElementModel[] = [];

  function getLine(idx: number): number {
    return fullContent.slice(0, idx).split('\n').length;
  }

  // Buttons
  const btnRe = /<button([^>]*)>([\s\S]*?)<\/button>/gi;
  let m: RegExpExecArray | null;
  while ((m = btnRe.exec(fullContent)) !== null) {
    const lineNum = getLine(m.index);
    const attrs = m[1] ?? '';
    const text = (m[2] ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 100);
    const hasAriaLabel = /aria-label/i.test(attrs);
    const hasOnClick = /onClick/i.test(attrs);
    const onClickIsEmpty = /onClick=\{[()=>\s]*\{\s*\}\}/i.test(attrs);
    const isDestructive = /delete|remove|destroy|purge|unlink|revoke/i.test(text);
    const surroundStart = Math.max(0, lineNum - 6);
    const surroundEnd = Math.min(lines.length, lineNum + 6);
    const surroundText = lines.slice(surroundStart, surroundEnd).join('\n');
    const hasConfirmation = /confirm|dialog|alert|prompt|modal/i.test(surroundText);

    elements.push({
      type: 'button',
      text: text || undefined,
      hasAriaLabel,
      isDestructive,
      hasConfirmation,
      hasOnClick,
      onClickIsEmpty,
      line: lineNum,
    });
  }

  // Links
  const linkRe = /<(?:Link|a)([^>]*)>([\s\S]*?)<\/(?:Link|a)>/gi;
  while ((m = linkRe.exec(fullContent)) !== null) {
    const lineNum = getLine(m.index);
    const attrs = m[1] ?? '';
    const text = (m[2] ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 100);
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/);
    const href = hrefMatch?.[1];
    const hasAriaLabel = /aria-label/i.test(attrs);
    const isDestructive = /delete|remove|destroy/i.test(text);
    const hasOnClick = /onClick/i.test(attrs);
    const onClickIsEmpty = href === '#' || /onClick=\{[()=>\s]*\{\s*\}\}/i.test(attrs);

    elements.push({
      type: 'link',
      text: text || undefined,
      href,
      hasAriaLabel,
      isDestructive,
      hasConfirmation: false,
      hasOnClick,
      onClickIsEmpty,
      line: lineNum,
    });
  }

  // Inputs
  const inputRe = /<input([^>]*)\/?>/gi;
  while ((m = inputRe.exec(fullContent)) !== null) {
    const lineNum = getLine(m.index);
    const attrs = m[1] ?? '';
    const hasAriaLabel = /aria-label/i.test(attrs);

    elements.push({
      type: 'input',
      hasAriaLabel,
      isDestructive: false,
      hasConfirmation: false,
      hasOnClick: false,
      onClickIsEmpty: false,
      line: lineNum,
    });
  }

  // Clickable divs
  const divClickRe = /<(?:div|span)([^>]*onClick=[^>]*)>/gi;
  while ((m = divClickRe.exec(fullContent)) !== null) {
    const lineNum = getLine(m.index);
    const attrs = m[1] ?? '';
    const hasAriaLabel = /aria-label/i.test(attrs);

    elements.push({
      type: 'div-clickable',
      hasAriaLabel,
      isDestructive: false,
      hasConfirmation: false,
      hasOnClick: true,
      onClickIsEmpty: false,
      line: lineNum,
    });
  }

  return elements.slice(0, 100);
}

export function extractFormFields(lines: string[]): FormFieldModel[] {
  const fields: FormFieldModel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNum = i + 1;

    const inputRe = /<(?:input|select|textarea)([^>]*)\/?>/gi;
    let m: RegExpExecArray | null;
    while ((m = inputRe.exec(line)) !== null) {
      const attrs = m[1] ?? '';
      const tag = (line.match(/<(input|select|textarea)/i)?.[1] ?? 'input').toLowerCase();
      const typeMatch = attrs.match(/type=["']([^"']*)["']/);
      const nameMatch = attrs.match(/name=["']([^"']*)["']/);
      const hasAriaLabel = /aria-label/i.test(attrs);
      const hasRequired = /required/i.test(attrs);

      // Check surrounding lines for associated <label>
      const surroundLines = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 3)).join('\n');
      const hasLabel = /<label\b/i.test(surroundLines);
      // Check for error message nearby
      const hasErrorMessage = /error|invalid|required/i.test(surroundLines);

      fields.push({
        type: typeMatch?.[1] ?? tag,
        name: nameMatch?.[1],
        hasLabel,
        hasAriaLabel,
        hasErrorMessage,
        hasRequired,
        line: lineNum,
      });
    }
  }

  return fields.slice(0, 50);
}

export function extractCtaTexts(content: string): string[] {
  const texts = new Set<string>();
  // Button text
  const btnRe = /<button[^>]*>([\s\S]*?)<\/button>/gi;
  let m: RegExpExecArray | null;
  while ((m = btnRe.exec(content)) !== null) {
    const text = (m[1] ?? '').replace(/<[^>]+>/g, '').trim();
    if (text.length >= 2 && text.length <= 80) texts.add(text);
  }
  // Link text
  const linkRe = /<(?:Link|a)[^>]*>([\s\S]*?)<\/(?:Link|a)>/gi;
  while ((m = linkRe.exec(content)) !== null) {
    const text = (m[1] ?? '').replace(/<[^>]+>/g, '').trim();
    if (text.length >= 2 && text.length <= 80 && /^[A-Za-z]/.test(text)) {
      texts.add(text);
    }
  }
  return Array.from(texts).slice(0, 30);
}

export function detectDecorativeSignals(lines: string[]): DecorativeSignal[] {
  const signals: DecorativeSignal[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNum = i + 1;

    if (/bg-gradient-to|linear-gradient/i.test(line)) {
      signals.push({ type: 'gradient', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/bg-gradient-radial|radial-gradient|radial-orb|blur-(?:2xl|3xl)/i.test(line)) {
      signals.push({ type: 'radial-orb', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/backdrop-blur.*bg-(?:white|black)\/[0-9]/i.test(line)) {
      signals.push({ type: 'glassmorphism', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/col-span-2.*row-span-2|bento/i.test(line)) {
      signals.push({ type: 'bento-grid', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/grid-cols-3/i.test(line)) {
      signals.push({ type: 'three-column', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/uppercase.*tracking.*text-xs|eyebrow/i.test(line)) {
      signals.push({ type: 'hero-eyebrow', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/animate-marquee|<Marquee/i.test(line)) {
      signals.push({ type: 'marquee', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/\d{1,3}(?:,\d{3})+\s+(?:users|customers|businesses|projects)/i.test(line)) {
      signals.push({ type: 'fake-metric', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/testimonial|"said.*CEO|said.*Founder/i.test(line)) {
      signals.push({ type: 'testimonial', evidence: line.trim().slice(0, 80), line: lineNum });
    }
    if (/logo.*strip|logo.*grid|partners|trusted by/i.test(line)) {
      signals.push({ type: 'logo-strip', evidence: line.trim().slice(0, 80), line: lineNum });
    }
  }

  return signals;
}

export function buildComponentModel(
  relPath: string,
  lines: string[],
  content: string,
): ComponentModel | null {
  const name = path.basename(relPath, path.extname(relPath));
  const lowerContent = content.toLowerCase();

  // Determine component role
  const isNavigation = /nav|navbar|header|sidebar/i.test(name) || /<nav\b/i.test(content);
  const isHero = /hero/i.test(name) || /<section[^>]*hero/i.test(content);
  const isCard = /card/i.test(name) || (content.includes('rounded-') && (content.includes('border') || content.includes('shadow')));
  const isForm = /form/i.test(name) || /<form\b/i.test(content);
  const isModal = /modal|dialog|drawer/i.test(name) || /<(?:Dialog|Modal|Drawer)\b/i.test(content);
  const isSection = !isNavigation && !isHero && !isCard && !isForm && !isModal
    && (/<section\b/i.test(content) || /section/i.test(name));
  const isDataDisplay = /table|list|grid|data/i.test(name)
    || /<(?:table|Table|DataGrid|DataTable)\b/i.test(content);

  // State detection
  const hasLoadingState = lowerContent.includes('loading') || lowerContent.includes('skeleton') || lowerContent.includes('spinner') || /animate-pulse/.test(content);
  const hasErrorState = lowerContent.includes('error') || lowerContent.includes('catch') || /<ErrorBoundary\b/i.test(content);
  const hasEmptyState = lowerContent.includes('empty')
    || /no results|no items|no data/i.test(content)
    || /\.length\s*===?\s*0/.test(content)
    || /!\w+\.length\b/.test(content)
    || /no\s+\w+\s+(?:found|connected|available|configured|results|records|items)/i.test(content);
  const hasSuccessState = lowerContent.includes('success') || lowerContent.includes('submitted') || lowerContent.includes('completed');
  const hasDisabledState = content.includes('disabled') || /aria-disabled/i.test(content);

  // Extract headings
  const headings = extractHeadings(lines);

  // Extract interactive elements
  const interactiveElements = extractInteractiveElements(lines, content);

  // Extract form fields
  const formFields = extractFormFields(lines);

  // Extract CTA texts
  const ctaTexts = extractCtaTexts(content);

  // Extract icon names
  const iconNames: string[] = [];
  const iconRe = /<([A-Z][a-zA-Z0-9]*Icon|Sparkles|Wand2|Brain|Zap|Check|ArrowRight|Star|Globe|Shield|Activity|Terminal|Copy|X|Menu|Trash)\b/g;
  let iconMatch: RegExpExecArray | null;
  while ((iconMatch = iconRe.exec(content)) !== null) {
    if (iconMatch[1]) iconNames.push(iconMatch[1]);
  }

  // Decorative signals
  const decorativeSignals = detectDecorativeSignals(lines);

  // Structural signature
  const structuralSignature = normalizeComponentTree(content);

  // Find first meaningful line number (skip imports)
  let line = 1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? '';
    if (!l.startsWith('import') && !l.startsWith('//') && l.trim().length > 0) {
      line = i + 1;
      break;
    }
  }

  return {
    name,
    file: relPath,
    line,
    structuralSignature,
    isSection,
    isCard,
    isNavigation,
    isForm,
    isModal,
    isHero,
    isDataDisplay,
    hasLoadingState,
    hasErrorState,
    hasEmptyState,
    hasSuccessState,
    hasDisabledState,
    interactiveElements,
    formFields,
    ctaTexts,
    headings,
    iconNames: [...new Set(iconNames)],
    rawText: content.slice(0, 10000),
    decorativeSignals,
  };
}

export function extractComponents(payloads: FilePayload[]): ComponentModel[] {
  const components: ComponentModel[] = [];

  for (const f of payloads) {
    const ext = path.extname(f.relPath).toLowerCase();
    if (!['.tsx', '.jsx'].includes(ext)) continue;

    const lines = f.content.split('\n');
    const comp = buildComponentModel(f.relPath, lines, f.content);
    if (comp) components.push(comp);
  }

  return components;
}
