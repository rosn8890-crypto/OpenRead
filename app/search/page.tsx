"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import BookCard from "@/components/BookCard";
import { createClient } from "@/lib/supabase/client";

function SearchContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (initialQ) runSearch(initialQ);
  }, [initialQ]);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    const { data } = await supabase
      .from("books")
      .select("id, title, author, cover_url, category")
      .eq("status", "approved")
      .or(`title.ilike.%${q}%,author.ilike.%${q}%,category.ilike.%${q}%`)
      .limit(30);
    setBooks(data ?? []);
    setLoading(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/search/?q=${encodeURIComponent(query)}`);
    runSearch(query);
  }

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Search OpenRead</h1>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, author, or category..."
          className="flex-1 min-w-0 bg-card border border-white/10 rounded-xl2 px-4 py-3 outline-none focus:border-primary"
        />
        <button className="bg-primary text-black font-semibold px-6 py-3 rounded-xl2 glow-primary">
          Search
        </button>
      </form>

      {loading ? (
        <p className="text-white/40">Searching...</p>
      ) : searched && books.length === 0 ? (
        <p className="text-white/50">No books matched &ldquo;{query}&rdquo;.</p>
      ) : books.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      ) : (
        <p className="text-white/40">Type something above to search the library.</p>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-center py-20 text-white/40">Loading...</p>}>
      <SearchContent />
    </Suspense>
  );
}
