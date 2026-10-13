import React from 'react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Radial glow background orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-radial from-purple-600/30 via-indigo-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Hero section */}
      <section className="relative pt-32 pb-20 text-center max-w-5xl mx-auto px-6">
        {/* Uppercase eyebrow badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-xs font-semibold uppercase tracking-wider text-purple-400 mb-6">
          <span>INTRODUCING THE NEXT GENERATION PLATFORM</span>
        </div>

        {/* Gradient headline */}
        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight mb-8 bg-gradient-to-r from-purple-400 via-indigo-300 to-blue-400 bg-clip-text text-transparent">
          Build the future of intelligent workflows
        </h1>

        <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-10">
          Supercharge your developer productivity with our AI-powered orchestration engine.
        </p>

        {/* Generic CTAs */}
        <div className="flex items-center justify-center gap-4">
          <a
            href="#"
            className="px-8 py-4 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold shadow-lg shadow-purple-500/25 transition-all"
          >
            Get Started
          </a>
          <button
            onClick={() => {}}
            className="px-8 py-4 rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur font-semibold"
          >
            Start Free Trial
          </button>
        </div>

        {/* Hardcoded live stats */}
        <div className="mt-16 grid grid-cols-3 gap-8 border-t border-neutral-800 pt-10">
          <div>
            <div className="text-4xl font-bold text-white">10,000+ active users</div>
            <div className="text-neutral-500 text-sm">Empowering teams worldwide</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white">99.9% uptime SLA</div>
            <div className="text-neutral-500 text-sm">Enterprise reliability</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white">50+ integrations</div>
            <div className="text-neutral-500 text-sm">Plug and play</div>
          </div>
        </div>
      </section>

      {/* Fake customer logos marquee */}
      <section className="py-12 border-y border-neutral-800 bg-neutral-950/50">
        <div className="text-center text-xs uppercase tracking-widest text-neutral-500 mb-6">
          TRUSTED BY INNOVATIVE ENGINEERING TEAMS
        </div>
        <div className="flex justify-center items-center gap-12 text-neutral-600 font-bold text-lg animate-marquee">
          <span>Acme Corp</span>
          <span>TechCorp</span>
          <span>StartupXYZ</span>
          <span>Global Dynamics</span>
          <span>Initech</span>
        </div>
      </section>

      {/* Three feature cards with Lucide icons inside colored circles */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold">Engineered for Velocity</h2>
          <p className="text-neutral-400 mt-2">Everything you need to ship faster.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur hover:border-purple-500/50 transition-all">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-6">
              <span className="font-bold">⚡</span>
            </div>
            <h3 className="text-xl font-semibold mb-3">Lightning Fast</h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Sub-millisecond query execution with our globally distributed edge cache.
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur hover:border-purple-500/50 transition-all">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6">
              <span className="font-bold">🛡️</span>
            </div>
            <h3 className="text-xl font-semibold mb-3">Enterprise Security</h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Zero-trust architecture with automated audit logging and SOC2 compliance.
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur hover:border-purple-500/50 transition-all">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-6">
              <span className="font-bold">🌐</span>
            </div>
            <h3 className="text-xl font-semibold mb-3">Global Edge</h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Deploy in over 300 points of presence with single-click automation.
            </p>
          </div>
        </div>
      </section>

      {/* Bento grid section */}
      <section className="py-24 max-w-6xl mx-auto px-6 border-t border-neutral-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-2 row-span-2 p-8 rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur">
            <h3 className="text-2xl font-bold mb-2">Automated Telemetry</h3>
            <p className="text-neutral-400 text-sm">Deep observability out of the box.</p>
          </div>
          <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/40">
            <h4 className="font-semibold">Instant Rollback</h4>
          </div>
          <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/40">
            <h4 className="font-semibold">AI Insights</h4>
          </div>
        </div>
      </section>

      {/* Fake testimonial section */}
      <section className="py-20 max-w-4xl mx-auto px-6 text-center">
        <blockquote className="text-2xl font-medium italic text-neutral-300 mb-6">
          "This platform transformed our deployment velocity completely. A must-have for modern teams."
        </blockquote>
        <div className="font-semibold text-white">Jane Doe</div>
        <div className="text-sm text-neutral-500">CEO at Acme Corp</div>
      </section>
    </div>
  );
}
