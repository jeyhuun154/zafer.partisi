/* ============================================================
   Sync — Service Worker registration
   ============================================================ */

const Sync = (() => {
  let _registration = null;

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

  // ── No-op shim — keeps any lingering UI.showOfflineBanner / UI.hideOfflineBanner
  //    calls in older code from throwing errors
  function initConnectivityListeners() {}

  return { registerSW, initConnectivityListeners };
})();
