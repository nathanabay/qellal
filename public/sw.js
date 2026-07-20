// Qellal service worker (F20) — conservative offline support.
// Strategy: network-first for page navigations (online users always get fresh
// content; offline falls back to the last-cached copy, then an offline page).
// Static assets are cache-first. Auth/API are never cached.
// Bump this on deploys that change caching behaviour — `activate` purges every
// cache whose name isn't the current one, so a bump also clears any pages an
// older SW may have cached (e.g. previously-cached personalized /account HTML).
const CACHE = "qellal-v2";
const OFFLINE_URL = "/offline";
const PRECACHE = ["/", "/tenders", OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache auth/API or PERSONALIZED pages. Caching /account or /admin would
  // write a user's PII (email, invoices, telegram token) into Cache Storage,
  // where it persists after logout and could be served to another user offline
  // on a shared device. Let these fall through to the network (no respondWith).
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/account") ||
    url.pathname.startsWith("/admin")
  ) {
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icon")) {
    event.respondWith(
      caches.match(req).then(
        (r) =>
          r ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
  }
});
