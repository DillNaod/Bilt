import React from 'react';

export default function EditorialPage() {
  const articles = [
    {
      title: "The Architecture of Distributed Consensus in 2026",
      date: "October 12, 2026",
      author: "Elena Rostova",
      readTime: "8 min read",
      summary: "Examining practical trade-offs between Byzantine fault tolerance and latency in planetary-scale systems."
    },
    {
      title: "Reframing Memory Safety Across Kernel Boundaries",
      date: "October 8, 2026",
      author: "Marcus Chen",
      readTime: "12 min read",
      summary: "How modern language runtimes and hardware capabilities are reshaping zero-copy driver development."
    }
  ];

  return (
    <main className="max-w-4xl mx-auto px-8 py-16 font-serif bg-[#fbfbf9] text-[#1c1d1f]">
      <header className="border-b border-[#e2e1dc] pb-8 mb-12">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-[#71706c] font-sans">Quarterly Review</span>
          <nav className="flex gap-6 text-sm font-sans text-[#71706c]">
            <a href="/archive" className="hover:text-black">Archive</a>
            <a href="/about" className="hover:text-black">About</a>
            <a href="/subscribe" className="hover:text-black">Subscribe</a>
          </nav>
        </div>
        <h1 className="text-5xl font-normal mt-8 tracking-tight font-serif">
          Signals & Systems
        </h1>
      </header>

      <section className="space-y-16">
        {articles.map((art) => (
          <article key={art.title} className="border-b border-[#f0eee6] pb-12">
            <div className="text-xs font-sans text-[#8e8d88] uppercase mb-2">
              {art.date} · By {art.author} · {art.readTime}
            </div>
            <h2 className="text-2xl font-serif font-medium mb-3 hover:underline cursor-pointer">
              {art.title}
            </h2>
            <p className="text-[#4a4946] leading-relaxed text-base">
              {art.summary}
            </p>
          </article>
        ))}
      </section>

      {/* Subtle intentional accent badge with gradient that should NOT trigger findings */}
      <footer className="mt-20 pt-8 border-t border-[#e2e1dc] flex justify-between items-center text-xs font-sans text-[#8e8d88]">
        <div>Published in Berlin and Tokyo.</div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
          <span>Issue 42</span>
        </div>
      </footer>
    </main>
  );
}
