/* ============================================================
   Sync — Service Worker, online/offline, update check
   ============================================================ */

const Sync = (() => {
  // Configure this URL to enable remote data sync.
  // Point it to a JSON file on your server with the people data.
  // Leave as null to use local-only mode.
  const SYNC_URL = null; // e.g. 'https://yourdomain.com/data/people.json'

  let _registration = null;
  let _isOnline     = navigator.onLine;

  // ── Service Worker registration ───────────────────────────
  async function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      _registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('[Sync] Service Worker registered:', _registration.scope);

      // Listen for SW updates
      _registration.addEventListener('updatefound', () => {
        const newWorker = _registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content available — apply on next page load
            console.log('[Sync] New version available, will apply on next launch.');
            // Silently activate new worker
            newWorker.postMessage('SKIP_WAITING');
          }
        });
      });

      // Trigger update check in background
      setTimeout(() => _registration?.update(), 3000);

    } catch (err) {
      console.warn('[Sync] Service Worker registration failed:', err);
    }
  }

  // ── Online / offline detection ────────────────────────────
  function initConnectivityListeners() {
    window.addEventListener('online',  _handleOnline);
    window.addEventListener('offline', _handleOffline);

    // Initial check on load
    if (!navigator.onLine) {
      _handleOffline();
    }
  }

  function _handleOnline() {
    _isOnline = true;
    UI.hideOfflineBanner();
    // Trigger background data sync if configured
    if (SYNC_URL) _syncRemoteData();
    // Check for SW update
    setTimeout(() => _registration?.update(), 1000);
  }

  function _handleOffline() {
    _isOnline = false;
    UI.showOfflineBanner();
  }

  // ── Remote data sync ─────────────────────────────────────
  // Pull people data from SYNC_URL and merge into local DB.
  // Remote data takes precedence for existing IDs.
  async function _syncRemoteData() {
    if (!SYNC_URL || !_isOnline) return;
    try {
      const res  = await fetch(SYNC_URL, { cache: 'no-cache' });
      if (!res.ok) return;
      const data = await res.json();

      if (Array.isArray(data.people)) {
        for (const person of data.people) {
          if (person.id) {
            await DB.savePerson(person);
          }
        }
        console.log('[Sync] Remote data synced:', data.people.length, 'records');
      }
    } catch (err) {
      console.warn('[Sync] Remote sync failed:', err);
    }
  }

  // ── Manual sync trigger ───────────────────────────────────
  async function syncNow() {
    if (_isOnline && SYNC_URL) {
      await _syncRemoteData();
      return true;
    }
    return false;
  }

  function isOnline() { return _isOnline; }

  return {
    registerSW,
    initConnectivityListeners,
    syncNow,
    isOnline
  };
})();
