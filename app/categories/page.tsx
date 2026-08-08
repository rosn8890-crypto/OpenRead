"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import BookCard from "@/components/BookCard";
import { createClient } from "@/lib/supabase/client";

const PRESET_CATEGORIES = [
  "Cybersecurity", "Ethical Hacking", "Programming", "Operating Systems",
  "Networking", "Linux", "Web Development", "Artificial Intelligence",
  "Machine Learning", "Communication Skills", "Self Improvement",
  "Motivation", "Entrepreneurship", "Science", "Mathematics",
  "Engineering", "History", "Fiction", "Novels", "Exam Preparation",
];

function CategoryContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const category = searchParams.get("slug") || "All";
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allCategories, setAllCategories] = useState<string[]>(["All", ...PRESET_CATEGORIES]);

  useEffect(() => {
    // Pull in any user-created custom categories (from the Upload page's
    // "+ Create new category" option) so they show up as real filter pills
    // here too, not just the original preset list.
    supabase
      .from("books")
      .select("category")
      .eq("status", "approved")
      .then(({ data }) => {
        const found = Array.from(new Set((data ?? []).map((b: any) => b.category)));
        const extra = found.filter((c) => !PRESET_CATEGORIES.includes(c)).sort();
        setAllCategories(["All", ...PRESET_CATEGORIES, ...extra]);
      });
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("books")
        .select("id, title, author, cover_url, category")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (category !== "All") query = query.eq("category", category);
      const { data } = await query;
      setBooks(data ?? []);
      setLoading(false);
    }
    load();
  }, [category]);

  return (
    <div className="px-6 py-10">
      <div className="flex flex-wrap gap-2 mb-8">
        {allCategories.map((c) => (
          <Link
            key={c}
            href={`/categories/?slug=${encodeURIComponent(c)}`}
            className={`text-xs px-3 py-1.5 rounded-lg border ${
              c === category ? "border-primary text-primary" : "border-white/10 text-white/60"
            }`}
          >
            {c}
          </Link>
        ))}
      </div>

      <h1 className="text-3xl font-bold mb-8">{category}</h1>
      {loading ? (
        <p className="text-white/40">Loading...</p>
      ) : books.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      ) : (
        <p className="text-white/50">No books in this category yet.</p>
      )}
    </div>
  );
}

export default function CategoryPage() {
  return (
    <Suspense fallback={<p className="text-center py-20 text-white/40">Loading...</p>}>
      <CategoryContent />
    </Suspense>
  );
}
