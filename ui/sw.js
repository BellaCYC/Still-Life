// StillLife web app: works offline. App files come from the cache at once and are
// refreshed in the background, so the next launch has the newest version.
const CACHE = "stilllife-1.2.0";
const FILES = ["./", "index.html", "notes.css", "notes.js", "tools.js", "i18n.js", "group.js", "icon.png",
  "apple-touch-icon.png", "app-192.png", "app-512.png", "app-maskable.png", "manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("stilllife-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    return (await fresh) || (await c.match("index.html")) || Response.error();
  }));
});
