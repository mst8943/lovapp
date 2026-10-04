const OFFLINE_CACHE = "lovask-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => event.waitUntil(
  caches.open(OFFLINE_CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/pwa/icon-192.png"])).then(() => self.skipWaiting())
));
self.addEventListener("activate", (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("lovask-offline-") && key !== OFFLINE_CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  event.waitUntil((async () => {
    let payload;
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
    await self.registration.showNotification(payload.title || "Lovask", {
      body: payload.body || "Yeni bir mesajın var.",
      icon: payload.icon || "/pwa/icon-192.png",
      badge: "/pwa/icon-192.png",
      lang: "tr",
      tag: payload.tag || "lovask-message",
      renotify: true,
      data: { url: payload.url || "/?open=messages" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/?open=messages", self.location.origin).href;
  event.waitUntil((async () => {
    const openClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = openClients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});
