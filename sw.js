// Near service worker: makes the app installable, loads it offline, and shows notifications.
const CACHE = 'near-v1';
const DEV = self.location.hostname === 'localhost'; // never cache while developing

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (DEV || req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // maps and fonts: network only

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    // The page itself: network first, the saved copy when offline.
    if (req.mode === 'navigate') {
      try {
        const res = await fetch(req);
        if (res.ok) cache.put('/', res.clone());
        return res;
      } catch {
        return (await cache.match('/')) || Response.error();
      }
    }

    // Files (JS, CSS, icons): saved copy first for speed, refreshed in the background.
    const cached = await cache.match(req);
    const refresh = fetch(req)
      .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => undefined);
    if (cached) { event.waitUntil(refresh); return cached; }
    return (await refresh) || Response.error();
  })());
});

// Tapping a notification brings the app to the front.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.length) return windows[0].focus();
    return self.clients.openWindow('/');
  })());
});
