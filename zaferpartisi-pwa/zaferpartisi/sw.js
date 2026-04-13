/* ============================================================
   Zafer Partisi — Service Worker
   Strategy:
     • Static assets  → Cache First (fallback to network)
     • Data / JSON    → Network First (fallback to cache)
     • Video (intro)  → Cache on first load, serve from cache
   ============================================================ */

const CACHE_NAME   = 'zaferpartisi-v1';
const DATA_CACHE   = 'zaferpartisi-data-v1';

// Core static assets to pre-cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/base.css',
  '/css/themes.css',
  '/css/animations.css',
  '/css/components.css',
  '/js/crypto.js',
  '/js/db.js',
  '/js/auth.js',
  '/js/ui.js',
  '/js/people.js',
  '/js/sync.js',
  '/js/app.js',
  // Google Fonts (best effort)
  'https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap'
];

// Assets cached lazily on first access (large files)
const LAZY_ASSETS = [
  '/assets/intro.mp4',
  '/assets/logo.png'
];

// ── Install ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache static assets; allow individual failures silently
      await Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Could not cache:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== DATA_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET and chrome-extension requests
  if (req.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // Skip Google Fonts stylesheet (handle with stale-while-revalidate)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, CACHE_NAME));
    return;
  }

  // JSON data / API → Network First
  if (url.pathname.endsWith('.json') && !url.pathname.includes('manifest')) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  // Video files → Cache with range request support
  if (url.pathname.endsWith('.mp4') || url.pathname.endsWith('.webm')) {
    event.respondWith(cacheVideo(req));
    return;
  }

  // Everything else → Cache First
  event.respondWith(cacheFirst(req, CACHE_NAME));
});

// ── Message ────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CHECK_UPDATE') {
    self.registration.update();
  }
});

// ── Strategies ─────────────────────────────────────────────

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const response = await fetch(req);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(req, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req, cacheName) {
  try {
    const response = await fetch(req);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(req, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(response => {
    if (response && response.status === 200) {
      cache.put(req, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || fetchPromise;
}

async function cacheVideo(req) {
  // Videos need special handling for range requests
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const response = await fetch(req);
    if (response && (response.status === 200 || response.status === 206)) {
      // Only cache full response (not partial)
      if (response.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, response.clone());
      }
      return response;
    }
    return response;
  } catch {
    return new Response('Video not available offline', { status: 503 });
  }
}
