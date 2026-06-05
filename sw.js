/* ============================================================
   Service Worker — Zafer Partisi
   Strategy: Cache-first for assets, network-first for API
   ============================================================ */

const CACHE_NAME = 'zafer-partisi-v2';
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

// ── Helpers ───────────────────────────────────────────────
function _isCacheable(response) {
  if (!response) return false;
  // Only cache full (200) responses — never partial (206) or errors.
  // Status 206 is used for range/streaming requests (video, audio) and
  // cannot be stored in the Cache API — attempting to do so throws a TypeError.
  if (response.status !== 200) return false;
  // Only cache basic (same-origin) responses, not opaque cross-origin ones
  if (response.type === 'opaque') return false;
  return true;
}

// ── Fetch: network-first for Firebase/API, cache-first for assets ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip video/audio range requests — these use HTTP 206 Partial Content
  // and are incompatible with the Cache API
  if (request.headers.get('range')) return;

  // Skip cross-origin Firebase/Google API requests — pass straight through
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('fcm.googleapis.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('unpkg.com')
  ) {
    // Don't intercept — let the browser handle it normally
    return;
  }

  // Cache-first for same-origin static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Only cache safe, full responses
        if (_isCacheable(response) && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone).catch(() => {});
          });
        }
        return response;
      }).catch(() => {
        // SPA fallback: return cached index.html for navigation requests
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
