/* ============================================================
   Service Worker — Zafer Partisi v3
   ============================================================ */

const CACHE_NAME = 'zafer-partisi-v3';

// Media extensions that can return 206 Partial Content — never cache these
const SKIP_EXTENSIONS = /\.(mp4|mp3|webm|ogg|wav|m4v|m4a|avi|mov)(\?.*)?$/i;

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

// ── Install ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      )
    )
  );
  // Take over immediately — don't wait for old SW to die
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Only handle GET
  if (request.method !== 'GET') return;

  // 2. Skip range requests (video/audio streaming → HTTP 206)
  //    Cache API cannot store 206 responses — throws TypeError
  if (request.headers.get('range')) return;

  const url = new URL(request.url);

  // 3. Skip media files by extension (belt-and-suspenders for 206)
  if (SKIP_EXTENSIONS.test(url.pathname)) return;

  // 4. Skip all cross-origin requests — Firebase, fonts, CDN, etc.
  if (url.origin !== self.location.origin) return;

  // 5. Cache-first for same-origin assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Only store complete (200), non-opaque responses
          if (response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
              .catch(() => {}); // swallow any cache errors silently
          }
          return response;
        })
        .catch(() => {
          // Offline fallback for page navigations
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('', { status: 503 });
        });
    })
  );
});

// ── Message ───────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
