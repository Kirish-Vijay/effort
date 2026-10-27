// Network first so updates show up straight away; cached shell only when offline.
const CACHE = "effort-v8";
const SHELL = ["./", "index.html", "game.css", "character.js", "icons.js", "items.js", "prompts.js", "game.js", "fx.js", "app.js", "models.js", "arena3d.js", "icon.svg", "manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    // no-cache: always ask the server, so a new release shows up on the next open rather than after the HTTP cache expires.
    fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" })
      .then((res) => {
        // Only keep complete, successful responses; never cache a 404 or a partial (206) one.
        if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))),
  );
});
