const CACHE_NAME = 'quantum-tunnel-v29';
const BASE_PATH = new URL(self.registration.scope).pathname;
const CORE_ASSETS = [
  BASE_PATH,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}icon.svg`,
  `${BASE_PATH}icon-192.png`,
  `${BASE_PATH}icon-512.png`,
  `${BASE_PATH}apple-touch-icon.png`,
  `${BASE_PATH}tracks/default.mp3`
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    const page = await cache.match(BASE_PATH);
    const html = await page.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin && url.pathname.startsWith(`${BASE_PATH}assets/`))
      .map((url) => url.href);
    await cache.addAll(assets);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(BASE_PATH, copy)));
          }
          return response;
        })
        .catch(() => caches.match(BASE_PATH))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
          }
          return response;
        })
        .catch(() => Response.error());
    })
  );
});
