// Service worker for Pil Order Portal-Bihar
// Strategy: network-first for the app shell (HTML/JS), so installed users
// always get the latest code the moment they're online - falls back to
// cache only when offline. Firebase traffic (live orders/stock/auth) is
// never intercepted - always goes straight to the network.

const CACHE_NAME = 'pil-portal-bihar-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never intercept Firebase (realtime data/auth) or non-GET requests -
  // always go straight to the network for these.
  if (
    event.request.method !== 'GET' ||
    url.includes('firebaseio.com') ||
    url.includes('googleapis.com') ||
    url.includes('firebaseapp.com')
  ) {
    return;
  }

  // Network-first for HTML page loads/navigations - always get fresh code
  // when online; cache is only a fallback for offline use.
  if (event.request.mode === 'navigate' || url.endsWith('index.html') || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets (manifest, icons) - fine to be a little
  // stale, and keeps the app shell loading instantly.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
