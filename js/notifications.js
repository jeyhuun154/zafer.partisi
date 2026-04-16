/* ============================================================
   Notifications — in-app + background push
   
   In-app:  Firestore /notifications onSnapshot → Browser Notification
   Background: firebase-messaging-sw.js handles FCM when tab is closed
   ============================================================ */

const Notifications = (() => {
  let _unsubscribe = null;
  let _lastSeen    = 0;  // timestamp — ignore old notifications

  // ── Init (call after login) ───────────────────────────────
  async function init(userId) {
    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    // Save FCM token for this user
    try {
      const token = await FirebaseService.getFCMToken();
      if (token) await FirebaseService.saveFCMToken(userId, token);
    } catch {}

    // Mark "last seen" so we don't fire for old notifications
    _lastSeen = Date.now();

    // Listen for new notification docs in Firestore
    _unsubscribe?.();
    _unsubscribe = FirebaseService.onSnapshot('notifications', (docs) => {
      docs
        .filter(d => d.createdAt > _lastSeen)
        .sort((a, b) => a.createdAt - b.createdAt)
        .forEach(d => {
          _show(d.title, d.body, d.iconUrl);
          _lastSeen = Math.max(_lastSeen, d.createdAt);
        });
    });
  }

  // ── Show a browser notification ───────────────────────────
  function _show(title, body, icon) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const n = new Notification(title || 'Zafer Partisi', {
        body:  body  || '',
        icon:  icon  || 'assets/icons/icon-192.png',
        badge: 'assets/icons/icon-72.png',
        tag:   'zafer-partisi-' + Date.now(),
        renotify: true
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (err) {
      // ServiceWorker registration required on some browsers for Notification API
      _showSW(title, body, icon);
    }
  }

  // Fallback: show via service worker if available
  async function _showSW(title, body, icon) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title || 'Zafer Partisi', {
        body:  body || '',
        icon:  icon || 'assets/icons/icon-192.png',
        badge: 'assets/icons/icon-72.png'
      });
    } catch {}
  }

  // ── Admin: send notification to all ──────────────────────
  async function sendToAll(title, body) {
    if (!Auth.isAdmin()) return;
    await FirebaseService.sendNotification({
      title,
      body,
      iconUrl: 'assets/icons/icon-192.png'
    });
  }

  // ── Cleanup ───────────────────────────────────────────────
  function destroy() {
    _unsubscribe?.();
    _unsubscribe = null;
  }

  return { init, sendToAll, destroy };
})();
