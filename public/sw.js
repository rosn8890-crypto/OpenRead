// Minimal service worker: exists ONLY to satisfy installability checks in
// browsers that require a registered service worker before offering
// "Install" (some Chrome/Edge versions). It intentionally does NOT cache
// anything and does NOT intercept fetch requests.
//
// Why so bare: an earlier version called self.clients.claim() in
// "activate", which makes the service worker immediately take over
// control of the page that's still loading. That caused a real bug —
// the site would sometimes render blank on the very first visit and only
// work after a manual refresh, because control was being handed over
// mid-load. Since this worker provides no real caching benefit yet,
// there's no reason to risk that — it just needs to exist and be active.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  // Deliberately NOT calling self.clients.claim() here — see note above.
});
