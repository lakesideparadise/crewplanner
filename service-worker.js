const CACHE_NAME = "cablecrew-v10-mobile-hotfix";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./favicon-32.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.warn("App shell cache:", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("cablecrew-") &&
              key !== CACHE_NAME
            )
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Externe requests zoals Firebase niet via onze cache behandelen.
  if (url.origin !== self.location.origin) return;

  // Planning altijd zo vers mogelijk ophalen.
  if (url.pathname.endsWith("/planning.json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // HTML: altijd eerst de nieuwste versie van het netwerk proberen.
  if (
    event.request.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html")
  ) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put("./index.html", copy))
              .catch(() => {});
          }

          return response;
        })
        .catch(async () =>
          (await caches.match("./index.html")) ||
          (await caches.match("./"))
        )
    );

    return;
  }

  // Andere bestanden: netwerk eerst, cache als fallback.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy))
            .catch(() => {});
        }

        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
