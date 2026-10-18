// Service Worker for VIORA PWA — resilient offline app shell
// Bump this name when the offline shell strategy or precache list changes.
const CACHE_NAME = "viora-pwa-v2-offline-shell";
const APP_SHELL = [
  "/",
  "/index.html",
  "/icon.svg",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache shell files independently: a missing optional icon must not cancel
    // caching of index.html and leave the installed app unable to open.
    await Promise.allSettled(APP_SHELL.map(async (asset) => {
      try {
        const response = await fetch(asset, { cache: "reload" });
        if (response.ok && response.type === "basic") {
          await cache.put(asset, response);
        } else {
          console.warn("VIORA offline precache skipped:", asset, response.status);
        }
      } catch (error) {
        console.warn("VIORA offline precache failed:", asset, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("viora-pwa-") && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // APIs remain network-only. Offline search/lyrics must not break app startup.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({
        items: [],
        isOffline: true,
        message: "You're offline. Online search and lyrics need internet; local music and saved library remain available."
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )));
    return;
  }

  // Do not intercept Vite dev-server/HMR requests.
  if (
    url.pathname.startsWith("/@") ||
    url.pathname.includes("/node_modules/") ||
    url.pathname.includes("/src/") ||
    url.searchParams.has("t") ||
    url.searchParams.has("v") ||
    url.searchParams.has("import")
  ) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) =>
            cache.put(request, copy).catch(() => {})));
        }
        return response;
      } catch {
        const cachedPage = await caches.match(request);
        if (cachedPage) return cachedPage;
        const indexPage = await caches.match("/index.html");
        if (indexPage) return indexPage;
        const rootPage = await caches.match("/");
        if (rootPage) return rootPage;
        return new Response(
          "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>VIORA offline</title><body style=\"font-family:system-ui;padding:24px;background:#050714;color:#fff\"><h1>VIORA</h1><p>Offline app files are not cached yet. Connect to the internet, open VIORA once, wait for it to finish loading, then try again.</p></body></html>",
          { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      }
    })());
    return;
  }

  // Cache successful same-origin app files so JS modules and styles loaded online
  // remain available later. Return cached files immediately when offline.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const networkPromise = fetch(request).then((response) => {
      if (response && response.ok && response.type === "basic") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) =>
          cache.put(request, copy).catch(() => {})));
      }
      return response;
    });

    if (cached) {
      event.waitUntil(networkPromise.then(() => {}).catch(() => {}));
      return cached;
    }
    try {
      return await networkPromise;
    } catch {
      return new Response("", { status: 504, statusText: "Offline and resource not cached" });
    }
  })());
});
