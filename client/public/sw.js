/*
 * Asta service worker (Phase 4 · B14 → Phase 10 · M4) — dependency-free PWA caching.
 * App-shell precache + network-first navigations (offline → cached shell), cache-first
 * static assets, and stale-while-revalidate for a safe allowlist of read-only GET APIs so
 * recently-viewed learning data is readable offline. A `push` handler shows notifications.
 */
const VERSION = 'asta-v2';
const API_CACHE = 'asta-api-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/favicon.ico'];

// Read-only GET endpoints safe to serve stale when offline (no private mutations).
const SAFE_API = ['/api/roadmap', '/api/flows', '/api/spaces', '/api/quizzes', '/api/projects', '/api/skill-passport'];
const isSafeApi = (path) => SAFE_API.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== API_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Safe read-only APIs: stale-while-revalidate so they work offline; everything else /api → network only.
  if (url.pathname.startsWith('/api')) {
    if (!isSafeApi(url.pathname)) return;
    event.respondWith(
      caches.open(API_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || network;
        }),
      ),
    );
    return;
  }

  // SPA navigations: network-first, fall back to the cached app shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});

// Web Push (M4) — render the pushed notification.
self.addEventListener('push', (event) => {
  let data = { title: 'Asta', body: 'You have an update.', url: '/app/dashboard' };
  try { if (event.data) data = Object.assign(data, event.data.json()); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/app/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow(url);
    }),
  );
});
