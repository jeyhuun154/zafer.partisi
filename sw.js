/* ============================================================
   Zafer Partisi — Service Worker v2
   ============================================================ */

const CACHE_NAME = 'zaferpartisi-v2';
const DATA_CACHE = 'zaferpartisi-data-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/base.css',
  '/css/themes.css',
  '/css/animations.css',
  '/css/components.css',
  '/js/config.js',
  '/js/crypto.js',
  '/js/db.js',
  '/js/firebase.js',
  '/js/auth.js',
  '/js/notifications.js',
  '/js/ui.js',
  '/js/people.js',
  '/js/sync.js',
  '/js/app.js',
  '/js/devtools.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(STATIC_ASSETS.map(url =>
        cache.add(url).catch(err => console.warn('[SW] skip:', url, err))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME && k !== DATA_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // Google Fonts → stale-while-revalidate
  if (url.hostname.includes('fonts.')) { e.respondWith(swr(req, CACHE_NAME)); return; }
  // Firebase → network only (has own persistence)
  if (url.hostname.includes('firestore') || url.hostname.includes('firebase') || url.hostname.includes('googleapis')) return;
  // Video → special range handling
  if (url.pathname.endsWith('.mp4')) { e.respondWith(cacheVideo(req)); return; }
  // JSON → network first
  if (url.pathname.endsWith('.json') && !url.pathname.includes('manifest')) { e.respondWith(networkFirst(req, DATA_CACHE)); return; }
  // Everything else → cache first
  e.respondWith(cacheFirst(req, CACHE_NAME));
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirst(req, cn) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) { const c = await caches.open(cn); c.put(req, res.clone()); }
    return res;
  } catch { return new Response('Offline', { status: 503 }); }
}

async function networkFirst(req, cn) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200) { const c = await caches.open(cn); c.put(req, res.clone()); }
    return res;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}

async function swr(req, cn) {
  const cache = await caches.open(cn);
  const cached = await cache.match(req);
  const fp = fetch(req).then(r => { if (r && r.status === 200) cache.put(req, r.clone()); return r; }).catch(() => null);
  return cached || fp;
}

async function cacheVideo(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) { const c = await caches.open(CACHE_NAME); c.put(req, res.clone()); }
    return res;
  } catch { return new Response('Video offline', { status: 503 }); }
}
