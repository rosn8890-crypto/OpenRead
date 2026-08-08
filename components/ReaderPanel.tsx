"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Tab = "bookmarks" | "notes" | "lists";

export default function ReaderPanel({
  bookId,
  currentPage,
  selectedText,
  onJumpToPage,
  onClose,
}: {
  bookId: string;
  currentPage: number;
  selectedText: string;
  onJumpToPage: (page: number) => void;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("bookmarks");
  const [userId, setUserId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<any[]>([]);
  const [listMembership, setListMembership] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) {
        setLoading(false);
        return;
      }
      const [{ data: bm }, { data: nt }, { data: userLists }, { data: memberships }] = await Promise.all([
        supabase.from("bookmarks").select("*").eq("user_id", user.id).eq("book_id", bookId).order("page"),
        supabase.from("notes").select("*").eq("user_id", user.id).eq("book_id", bookId).order("created_at", { ascending: false }),
        supabase.from("reading_lists").select("id, name").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("reading_list_items").select("list_id").eq("book_id", bookId),
      ]);
      setBookmarks(bm ?? []);
      setNotes(nt ?? []);
      setLists(userLists ?? []);
      setListMembership(new Set((memberships ?? []).map((m: any) => m.list_id)));
      setLoading(false);
    }
    load();
  }, [bookId]);

  async function toggleListMembership(listId: string) {
    if (listMembership.has(listId)) {
      await supabase.from("reading_list_items").delete().eq("list_id", listId).eq("book_id", bookId);
      setListMembership((prev) => {
        const next = new Set(prev);
        next.delete(listId);
        return next;
      });
    } else {
      await supabase.from("reading_list_items").insert({ list_id: listId, book_id: bookId });
      setListMembership((prev) => new Set(prev).add(listId));
    }
  }

  async function addBookmark() {
    if (!userId) return;
    const { data } = await supabase
      .from("bookmarks")
      .insert({ user_id: userId, book_id: bookId, page: currentPage })
      .select()
      .single();
    if (data) setBookmarks((prev) => [...prev, data].sort((a, b) => a.page - b.page));
  }

  async function removeBookmark(id: string) {
    await supabase.from("bookmarks").delete().eq("id", id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }

  async function addNote(type: "note" | "highlight") {
    if (!userId) return;
    const text = type === "highlight" ? selectedText : noteText;
    if (!text.trim()) return;
    const { data } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        book_id: bookId,
        page: currentPage,
        selected_text: type === "highlight" ? text : null,
        note_text: type === "note" ? text : null,
        type,
      })
      .select()
      .single();
    if (data) {
      setNotes((prev) => [data, ...prev]);
      if (type === "note") setNoteText("");
    }
  }

  async function removeNote(id: string) {
    await supabase.from("notes").delete().eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="fixed right-0 top-0 h-[100dvh] w-full sm:w-96 bg-card border-l border-white/10 z-[110] flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="font-semibold text-sm text-white/70">Bookmarks & Notes</h2>
        <button onClick={onClose} className="text-white/50 hover:text-white text-lg leading-none">✕</button>
      </div>
      <div className="flex gap-2 text-sm px-4 py-3 overflow-x-auto border-b border-white/10">
        <button
          onClick={() => setTab("bookmarks")}
          className={`shrink-0 px-3 py-1.5 rounded-lg ${tab === "bookmarks" ? "bg-primary text-black" : "text-white/60 border border-white/15"}`}
        >
          Bookmarks
        </button>
        <button
          onClick={() => setTab("notes")}
          className={`shrink-0 px-3 py-1.5 rounded-lg ${tab === "notes" ? "bg-primary text-black" : "text-white/60 border border-white/15"}`}
        >
          Notes
        </button>
        <button
          onClick={() => setTab("lists")}
          className={`shrink-0 px-3 py-1.5 rounded-lg ${tab === "lists" ? "bg-primary text-black" : "text-white/60 border border-white/15"}`}
        >
          Lists
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!userId ? (
          <p className="text-white/50 text-sm">Log in to save bookmarks, notes, and highlights.</p>
        ) : loading ? (
          <p className="text-white/40 text-sm">Loading...</p>
        ) : tab === "bookmarks" ? (
          <>
            <button
              onClick={addBookmark}
              className="w-full mb-4 px-4 py-2 rounded-xl2 bg-primary text-black font-semibold text-sm"
            >
              🔖 Bookmark page {currentPage}
            </button>
            {bookmarks.length === 0 ? (
              <p className="text-white/40 text-sm">No bookmarks yet.</p>
            ) : (
              <div className="space-y-2">
                {bookmarks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between glass rounded-lg px-3 py-2 text-sm">
                    <button onClick={() => onJumpToPage(b.page)} className="hover:text-primary">
                      Page {b.page}
                    </button>
                    <button onClick={() => removeBookmark(b.id)} className="text-danger/70 hover:text-danger text-xs">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : tab === "notes" ? (
          <>
            {selectedText && (
              <div className="mb-4 glass rounded-lg p-3">
                <p className="text-xs text-white/50 mb-2">Selected text:</p>
                <p className="text-sm italic mb-2">&ldquo;{selectedText}&rdquo;</p>
                <button
                  onClick={() => addNote("highlight")}
                  className="text-xs px-3 py-1.5 rounded-lg bg-accent text-black font-semibold"
                >
                  Save as highlight
                </button>
              </div>
            )}
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={`Add a note for page ${currentPage}...`}
              rows={3}
              className="w-full bg-black/30 border border-white/10 rounded-xl2 px-3 py-2 text-sm mb-2"
            />
            <button
              onClick={() => addNote("note")}
              className="w-full mb-4 px-4 py-2 rounded-xl2 border border-white/20 text-sm hover:bg-white/5"
            >
              Save note
            </button>

            {notes.length === 0 ? (
              <p className="text-white/40 text-sm">No notes or highlights yet.</p>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="glass rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs ${n.type === "highlight" ? "text-accent" : "text-secondary"}`}>
                        {n.type === "highlight" ? "Highlight" : "Note"} · Page {n.page}
                      </span>
                      <button onClick={() => removeNote(n.id)} className="text-danger/70 hover:text-danger text-xs">
                        Remove
                      </button>
                    </div>
                    <p className="text-white/80">{n.selected_text || n.note_text}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {lists.length === 0 ? (
              <p className="text-white/40 text-sm">
                You don't have any reading lists yet. Create one from the{" "}
                <Link href="/lists" className="text-primary underline">Reading Lists</Link> page, then come back here to add this book.
              </p>
            ) : (
              <div className="space-y-2">
                {lists.map((l) => (
                  <label key={l.id} className="flex items-center justify-between glass rounded-lg px-3 py-2 text-sm cursor-pointer">
                    <span>{l.name}</span>
                    <input
                      type="checkbox"
                      checked={listMembership.has(l.id)}
                      onChange={() => toggleListMembership(l.id)}
                    />
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
