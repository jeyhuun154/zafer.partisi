/* ============================================================
   Service Worker — Zafer Partisi
   Strategy: Cache-first for assets, network-first for API
   ============================================================ */

const CACHE_NAME = 'zafer-partisi-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/base.css',
  '/css/themes.css',
  '/css/animations.css',
  '/css/components.css',
  '/css/library.css',
  '/js/config.js',
  '/js/crypto.js',
  '/js/db.js',
  '/js/firebase.js',
  '/js/auth.js',
  '/js/ui.js',
  '/js/app.js',
  '/js/people.js',
  '/js/library.js',
  '/js/notifications.js',
  '/js/sync.js',
  '/js/devtools.js'
];

// ── Install: pre-cache static shell ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Add assets individually so one missing file doesn't break everything
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for Firebase/API, cache-first for assets ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests to Firebase/Google APIs — let them fail gracefully
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('fcm.googleapis.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      fetch(request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Cache-first for same-origin static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful same-origin responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Return cached index.html for navigation requests (SPA fallback)
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});

// ── Message: skip waiting on demand ──────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
