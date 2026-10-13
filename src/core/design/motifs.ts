// ─── L6: Template Composition Motifs ──────────────────────────────────────────
// Detects template motifs across 6 distinct families.
// Emits findings only when a weighted combination spanning >= 4 families co-occurs.
// ─────────────────────────────────────────────────────────────────────────────

export interface Motif {
  id: string;
  family: "hero" | "layout" | "decoration" | "copy" | "proof" | "cta";
  weight: number;
  evidence: string;
  line: number;
}

export interface CompositionEvidence {
  motifs: Motif[];
  families: string[];
  score: number;
  strong: boolean;
}

export function detectTemplateMotifs(filePath: string, content: string): CompositionEvidence {
  const motifs: Motif[] = [];

  // 1. centeredHeroWithEyebrow (family: "hero")
  if (
    /text-center.*max-w-[45]xl/i.test(content) &&
    /uppercase.*tracking-wider|eyebrow/i.test(content) &&
    /<h1/i.test(content)
  ) {
    motifs.push({
      id: "centered-hero-with-eyebrow",
      family: "hero",
      weight: 1.5,
      evidence: "Centered hero with uppercase eyebrow, large H1, and dual CTA cluster",
      line: 1,
    });
  }

  // 2. gradientBackgroundWithGlow (family: "decoration")
  if (
    /bg-gradient-radial|blur-[23]xl.*rounded-full|bg-gradient-to-r.*bg-clip-text/i.test(content) &&
    /purple|indigo|cyan|violet/i.test(content)
  ) {
    motifs.push({
      id: "gradient-background-glow",
      family: "decoration",
      weight: 1.0,
      evidence: "Gradient background with blurred radial glow behind hero",
      line: 1,
    });
  }

  // 3. threeCardFeatureRow (family: "layout")
  if (/grid-cols-3|grid.*gap-8.*grid-cols-1.*md:grid-cols-3/i.test(content)) {
    motifs.push({
      id: "three-card-feature-row",
      family: "layout",
      weight: 1.0,
      evidence: "Three-card uniform feature row in 3-column grid",
      line: 1,
    });
  }

  // 4. iconInTintedCircle (family: "decoration")
  if (/rounded-full.*bg-[a-z]+-[0-9]{3}\/10|rounded-full.*p-[23].*bg-/i.test(content)) {
    motifs.push({
      id: "icon-in-tinted-circle",
      family: "decoration",
      weight: 1.0,
      evidence: "Icons positioned inside rounded-full tinted circle backgrounds",
      line: 1,
    });
  }

  // 5. bentoGrid (family: "layout")
  if (/bento|col-span-2.*row-span-2|md:col-span-2/i.test(content)) {
    motifs.push({
      id: "bento-grid",
      family: "layout",
      weight: 1.0,
      evidence: "Asymmetric bento grid layout with mixed column and row spans",
      line: 1,
    });
  }

  // 6. glassCards (family: "decoration")
  if (/backdrop-blur.*border-neutral|bg-neutral-900\/50.*backdrop-blur/i.test(content)) {
    motifs.push({
      id: "glass-cards",
      family: "decoration",
      weight: 1.0,
      evidence: "Glassmorphism cards with backdrop blur and semi-transparent borders",
      line: 1,
    });
  }

  // 7. logoWall (family: "proof")
  if (
    /TRUSTED BY|CUSTOMER LOGOS|marquee|grayscale.*opacity/i.test(content) ||
    /Acme Corp|TechCorp|StartupXYZ/i.test(content)
  ) {
    motifs.push({
      id: "logo-wall",
      family: "proof",
      weight: 1.0,
      evidence: "Customer logo strip / marquee with generic corporate placeholders",
      line: 1,
    });
  }

  // 8. genericCtaBand (family: "cta")
  if (/Get Started|Start Free Trial|Build the future|Get Started Today/i.test(content)) {
    motifs.push({
      id: "generic-cta-band",
      family: "cta",
      weight: 1.0,
      evidence: "Generic conversion CTA with standard high-friction template copy",
      line: 1,
    });
  }

  // 9. genericHeadlineCopy (family: "copy")
  if (
    /Build the future of|Supercharge your|The next generation platform|All-in-one platform/i.test(
      content
    )
  ) {
    motifs.push({
      id: "generic-headline-copy",
      family: "copy",
      weight: 1.0,
      evidence: "Templated claim vocabulary in hero headline ('Build the future...')",
      line: 1,
    });
  }

  // 10. fakeSocialProof (family: "proof")
  if (/testimonial|CEO at|Founder & CEO|VP of Engineering/i.test(content)) {
    motifs.push({
      id: "fake-social-proof",
      family: "proof",
      weight: 1.0,
      evidence: "Testimonial cards with stock executive titles and generic quotes",
      line: 1,
    });
  }

  const families = Array.from(new Set(motifs.map((m) => m.family)));
  const score = motifs.reduce((acc, m) => acc + m.weight, 0);
  const strong = motifs.length >= 5 && families.length >= 4;

  return { motifs, families, score, strong };
}
