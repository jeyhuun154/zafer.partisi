/* ============================================================
   Notifications — in-app via Firestore listener + Browser API
   ============================================================ */

const Notifications = (() => {
  let _unsubscribe = null;
  let _lastSeen    = 0;

  function _absIcon() {
    try { return new URL('/assets/icons/icon-192.png', window.location.href).href; }
    catch { return '/assets/icons/icon-192.png'; }
  }

  async function init(userId) {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    // FCM token (best effort)
    try {
      const token = await FirebaseService.getFCMToken();
      if (token) await FirebaseService.saveFCMToken(userId, token);
    } catch {}

    _lastSeen = Date.now();

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

  function _show(title, body, icon) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    // Always use absolute URL for icon so Chrome shows the logo not a placeholder
    const iconUrl = (icon && icon.startsWith('http')) ? icon : _absIcon();
    try {
      const n = new Notification(title || 'Zafer Partisi', {
        body:  body  || '',
        icon:  iconUrl,
        badge: _absIcon(),
        tag:   'zp-' + Date.now(),
        renotify: true
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {
      _showViaSW(title, body, iconUrl);
    }
  }

  async function _showViaSW(title, body, icon) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title || 'Zafer Partisi', { body: body||'', icon, badge: _absIcon() });
    } catch {}
  }

  async function sendToAll(title, body) {
    if (!Auth.isAdmin()) return;
    await FirebaseService.sendNotification({ title, body, iconUrl: _absIcon() });
  }

  function destroy() { _unsubscribe?.(); _unsubscribe = null; }

  return { init, sendToAll, destroy };
})();
