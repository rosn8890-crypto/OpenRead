"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReviewsPanel({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const supabase = createClient();
  const [reviews, setReviews] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, user_id, profiles(username)")
        .eq("book_id", bookId)
        .order("created_at", { ascending: false });
      setReviews(data ?? []);

      if (user) {
        const mine = data?.find((r: any) => r.user_id === user.id);
        if (mine) {
          setRating(mine.rating);
          setComment(mine.comment ?? "");
        }
      }
      setLoading(false);
    }
    load();
  }, [bookId]);

  async function submitReview() {
    if (!userId) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("reviews")
      .upsert(
        { user_id: userId, book_id: bookId, rating, comment },
        { onConflict: "user_id,book_id" }
      )
      .select("id, rating, comment, created_at, user_id, profiles(username)")
      .single();
    setSaving(false);
    if (!error && data) {
      setReviews((prev) => [data, ...prev.filter((r) => r.user_id !== userId)]);
    }
  }

  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[110] flex items-center justify-center p-4">
      <div className="bg-card border border-white/10 rounded-xl2 w-full max-w-lg max-h-[80dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold">
            Reviews {avgRating && <span className="text-primary">· ⭐ {avgRating}</span>}
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-white/40 text-sm">Loading reviews...</p>
          ) : (
            <>
              {userId ? (
                <div className="mb-6 glass rounded-xl2 p-4">
                  <p className="text-sm text-white/60 mb-2">Your rating</p>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setRating(n)}
                        className={`text-2xl ${n <= rating ? "text-primary" : "text-white/20"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your thoughts on this book..."
                    rows={3}
                    className="w-full bg-black/30 border border-white/10 rounded-xl2 px-3 py-2 text-sm mb-3"
                  />
                  <button
                    onClick={submitReview}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl2 bg-primary text-black font-semibold text-sm"
                  >
                    {saving ? "Saving..." : "Submit review"}
                  </button>
                </div>
              ) : (
                <p className="text-white/50 text-sm mb-6">Log in to leave a review.</p>
              )}

              {reviews.length === 0 ? (
                <p className="text-white/40 text-sm">No reviews yet — be the first!</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="glass rounded-xl2 p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{r.profiles?.username ?? "Anonymous"}</span>
                        <span className="text-primary text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                      </div>
                      {r.comment && <p className="text-white/70 text-sm">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
