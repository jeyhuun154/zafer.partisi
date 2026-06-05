/* ============================================================
   Sync — Service Worker registration + online/offline handling
   ============================================================ */

const Sync = (() => {
  let _registration = null;
  let _isOnline     = navigator.onLine;

  // ── Service Worker registration ───────────────────────────
  async function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      _registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      _registration.addEventListener('updatefound', () => {
        const newWorker = _registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage('SKIP_WAITING');
          }
        });
      });

      setTimeout(() => _registration?.update(), 3000);
    } catch (err) {
      console.warn('[Sync] Service Worker registration failed:', err);
    }
  }

  // ── Online / offline detection ────────────────────────────
  function initConnectivityListeners() {
    window.addEventListener('online',  _handleOnline);
    window.addEventListener('offline', _handleOffline);
    if (!navigator.onLine) _handleOffline();
  }

  function _handleOnline() {
    _isOnline = true;
    UI.hideOfflineBanner();
    setTimeout(() => _registration?.update(), 1000);
  }

  function _handleOffline() {
    _isOnline = false;
    UI.showOfflineBanner();
  }

  return { registerSW, initConnectivityListeners };
})();
