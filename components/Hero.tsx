"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search/?q=${encodeURIComponent(query)}`);
  }

  return (
    <section className="px-6 py-20 text-center bg-gradient-to-b from-primary/10 to-transparent">
      <h1 className="text-4xl md:text-6xl font-bold mb-4">
        Read <span className="text-primary">Anything</span>,{" "}
        <span className="text-secondary">Anywhere</span>.
      </h1>
      <p className="text-white/60 max-w-xl mx-auto mb-8">
        Cybersecurity, programming, self-improvement and more — free books,
        picked up exactly where you left off.
      </p>
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, author, category..."
          className="flex-1 min-w-0 bg-card border border-white/10 rounded-xl2 px-4 py-3 outline-none focus:border-primary"
        />
        <button className="bg-primary text-black font-semibold px-6 py-3 rounded-xl2 glow-primary">
          Search
        </button>
      </form>
    </section>
  );
}
