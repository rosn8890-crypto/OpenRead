"use client";

import { useEffect, useState } from "react";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import BookCard from "@/components/BookCard";
import { createClient } from "@/lib/supabase/client";

type Book = { id: string; title: string; author: string; cover_url: string | null; category: string };

function Row({ title, books }: { title: string; books: Book[] }) {
  if (!books.length) return null;
  return (
    <section className="px-6 py-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {books.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>
    </section>
  );
}

const SECTION_KEYS = [
  "continueReading",
  "trending", "popular", "recent",
  "selfImprovement", "motivation",
  "cyber", "hacking", "programming",
] as const;

export default function HomePage() {
  const supabase = createClient();
  const [sections, setSections] = useState<Record<string, Book[]>>(
    Object.fromEntries(SECTION_KEYS.map((k) => [k, []])) as Record<string, Book[]>
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      async function getSection(orderBy: string, category?: string) {
        let query = supabase
          .from("books")
          .select("id, title, author, cover_url, category")
          .eq("status", "approved")
          .order(orderBy, { ascending: false })
          .limit(10);
        if (category) query = query.eq("category", category);
        const { data } = await query;
        return data ?? [];
      }

      async function getContinueReading(): Promise<Book[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data } = await supabase
          .from("reading_progress")
          .select("book_id, last_read_at, books(id, title, author, cover_url, category)")
          .eq("user_id", user.id)
          .order("last_read_at", { ascending: false })
          .limit(10);
        return (data ?? [])
          .map((p: any) => p.books)
          .filter(Boolean);
      }

      const [continueReading, trending, popular, recent, selfImprovement, motivation, cyber, hacking, programming] =
        await Promise.all([
          getContinueReading(),
          getSection("view_count"),
          getSection("download_count"),
          getSection("created_at"),
          getSection("created_at", "Self Improvement"),
          getSection("created_at", "Motivation"),
          getSection("created_at", "Cybersecurity"),
          getSection("created_at", "Ethical Hacking"),
          getSection("created_at", "Programming"),
        ]);

      setSections({ continueReading, trending, popular, recent, selfImprovement, motivation, cyber, hacking, programming });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <>
      <Hero />
      <Features />
      {loading ? (
        <p className="text-center py-10 text-white/40">Loading books...</p>
      ) : (
        <>
          <Row title="Continue Reading" books={sections.continueReading} />
          <Row title="Trending Books" books={sections.trending} />
          <Row title="Popular Books" books={sections.popular} />
          <Row title="Recently Added" books={sections.recent} />
          <Row title="Self Improvement Collection" books={sections.selfImprovement} />
          <Row title="Motivation Collection" books={sections.motivation} />
          <Row title="Cybersecurity Collection" books={sections.cyber} />
          <Row title="Ethical Hacking Collection" books={sections.hacking} />
          <Row title="Programming Collection" books={sections.programming} />
        </>
      )}
      <footer className="px-6 py-10 text-center text-white/40 text-sm border-t border-white/10 mt-10">
        © {new Date().getFullYear()} OpenRead. Built for learners.
      </footer>
    </>
  );
}
