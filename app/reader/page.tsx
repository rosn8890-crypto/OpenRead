"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import TextToSpeech from "@/components/TextToSpeech";
import ReaderPanel from "@/components/ReaderPanel";
import ReviewsPanel from "@/components/ReviewsPanel";

// react-pdf needs browser-only APIs (DOMMatrix etc.) that don't exist in
// the Node.js environment Next.js uses to pre-render pages during
// `next build` with output: 'export'. ssr:false keeps it out of that
// pre-render pass entirely — it only loads once this runs in the browser.
const PdfViewer = dynamic(() => import("@/components/PdfViewer"), { ssr: false });

function ReaderContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const supabase = createClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageAreaRef = useRef<HTMLDivElement>(null);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState("book");
  const [bookFileType, setBookFileType] = useState("pdf");
  const [downloading, setDownloading] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [theme, setTheme] = useState<"dark" | "sepia" | "light">("dark");
  const [loading, setLoading] = useState(true);
  const [fileError, setFileError] = useState(false);

  const [pageText, setPageText] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [dictDefinition, setDictDefinition] = useState<string | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [jumpInput, setJumpInput] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [turnDirection, setTurnDirection] = useState<1 | -1>(1);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageWidth, setPageWidth] = useState(700);
  const [aspectRatio, setAspectRatio] = useState(0.75); // width/height guess until the real page loads
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Always fit the page to the screen automatically — both across AND
  // down, using the book's real aspect ratio once known — so the whole
  // page is visible without scrolling or pressing any button. This is
  // recomputed whenever the available space changes (resize, entering/
  // exiting full screen) or once we learn the real page proportions.
  useEffect(() => {
    function recompute() {
      if (!pageAreaRef.current) return;
      const availableWidth = pageAreaRef.current.clientWidth - 32;
      const availableHeight = pageAreaRef.current.clientHeight - 32;
      const widthIfLimitedByHeight = availableHeight * aspectRatio;
      const finalWidth = Math.min(availableWidth, widthIfLimitedByHeight);
      setPageWidth(Math.max(240, Math.min(finalWidth, 1400)));
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [aspectRatio, isFullscreen]);

  function handlePageDimensions(w: number, h: number) {
    setAspectRatio(w / h);
  }

  // "Full Screen" is CSS-only (position: fixed, covers the whole viewport)
  // rather than the browser's real Fullscreen API. Real fullscreen mode
  // disables pinch-to-zoom on most phones by OS-level design — there's no
  // way to override that from code — so faking it with CSS gets the same
  // "takes over the screen" look while keeping pinch-zoom fully working.
  function toggleFullscreen() {
    setIsFullscreen((v) => !v);
  }

  // Esc also exits our CSS-based fullscreen, same as it would for the
  // browser's native one.
  useEffect(() => {
    if (!isFullscreen) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsFullscreen(false);
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  // Keyboard shortcuts: ← / → change page, Esc closes any open panel.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") changePage(1);
      if (e.key === "ArrowLeft") changePage(-1);
      if (e.key === "Escape") {
        setPanelOpen(false);
        setReviewsOpen(false);
        setDictDefinition(null);
        setMoreMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [pageNumber, numPages]);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const { data: book } = await supabase
        .from("books")
        .select("file_path, title, file_type")
        .eq("id", id)
        .single();

      if (book) {
        const { data } = supabase.storage.from("books").getPublicUrl(book.file_path);
        setFileUrl(data.publicUrl);
        setBookTitle(book.title ?? "book");
        setBookFileType(book.file_type ?? "pdf");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: progress } = await supabase
          .from("reading_progress")
          .select("current_page")
          .eq("book_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        const openedAtPage = progress?.current_page || 1;
        if (progress?.current_page) setPageNumber(progress.current_page);

        // Record that this book was opened right away — previously,
        // nothing was saved until the reader actually flipped to a
        // different page, so just opening and reading page 1 never
        // registered at all, and the book could never show up under
        // "Continue Reading" on the homepage or dashboard.
        await supabase.from("reading_progress").upsert(
          {
            user_id: user.id,
            book_id: id,
            current_page: openedAtPage,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: "user_id,book_id" }
        );
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const saveProgress = useCallback(
    async (page: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !id) return;
      await supabase.from("reading_progress").upsert(
        {
          user_id: user.id,
          book_id: id,
          current_page: page,
          total_pages: numPages,
          progress_percent: numPages ? Math.round((page / numPages) * 100) : 0,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "user_id,book_id" }
      );
    },
    [id, numPages]
  );

  function changePage(delta: number) {
    const next = Math.min(Math.max(pageNumber + delta, 1), numPages || 1);
    if (next === pageNumber) return;
    setTurnDirection(delta > 0 ? 1 : -1);
    setPageNumber(next);
    setSelectedText("");
    saveProgress(next);
  }

  function jumpToPage(page: number) {
    setTurnDirection(page > pageNumber ? 1 : -1);
    setPageNumber(page);
    setSelectedText("");
    saveProgress(page);
  }

  function handleMouseUp() {
    const selection = window.getSelection()?.toString().trim() ?? "";
    if (selection.length > 0) {
      setSelectedText(selection);
      setDictDefinition(null);
      setCopyFeedback(false);
    }
  }

  async function copySelectedText() {
    try {
      await navigator.clipboard.writeText(selectedText);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Clipboard API can fail on http:// or unsupported browsers — the
      // text is still selected, so the person can still use Ctrl/Cmd+C.
      setCopyFeedback(false);
    }
  }

  // Swipe gestures: swipe left -> next page, swipe right -> previous page.
  // Vertical scrolling is left completely alone — we only act when the
  // horizontal movement clearly dominates, so a normal up/down scroll
  // never gets mistaken for a page turn.
  function handleTouchStart(e: React.TouchEvent) {
    // More than one finger means a pinch gesture, not a swipe — leave it
    // completely alone so the browser's native pinch-to-zoom still works.
    if (e.touches.length > 1) {
      touchStart.current = null;
      return;
    }
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    // If the person was actually selecting text (long-press + drag), don't
    // also treat that same gesture as a page-turn swipe.
    const selection = window.getSelection()?.toString().trim() ?? "";
    if (selection.length > 0) {
      setSelectedText(selection);
      setDictDefinition(null);
      setCopyFeedback(false);
      touchStart.current = null;
      return;
    }

    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const deltaX = t.clientX - touchStart.current.x;
    const deltaY = t.clientY - touchStart.current.y;
    touchStart.current = null;

    const SWIPE_THRESHOLD = 50;
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) changePage(1); // swiped left -> next
      else changePage(-1); // swiped right -> previous
    }
  }

  async function lookupDictionary() {
    const word = selectedText.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z'-]/g, "");
    if (!word) return;
    setDictLoading(true);
    setDictDefinition(null);
    try {
      // Free, no-key public dictionary API — safe to call directly from
      // the browser (unlike a generative-AI API key, this one is meant
      // to be used client-side with no secret to protect).
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (res.status === 404) {
        setDictDefinition(`No dictionary entry found for "${word}".`);
        return;
      }
      if (!res.ok) throw new Error(`Dictionary service returned ${res.status}`);
      const data = await res.json();
      const def = data[0]?.meanings?.[0]?.definitions?.[0]?.definition;
      setDictDefinition(def || `No definition found for "${word}".`);
    } catch (err) {
      // A distinct message here (vs "not found" above) makes it possible to
      // tell a real network/CORS/offline problem apart from just an
      // uncommon word — worth knowing if this ever needs debugging again.
      setDictDefinition("Couldn't reach the dictionary service — check your connection and try again.");
    } finally {
      setDictLoading(false);
    }
  }

  function openTranslate() {
    // Real machine translation needs either a paid API or a key-holding
    // backend server to call it safely — neither fits a key-free static
    // site. Opening Google Translate in a new tab with the text pre-filled
    // gets the same result for the reader without exposing any secret.
    const url = `https://translate.google.com/?sl=auto&tl=hi&text=${encodeURIComponent(selectedText)}&op=translate`;
    window.open(url, "_blank");
  }

  async function downloadBook() {
    if (!fileUrl || downloading) return;
    setDownloading(true);
    try {
      // A plain <a download> is ignored by browsers for cross-origin URLs
      // (the file lives on Supabase's domain, not this site's), so it
      // would just open the file instead of saving it. Fetching it as a
      // blob first and downloading THAT is what actually forces a save.
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const safeName = bookTitle.replace(/[/\\?%*:|"<>]/g, "-");
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${safeName}.${bookFileType}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      // Best-effort download count — uses a database function since a
      // regular reader isn't allowed to edit someone else's book row
      // directly (that's intentionally restricted); this function is the
      // one safe, narrow exception. If it fails for any reason, the
      // download itself still succeeded, so we don't show an error for it.
      if (id) supabase.rpc("increment_download_count", { book_id: id }).then(() => {});
    } catch {
      // Fallback: open it directly. Won't force a "Save As" dialog the
      // same way, but the person can still still save it from there.
      window.open(fileUrl, "_blank");
    } finally {
      setDownloading(false);
    }
  }

  function handleJumpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const page = parseInt(jumpInput);
    if (page >= 1 && page <= (numPages || page)) {
      jumpToPage(page);
      setJumpInput("");
    }
  }

  const themeClasses = {
    dark: "bg-black text-white",
    sepia: "bg-[#F4ECD8] text-[#3B2F1E]",
    light: "bg-white text-black",
  };

  if (!id) return <p className="text-center py-20 text-danger">No book selected.</p>;
  if (loading) return <p className="text-center py-20 text-white/50">Loading book...</p>;
  if (!fileUrl) return <p className="text-center py-20 text-danger">Book not found.</p>;
  if (fileError) {
    return (
      <p className="text-center py-20 text-white/50 max-w-md mx-auto">
        This book's file hasn't been uploaded yet — its listing exists, but no
        readable file is attached. Check back soon, or contact the admin.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col ${themeClasses[theme]} transition-colors ${
        isFullscreen ? "fixed inset-0 z-[100] h-[100dvh]" : "h-screen"
      }`}
    >
      <div className="border-b border-white/10 sticky top-0 bg-inherit z-10">
        {/* Slim bar: always visible, works on any screen size */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-white/70 shrink-0">
            Page {pageNumber} / {numPages || "?"} · {numPages ? Math.round((pageNumber / numPages) * 100) : 0}%
          </span>

          {/* Full controls inline on larger screens */}
          <div className="hidden md:flex items-center gap-2 text-sm flex-wrap">
            {(["dark", "sepia", "light"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-3 py-1 rounded-lg border ${theme === t ? "border-primary text-primary" : "border-white/20"}`}
              >
                {t}
              </button>
            ))}
            <button
              onClick={toggleFullscreen}
              className={`px-3 py-1 rounded-lg border ${isFullscreen ? "border-primary text-primary" : "border-white/20"}`}
            >
              {isFullscreen ? "⤓ Exit Full Screen" : "⛶ Full Screen"}
            </button>
            <TextToSpeech text={pageText} />
            <button
              onClick={downloadBook}
              disabled={downloading}
              className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/5"
            >
              {downloading ? "⏳ Downloading..." : "⬇ Download"}
            </button>
            <button onClick={() => setReviewsOpen(true)} className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/5">
              ⭐ Reviews
            </button>
            <button onClick={() => setPanelOpen(true)} className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/5">
              🔖 Notes
            </button>
            <form onSubmit={handleJumpSubmit}>
              <input
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                placeholder="Go to page"
                className="w-24 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs"
              />
            </form>
          </div>

          {/* 3-dot menu — mobile only, keeps the reading area uncluttered */}
          <button
            onClick={() => setMoreMenuOpen((v) => !v)}
            className="md:hidden w-9 h-9 shrink-0 rounded-lg border border-white/20 flex items-center justify-center text-lg"
            aria-label="More options"
          >
            ⋮
          </button>
        </div>

        {/* Mobile dropdown with every secondary control */}
        {moreMenuOpen && (
          <div className="md:hidden px-4 pb-4 flex flex-col gap-3 text-sm border-t border-white/10 pt-3">
            <div className="flex gap-2">
              {(["dark", "sepia", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 px-3 py-2 rounded-lg border ${theme === t ? "border-primary text-primary" : "border-white/20"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={() => { toggleFullscreen(); setMoreMenuOpen(false); }}
              className={`px-3 py-2 rounded-lg border text-left ${isFullscreen ? "border-primary text-primary" : "border-white/20"}`}
            >
              {isFullscreen ? "⤓ Exit Full Screen" : "⛶ Full Screen"}
            </button>
            <TextToSpeech text={pageText} />
            <button
              onClick={() => { downloadBook(); setMoreMenuOpen(false); }}
              disabled={downloading}
              className="px-3 py-2 rounded-lg border border-white/20 text-left"
            >
              {downloading ? "⏳ Downloading..." : "⬇ Download book"}
            </button>
            <button onClick={() => { setReviewsOpen(true); setMoreMenuOpen(false); }} className="px-3 py-2 rounded-lg border border-white/20 text-left">
              ⭐ Reviews
            </button>
            <button onClick={() => { setPanelOpen(true); setMoreMenuOpen(false); }} className="px-3 py-2 rounded-lg border border-white/20 text-left">
              🔖 Bookmarks &amp; Notes
            </button>
            <form onSubmit={handleJumpSubmit} className="flex gap-2">
              <input
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                placeholder="Go to page number"
                className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm"
              />
              <button className="px-3 py-2 rounded-lg border border-white/20">Go</button>
            </form>
          </div>
        )}
      </div>

      {selectedText && (
        <div className="flex flex-wrap items-center gap-3 px-6 py-2 border-b border-white/10 bg-black/20 text-sm">
          <span className="text-white/50 italic truncate max-w-xs">&ldquo;{selectedText}&rdquo;</span>
          <button onClick={copySelectedText} className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/5">
            {copyFeedback ? "✅ Copied!" : "📋 Copy"}
          </button>
          <button onClick={lookupDictionary} className="px-3 py-1 rounded-lg border border-secondary/40 text-secondary hover:bg-secondary/10">
            {dictLoading ? "Looking up..." : "📖 Dictionary"}
          </button>
          <button onClick={openTranslate} className="px-3 py-1 rounded-lg border border-accent/40 text-accent hover:bg-accent/10">
            🌐 Translate
          </button>
          <button onClick={() => setPanelOpen(true)} className="px-3 py-1 rounded-lg border border-primary/40 text-primary hover:bg-primary/10">
            ✏️ Save as note
          </button>
          {dictDefinition && <span className="text-white/70 w-full">{dictDefinition}</span>}
        </div>
      )}

      <div
        ref={pageAreaRef}
        className="flex-1 flex items-center justify-center overflow-auto px-4 py-4"
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <PdfViewer
          fileUrl={fileUrl}
          pageNumber={pageNumber}
          width={pageWidth}
          turnDirection={turnDirection}
          onLoadSuccess={setNumPages}
          onError={() => setFileError(true)}
          onPageTextReady={setPageText}
          onPageDimensions={handlePageDimensions}
        />
      </div>

      <div className="shrink-0 flex justify-center gap-4 py-3">
        <button onClick={() => changePage(-1)} className="px-4 py-2 rounded-lg glass">
          ← Prev
        </button>
        <button onClick={() => changePage(1)} className="px-4 py-2 rounded-lg bg-primary text-black font-semibold">
          Next →
        </button>
      </div>

      {panelOpen && (
        <ReaderPanel
          bookId={id}
          currentPage={pageNumber}
          selectedText={selectedText}
          onJumpToPage={jumpToPage}
          onClose={() => setPanelOpen(false)}
        />
      )}
      {reviewsOpen && <ReviewsPanel bookId={id} onClose={() => setReviewsOpen(false)} />}
    </div>
  );
}

export default function ReaderPage() {
  return (
    <Suspense fallback={<p className="text-center py-20 text-white/40">Loading...</p>}>
      <ReaderContent />
    </Suspense>
  );
}
