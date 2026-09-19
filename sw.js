// Service Worker for VIORA PWA — Offline App Shell & Network Strategies
const CACHE_NAME = "viora-pwa-v1";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/public/icon.svg",
  "/public/manifest.json",
  "/public/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn("Pre-caching shell assets warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and chrome-extension/blob schemes
  if (event.request.method !== "GET" || !event.request.url.startsWith("http")) {
    return;
  }

  // Skip Vite internal development requests, hot modules, and web socket proxies
  if (
    url.pathname.startsWith("/@") ||
    url.pathname.includes("/node_modules/") ||
    url.pathname.includes("/src/") ||
    url.searchParams.has("t") ||
    url.searchParams.has("v") ||
    url.searchParams.has("import")
  ) {
    return;
  }

  // Handle YouTube API and search routes (network-only or network-first with graceful offline JSON)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            items: [],
            isOffline: true,
            message: "You are currently offline. Local music and cached tracks remain playable."
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" }
          }
        );
      })
    );
    return;
  }

  // For HTML navigation requests, use Network-First strategy to ensure latest preview updates
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match("/index.html") || caches.match("/");
        })
    );
    return;
  }

  // App shell & static assets: Stale-While-Revalidate strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
