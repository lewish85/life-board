/* Life Board offline shell. Bump VERSION whenever the app files change. */
const VERSION = "lb-v4";
const SHELL = ["./", "./index.html", "./app.css", "./app.js", "./wheel.js", "./store.js", "./supabase.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon-32.png"];

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
  if (url.hostname.endsWith("supabase.co")) return; // your data and sign-in are never cached

  // the app's own files: fresh when online, cached copy when offline
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req.mode === "navigate" ? "./index.html" : req, copy)); }
        return r;
      }).catch(() => caches.match(req.mode === "navigate" ? "./index.html" : req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // fonts: cache first
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r;
    })));
  }
});

/* ---------- notifications ---------- */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Life Board", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Life Board", {
    body: d.body || "", tag: d.tag || undefined, renotify: true,
    icon: "icon-192.png", badge: "icon-192.png",
    data: { url: d.url || "./#timeline" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL(e.notification.data && e.notification.data.url || "./#timeline", self.registration.scope).href;
  const day = new URL(target).searchParams.get("day");
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope)) { c.postMessage({ day }); return c.focus(); } }
    return clients.openWindow(target);
  }));
});
