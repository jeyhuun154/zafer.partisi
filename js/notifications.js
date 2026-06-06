/* ============================================================
   Notifications — In-app notification center + Browser API
   Features:
     • In-app panel accessible from Settings (registered users only)
     • Real-time Firestore listener for broadcast notifications
     • Super Admin: actionable approval requests inside the center
     • Standard users: events, announcements, deletion outcomes
     • Unread badge on the bell icon in Settings
   ============================================================ */

const Notifications = (() => {
  let _unsubscribe        = null;
  let _actionsUnsub       = null;
  let _lastSeen           = 0;
  let _inboxItems         = [];   // local cache of all notification docs
  let _pendingActionItems = [];   // local cache of pending actions (super admin only)
  let _unreadCount        = 0;

  function _absIcon() {
    try { return new URL('/assets/icons/icon-192.png', window.location.href).href; }
    catch { return '/assets/icons/icon-192.png'; }
  }

  // ── Init ─────────────────────────────────────────────────
  async function init(userId) {
    if (!userId || userId === 'guest') return;

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    // FCM token (best-effort)
    try {
      const token = await FirebaseService.getFCMToken();
      if (token) await FirebaseService.saveFCMToken(userId, token);
    } catch {}

    // Load unread pointer from IDB
    const savedLastSeen = await DB.getSetting('notif_last_seen_' + userId, 0);
    _lastSeen = savedLastSeen || Date.now();

    // Listen for broadcast notifications
    _unsubscribe?.();
    _unsubscribe = FirebaseService.onSnapshot('notifications', (docs) => {
      _inboxItems = docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      _recalcUnread();
      _renderPanel();
      // Show browser popup for truly new ones
      docs
        .filter(d => d.createdAt > _lastSeen)
        .sort((a, b) => a.createdAt - b.createdAt)
        .forEach(d => { _showBrowserNotif(d.title, d.body, d.iconUrl); });
    });

    // Super admin: also listen to pending actions
    if (Auth.isSuperAdmin()) {
      _actionsUnsub?.();
      _actionsUnsub = FirebaseService.onSnapshot('pendingActions', (docs) => {
        _pendingActionItems = docs
          .filter(d => d.status === 'pending')
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        _recalcUnread();
        _renderPanel();
      });
    }
  }

  // ── Unread logic ─────────────────────────────────────────
  function _recalcUnread() {
    const notifUnread = _inboxItems.filter(d => d.createdAt > _lastSeen).length;
    const actionUnread = Auth.isSuperAdmin() ? _pendingActionItems.length : 0;
    _unreadCount = notifUnread + actionUnread;
    _updateBadge();
  }

  function _updateBadge() {
    const badge = document.getElementById('notif-bell-badge');
    if (!badge) return;
    if (_unreadCount > 0) {
      badge.textContent = _unreadCount > 9 ? '9+' : String(_unreadCount);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // Mark all as seen (called when panel is opened)
  async function markAllSeen() {
    const userId = Auth.getUser()?.id;
    if (!userId) return;
    _lastSeen = Date.now();
    await DB.setSetting('notif_last_seen_' + userId, _lastSeen);
    _unreadCount = Auth.isSuperAdmin() ? _pendingActionItems.length : 0;
    _updateBadge();
  }

  // ── Panel open/close ─────────────────────────────────────
  function openPanel() {
    const panel = document.getElementById('modal-notif-center');
    if (!panel) return;
    markAllSeen();
    _renderPanel();
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('modal-overlay--open');
  }

  function closePanel() {
    const panel = document.getElementById('modal-notif-center');
    if (!panel) return;
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('modal-overlay--open');
  }

  // ── Render panel contents ─────────────────────────────────
  function _renderPanel() {
    const container = document.getElementById('notif-center-list');
    if (!container) return;

    const isSuperAdmin = Auth.isSuperAdmin();
    let html = '';

    // ── Pending action requests (super admin only) ────────
    if (isSuperAdmin && _pendingActionItems.length > 0) {
      html += `<div class="notif-section-label">Onay Bekleyen İstekler</div>`;
      _pendingActionItems.forEach(action => {
        const typeLabel = action.type === 'delete'
          ? `<strong>${_esc(action.targetUserName)}</strong> silinmek istiyor`
          : `<strong>${_esc(action.targetUserName)}</strong> admin yapılmak isteniyor`;
        const icon = action.type === 'delete' ? '🗑️' : '⭐';
        html += `
          <div class="notif-item notif-item--action" data-action-id="${action.id}">
            <div class="notif-item__icon">${icon}</div>
            <div class="notif-item__body">
              <p class="notif-item__title">${typeLabel}</p>
              <p class="notif-item__meta">Talep eden: ${_esc(action.requesterName)} · ${_formatTime(action.createdAt)}</p>
              <div class="notif-item__actions">
                <button class="notif-action-btn notif-action-btn--approve" data-action-id="${action.id}">✓ Onayla</button>
                <button class="notif-action-btn notif-action-btn--reject" data-action-id="${action.id}">✕ Reddet</button>
              </div>
            </div>
          </div>`;
      });
    }

    // ── Broadcast notifications ────────────────────────────
    if (_inboxItems.length > 0) {
      if (isSuperAdmin && _pendingActionItems.length > 0) {
        html += `<div class="notif-section-label" style="margin-top:16px">Bildirimler</div>`;
      }
      _inboxItems.forEach(notif => {
        const isNew = notif.createdAt > (_lastSeen - 5000); // small buffer
        html += `
          <div class="notif-item${isNew ? ' notif-item--new' : ''}">
            <div class="notif-item__icon">🔔</div>
            <div class="notif-item__body">
              <p class="notif-item__title">${_esc(notif.title || '')}</p>
              ${notif.body ? `<p class="notif-item__desc">${_esc(notif.body)}</p>` : ''}
              <p class="notif-item__meta">${_formatTime(notif.createdAt)}</p>
            </div>
          </div>`;
      });
    }

    if (!html) {
      html = `<div class="notif-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:0.3;margin-bottom:8px">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <p>Henüz bildirim yok</p>
      </div>`;
    }

    container.innerHTML = html;

    // Bind approve/reject buttons
    container.querySelectorAll('.notif-action-btn--approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const actionId = btn.dataset.actionId;
        btn.disabled = true; btn.textContent = '...';
        const r = await Auth.approveAction(actionId);
        if (r.success) {
          _pendingActionItems = _pendingActionItems.filter(a => a.id !== actionId);
          _renderPanel();
          _recalcUnread();
          _showToastGlobal('İşlem onaylandı ✓');
        } else {
          alert(r.error);
          btn.disabled = false; btn.textContent = '✓ Onayla';
        }
      });
    });

    container.querySelectorAll('.notif-action-btn--reject').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const actionId = btn.dataset.actionId;
        btn.disabled = true; btn.textContent = '...';
        const r = await Auth.rejectAction(actionId);
        if (r.success) {
          _pendingActionItems = _pendingActionItems.filter(a => a.id !== actionId);
          _renderPanel();
          _recalcUnread();
          _showToastGlobal('İşlem reddedildi');
        } else {
          alert(r.error);
          btn.disabled = false; btn.textContent = '✕ Reddet';
        }
      });
    });
  }

  // ── Browser notification ──────────────────────────────────
  function _showBrowserNotif(title, body, icon) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const iconUrl = (icon && icon.startsWith('http')) ? icon : _absIcon();
    try {
      const n = new Notification(title || 'Zafer Partisi', {
        body, icon: iconUrl, badge: _absIcon(),
        tag: 'zp-' + Date.now(), renotify: true
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {
      _showViaSW(title, body, iconUrl);
    }
  }

  async function _showViaSW(title, body, icon) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title || 'Zafer Partisi', { body: body || '', icon, badge: _absIcon() });
    } catch {}
  }

  // ── Send to all (admin) ───────────────────────────────────
  async function sendToAll(title, body) {
    if (!Auth.isAdmin()) return;
    await FirebaseService.sendNotification({ title, body, iconUrl: _absIcon() });
  }

  // ── Helpers ───────────────────────────────────────────────
  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Az önce';
    if (diffMin < 60) return `${diffMin} dakika önce`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} saat önce`;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function _showToastGlobal(msg) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.cssText = [
        'position:fixed','bottom:100px','left:50%','transform:translateX(-50%)',
        'background:var(--color-text)','color:var(--color-bg)','padding:10px 18px',
        'border-radius:20px','font-size:13px','font-weight:500','white-space:nowrap',
        'z-index:9999','transition:opacity 0.3s ease','pointer-events:none'
      ].join(';');
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  }

  function destroy() {
    _unsubscribe?.();
    _actionsUnsub?.();
    _unsubscribe = null;
    _actionsUnsub = null;
    _inboxItems = [];
    _pendingActionItems = [];
    _unreadCount = 0;
  }

  return { init, openPanel, closePanel, sendToAll, markAllSeen, destroy };
})();
