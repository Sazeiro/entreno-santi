// Service worker: app shell cache-first; plan.json network-first (siempre fresco si hay conexión).
const VERSION = "entreno-v4";
const SHELL = ["./", "index.html", "styles.css", "app.js", "logic.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/escudo.png", "icons/favicon.png", "icons/apple-touch-icon.png", "plan.json"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/plan.json")) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put("plan.json", copy)); return r; })
        .catch(() => caches.match("plan.json"))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return r;
    }))
  );
});
