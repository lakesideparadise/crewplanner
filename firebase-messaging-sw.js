/* CableCrew unified PWA + Firebase Messaging service worker — v111 */
const CACHE = "cablecrew-v111";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon-32.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

/* Alleen eigen CableCrew-bestanden behandelen. Externe Firebase/Google-requests
   gaan rechtstreeks naar het netwerk en worden nooit door deze worker gecachet. */
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            caches.open(CACHE).then(cache => cache.put("./index.html", response.clone())).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && response.ok && response.type === "basic") {
        caches.open(CACHE).then(cache => cache.put(request, response.clone())).catch(() => {});
      }
      return response;
    }))
  );
});

importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBdeGM27e5xNRGipmEeQzmTW4aNMrKtc3A",
  authDomain: "cable-crew-planner.firebaseapp.com",
  projectId: "cable-crew-planner",
  storageBucket: "cable-crew-planner.firebasestorage.app",
  messagingSenderId: "179845869941",
  appId: "1:179845869941:web:3a4c640053c9eaf9f9e33c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || "CableCrew alarm";
  const options = {
    body: notification.body || data.body || "Open CableCrew voor meer informatie.",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: data.alertId ? `alarm-${data.alertId}` : "cablecrew",
    renotify: true,
    requireInteraction: data.type === "medical",
    data: {
      url: data.url || "./index.html",
      alertId: data.alertId || ""
    }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./index.html";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ("navigate" in client) client.navigate(targetUrl);
        if ("focus" in client) return client.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});
