"use client";

import { Document, Page, pdfjs } from "react-pdf";
import { motion, AnimatePresence } from "framer-motion";
import "react-pdf/dist/Page/TextLayer.css";

// Runs only in the browser (this file is loaded with ssr:false), so it's
// safe to touch browser-only APIs here — this would crash a Node.js build.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function PdfViewer({
  fileUrl,
  pageNumber,
  width,
  turnDirection = 1,
  onLoadSuccess,
  onError,
  onPageTextReady,
  onPageDimensions,
}: {
  fileUrl: string;
  pageNumber: number;
  width: number;
  // 1 = moving forward (next page), -1 = moving backward (previous page).
  // Only affects which way the flip animation appears to turn.
  turnDirection?: 1 | -1;
  onLoadSuccess: (numPages: number) => void;
  onError: () => void;
  // Called with the plain text of the currently rendered page. Used for
  // Text-to-Speech.
  onPageTextReady?: (text: string) => void;
  // Called with the page's natural width/height (in PDF points) once known,
  // so the reader can size the page to fit the screen both across AND
  // down — not just fit the width, which can still leave a tall page
  // taller than the screen and needing a scroll to see the rest.
  onPageDimensions?: (width: number, height: number) => void;
}) {
  function handlePageLoadSuccess(page: any) {
    if (onPageDimensions) {
      // pdf.js's page proxy exposes the natural page box via .view =
      // [x0, y0, x1, y1] in PDF points — read defensively since exact
      // property names can vary slightly across pdf.js versions.
      const w = page?.originalWidth ?? (page?.view ? page.view[2] - page.view[0] : null);
      const h = page?.originalHeight ?? (page?.view ? page.view[3] - page.view[1] : null);
      if (w && h) onPageDimensions(w, h);
    }

    if (onPageTextReady) {
      // Read the text straight from the parsed PDF data via pdf.js, rather
      // than scraping it back out of the rendered DOM text layer. The DOM
      // approach used to live here but was unreliable: the page-turn
      // animation keys and remounts this component's wrapper on every page
      // change, and a plain useRef shared across those mounts/unmounts can
      // get cleared by an old page's unmount right as the new page's ref
      // is what should be in use — an easy way for "Listen to this page"
      // to end up reading stale or empty text. Going straight to the
      // source avoids all of that.
      page
        .getTextContent()
        .then((content: any) => {
          const text = (content?.items ?? []).map((item: any) => item.str ?? "").join(" ");
          onPageTextReady(text);
        })
        .catch(() => onPageTextReady(""));
    }
  }

  return (
    // <Document> is deliberately OUTSIDE the animated/keyed element below —
    // it holds the parsed PDF file. If it remounted on every page turn,
    // the whole file would re-download and re-parse every time you flip a
    // page, causing a lag spike instead of a smooth animation. Only the
    // individual <Page> swaps, which is cheap since the file is already loaded.
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
      onLoadError={onError}
    >
      <div style={{ perspective: 2200 }}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={pageNumber}
            initial={{ rotateY: turnDirection > 0 ? 92 : -92, opacity: 0.4 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: turnDirection > 0 ? -92 : 92, opacity: 0.4 }}
            transition={{ duration: 0.42, ease: [0.45, 0.05, 0.15, 1] as const }}
            style={{
              position: "relative",
              transformStyle: "preserve-3d",
              transformOrigin: turnDirection > 0 ? "left center" : "right center",
              backfaceVisibility: "hidden",
              // The page "lifts" off the book while turning, then settles
              // flat again — a plain flat rotation with no shadow change
              // reads as a stiff card flip rather than paper.
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          >
            <Page
              pageNumber={pageNumber}
              width={width}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              onLoadSuccess={handlePageLoadSuccess}
            />

            {/* Fold shading: a gradient hugging the turning edge that darkens
                as the page curls away and fades once it lies flat again —
                this is what actually sells "paper folding" over "card
                spinning". It's a separate layer on top of the page so it
                can fade independently of the page's own opacity. */}
            <motion.div
              aria-hidden
              initial={{ opacity: 0.55 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0.55 }}
              transition={{ duration: 0.42, ease: [0.45, 0.05, 0.15, 1] as const }}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  turnDirection > 0
                    ? "linear-gradient(to right, rgba(0,0,0,0.55), transparent 35%)"
                    : "linear-gradient(to left, rgba(0,0,0,0.55), transparent 35%)",
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </Document>
  );
}
