"use client";

import { useEffect } from "react";

// This used to REGISTER a service worker (purely to satisfy some browsers'
// PWA installability check — it never did any real caching). It's caused
// two separate real bugs now: a blank-on-first-load issue, and it's the
// prime suspect for "site doesn't load data until I refresh" too, since a
// service worker sitting between the page and every network request is
// exactly the kind of thing that causes that pattern. It provided no real
// benefit worth that risk, so instead of patching it again, this now
// actively REMOVES any service worker still running from an earlier
// visit — new code alone doesn't undo an already-installed one on a
// returning user's device, so this cleanup step is what actually fixes it
// for people who hit the bug before this update.
export default function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }, []);

  return null;
}
