import path from 'node:path';
import type { ComponentModel, ContentModel } from '../types.js';
import type { FilePayload } from './types.js';

export function buildTerminologyMap(components: ComponentModel[]): Map<string, string[]> {
  const conceptMap = new Map<string, string[]>();

  // Canonical concept -> variant patterns
  const concepts: Array<{ concept: string; variants: RegExp[] }> = [
    { concept: 'create', variants: [/\bcreate\b/i, /\badd\b/i, /\bnew\b/i, /\binsert\b/i] },
    { concept: 'edit', variants: [/\bedit\b/i, /\bupdate\b/i, /\bmodify\b/i, /\bchange\b/i] },
    { concept: 'delete', variants: [/\bdelete\b/i, /\bremove\b/i, /\barchive\b/i, /\bdiscard\b/i] },
    { concept: 'save', variants: [/\bsave\b/i, /\bsubmit\b/i, /\bconfirm\b/i, /\bapply\b/i] },
    { concept: 'cancel', variants: [/\bcancel\b/i, /\bdismiss\b/i, /\bclose\b/i, /\bback\b/i] },
  ];

  for (const comp of components) {
    for (const ctaText of comp.ctaTexts) {
      for (const { concept, variants } of concepts) {
        for (const v of variants) {
          if (v.test(ctaText)) {
            const existing = conceptMap.get(concept) ?? [];
            if (!existing.includes(ctaText)) existing.push(ctaText);
            conceptMap.set(concept, existing);
          }
        }
      }
    }
  }

  return conceptMap;
}

export function extractContent(payloads: FilePayload[], components: ComponentModel[]): ContentModel {
  const genericPhrases: ContentModel['genericPhrases'] = [];
  const hardcodedMetrics: ContentModel['hardcodedMetrics'] = [];
  const ctaTexts = new Map<string, string[]>();
  let loremIpsumCount = 0;
  let fakeTestimonialCount = 0;

  const GENERIC_PATTERNS: RegExp[] = [
    /the future of\b/i,
    /built for the modern\b/i,
    /supercharge your\b/i,
    /transform your workflow\b/i,
    /unlock your potential\b/i,
    /all-in-one platform\b/i,
    /seamlessly integrate\b/i,
    /say goodbye to\b/i,
    /bring your ideas to life\b/i,
    /next-gen\b/i,
    /streamline your\b/i,
  ];

  const FAKE_TESTIMONIAL_RE = /\b(?:CEO at TechCorp|Founder at StartupX|John D\.|Sarah M\.|Alex P\.|Jane Doe|John Doe)\b/i;
  const HARDCODED_METRIC_RE =
    /\d{1,3}(?:,\d{3})*\+?\s*(?:active\s+)?(?:users|customers|businesses|projects|teams|requests|transactions|uptime)/i;
  const PERCENT_METRIC_RE =
    /\d+(?:\.\d+)?%\s*(?:faster|more|better|increase|reduction|uptime|sla)/i;

  for (const f of payloads) {
    const ext = path.extname(f.relPath).toLowerCase();
    if (!['.tsx', '.jsx', '.ts', '.js'].includes(ext)) continue;

    const lines = f.content.split('\n');
    const pageCtas: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNum = i + 1;
      const trimmed = line.trim();

      // Generic phrases
      for (const pattern of GENERIC_PATTERNS) {
        const m = line.match(pattern);
        if (m?.[0]) {
          genericPhrases.push({ phrase: m[0], file: f.relPath, line: lineNum });
        }
      }

      // Fake testimonials
      if (FAKE_TESTIMONIAL_RE.test(line)) fakeTestimonialCount++;

      // Lorem ipsum
      if (/lorem ipsum/i.test(line)) loremIpsumCount++;

      // Hardcoded metrics — only in JSX context (not in comments or type definitions)
      const isComment = trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
      const isJsxFile = ['.tsx', '.jsx'].includes(ext);
      if (isJsxFile && !isComment) {
        if (HARDCODED_METRIC_RE.test(line) && /<[a-zA-Z]/.test(line)) {
          const m = line.match(HARDCODED_METRIC_RE);
          if (m?.[0]) hardcodedMetrics.push({ text: m[0], file: f.relPath, line: lineNum });
        }
        if (PERCENT_METRIC_RE.test(line) && /<[a-zA-Z]/.test(line)) {
          const m = line.match(PERCENT_METRIC_RE);
          if (m?.[0]) hardcodedMetrics.push({ text: m[0], file: f.relPath, line: lineNum });
        }
      }

      // CTA texts from buttons/links
      const btnTextRe = /<button[^>]*>([^<]{2,60})<\/button>/gi;
      let bm: RegExpExecArray | null;
      while ((bm = btnTextRe.exec(line)) !== null) {
        const text = bm[1]?.trim();
        if (text) pageCtas.push(text);
      }
    }

    if (pageCtas.length > 0) {
      ctaTexts.set(f.relPath, pageCtas);
    }
  }

  // Terminology from components
  const terminology = buildTerminologyMap(components);

  return {
    terminology,
    genericPhrases: genericPhrases.slice(0, 100),
    hardcodedMetrics: hardcodedMetrics.slice(0, 50),
    ctaTexts,
    loremIpsumCount,
    fakeTestimonialCount,
  };
}
