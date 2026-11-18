/* Life Board offline shell. Bump VERSION whenever the app files change. */
const VERSION = "lb-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon-32.png", "./supabase.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // never cache your data or sign-in traffic
  if (url.hostname.endsWith("supabase.co")) return;

  // the app page: fresh when online, cached copy when offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); return r; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // icons, fonts and the sign-in library: cache first
  const cacheable = url.origin === location.origin || url.hostname === "cdn.jsdelivr.net" ||
    url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!cacheable) return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return r;
    }))
  );
});
