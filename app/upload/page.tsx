"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  "Cybersecurity", "Ethical Hacking", "Programming", "Operating Systems",
  "Networking", "Linux", "Web Development", "Artificial Intelligence",
  "Machine Learning", "Communication Skills", "Self Improvement",
  "Motivation", "Entrepreneurship", "Science", "Mathematics",
  "Engineering", "History", "Fiction", "Novels", "Exam Preparation",
];

export default function UploadPage() {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({
    title: "", author: "", description: "", category: CATEGORIES[0],
    language: "English", tags: "", isbn: "", year: "",
  });
  const [customCategory, setCustomCategory] = useState("");
  const [usingCustomCategory, setUsingCustomCategory] = useState(false);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Client-side guard for UX only — real security is enforced by
    // Supabase Row Level Security, since there's no server here to check.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
    });

    // Pull in any custom categories other users have already created, so
    // the dropdown grows over time instead of only ever showing the
    // original preset list.
    supabase
      .from("books")
      .select("category")
      .then(({ data }) => {
        const extra = Array.from(new Set((data ?? []).map((b: any) => b.category)))
          .filter((c) => !CATEGORIES.includes(c))
          .sort();
        setExistingCategories(extra);
      });
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Please select a PDF or EPUB file.");
    const finalCategory = usingCustomCategory ? customCategory.trim() : form.category;
    if (usingCustomCategory && !finalCategory) return setError("Please enter a name for your new category.");
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in.");

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: fileErr } = await supabase.storage
        .from("books")
        .upload(filePath, file);
      if (fileErr) throw fileErr;

      let coverUrl: string | null = null;
      if (cover) {
        const coverPath = `${user.id}/covers/${Date.now()}-${cover.name}`;
        const { error: coverErr } = await supabase.storage.from("covers").upload(coverPath, cover);
        if (coverErr) throw coverErr;
        coverUrl = supabase.storage.from("covers").getPublicUrl(coverPath).data.publicUrl;
      }

      const { error: dbErr } = await supabase.from("books").insert({
        title: form.title,
        author: form.author,
        description: form.description,
        category: finalCategory,
        language: form.language,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        isbn: form.isbn || null,
        publication_year: form.year ? parseInt(form.year) : null,
        file_path: filePath,
        file_type: fileExt,
        cover_url: coverUrl,
        uploaded_by: user.id,
        status: "pending",
      });
      if (dbErr) throw dbErr;

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-2">Upload a book</h1>
      <p className="text-white/50 text-sm mb-8">
        Your book will appear in the library after admin approval.
      </p>

      <form onSubmit={handleUpload} className="space-y-4">
        <input
          placeholder="Title"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full bg-card border border-white/10 rounded-xl2 px-4 py-3"
        />
        <input
          placeholder="Author"
          required
          value={form.author}
          onChange={(e) => setForm({ ...form, author: e.target.value })}
          className="w-full bg-card border border-white/10 rounded-xl2 px-4 py-3"
        />
        <textarea
          placeholder="Description"
          required
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full bg-card border border-white/10 rounded-xl2 px-4 py-3"
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            {!usingCustomCategory ? (
              <select
                value={form.category}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setUsingCustomCategory(true);
                  } else {
                    setForm({ ...form, category: e.target.value });
                  }
                }}
                className="w-full bg-card border border-white/10 rounded-xl2 px-4 py-3"
              >
                <optgroup label="Categories">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </optgroup>
                {existingCategories.length > 0 && (
                  <optgroup label="Community-added categories">
                    {existingCategories.map((c) => <option key={c}>{c}</option>)}
                  </optgroup>
                )}
                <option value="__custom__">+ Create new category...</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  placeholder="New category name"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="flex-1 bg-card border border-primary/40 rounded-xl2 px-4 py-3"
                />
                <button
                  type="button"
                  onClick={() => { setUsingCustomCategory(false); setCustomCategory(""); }}
                  className="px-3 rounded-xl2 border border-white/20 text-sm text-white/60"
                  title="Cancel and pick from the list instead"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          <input
            placeholder="Language"
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            className="bg-card border border-white/10 rounded-xl2 px-4 py-3"
          />
        </div>
        {usingCustomCategory && (
          <p className="text-xs text-white/40 -mt-2">
            This creates a brand new category — it'll show up on the Categories page for everyone once this book is approved.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <input
            placeholder="Tags (comma separated)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="bg-card border border-white/10 rounded-xl2 px-4 py-3"
          />
          <input
            placeholder="Publication Year"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: e.target.value })}
            className="bg-card border border-white/10 rounded-xl2 px-4 py-3"
          />
        </div>
        <input
          placeholder="ISBN (optional)"
          value={form.isbn}
          onChange={(e) => setForm({ ...form, isbn: e.target.value })}
          className="w-full bg-card border border-white/10 rounded-xl2 px-4 py-3"
        />

        <div>
          <label className="block text-sm text-white/60 mb-1">Book file (PDF or EPUB)</label>
          <input
            type="file"
            accept=".pdf,.epub"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">Cover image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-primary text-black font-semibold py-3 rounded-xl2 glow-primary"
        >
          {loading ? "Uploading..." : "Submit for review"}
        </button>
      </form>
    </div>
  );
}
