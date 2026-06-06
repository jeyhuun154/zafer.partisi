/* ============================================================
   App — Main orchestrator v3
   ============================================================ */

(async () => {

  // Update page title
  document.title = 'Zafer Partisi - Darıca';

  Sync.registerSW();
  try { await DB.init(); } catch (e) { console.error('[App] DB:', e); }
  await UI.loadTheme();
  // Load saved wallpaper before anything renders
  try {
    if (typeof WallpaperManager !== 'undefined') await WallpaperManager.loadSaved();
  } catch (e) { console.warn('[App] WallpaperManager.loadSaved:', e); }
  try { await FirebaseService.init(); } catch (e) { console.error('[App] Firebase:', e); }

  UI.init();
  UI.bindPasswordToggle();
  try {
    if (typeof WallpaperManager !== 'undefined') WallpaperManager.bindAdminControls();
  } catch {}
  UI.bindPhotoUpload();
  _bindScheduleSelects();

  // ── Splash → route ───────────────────────────────────────
  UI.playSplash(async () => {
    const user = await Auth.init();
    if (user) {
      _showHome();
      _showWelcomePopupsIfNeeded();
      if (!Auth.isGuest()) Notifications.init(user.id).catch(() => {});
    } else {
      UI.showScreen('screen-login');
    }
    Sync.initConnectivityListeners();
  });

  // ════════════════════════════════════════════════════════
  // LOGIN
  // ════════════════════════════════════════════════════════
  document.getElementById('login-btn')?.addEventListener('click', _handleLogin);
  document.getElementById('guest-btn')?.addEventListener('click', async () => {
    await Auth.loginAsGuest();
    _showHome();
    _showWelcomePopupsIfNeeded();
  });
  document.getElementById('go-register-btn')?.addEventListener('click', () => UI.showScreen('screen-register'));

  ['login-first-name','login-last-name','login-code'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') _handleLogin(); });
  });

  async function _handleLogin() {
    const firstName = document.getElementById('login-first-name').value;
    const lastName  = document.getElementById('login-last-name').value;
    const code      = document.getElementById('login-code').value;
    const errorEl   = document.getElementById('login-error');
    const btn       = document.getElementById('login-btn');
    const labelEl   = btn?.querySelector('.btn__label');
    const spinnerEl = btn?.querySelector('.btn__spinner');
    if (errorEl) errorEl.textContent = '';
    if (labelEl) labelEl.textContent = 'Giriş yapılıyor...';
    if (spinnerEl) spinnerEl.removeAttribute('hidden');
    if (btn) btn.disabled = true;
    try {
      const r = await Auth.login(firstName, lastName, code);
      if (r.success) {
        _showHome();
        _showWelcomePopupsIfNeeded();
        Notifications.init(r.user.id).catch(() => {});
      } else {
        if (errorEl) errorEl.textContent = r.error;
        UI.shakeLoginForm();
      }
    } catch { if (errorEl) errorEl.textContent = 'Bir hata oluştu.'; }
    finally {
      if (labelEl) labelEl.textContent = 'Giriş Yap';
      if (spinnerEl) spinnerEl.setAttribute('hidden', '');
      if (btn) btn.disabled = false;
    }
  }

  // ════════════════════════════════════════════════════════
  // REGISTER
  // ════════════════════════════════════════════════════════
  document.getElementById('reg-submit-btn')?.addEventListener('click', async () => {
    const kvkkChecked = document.getElementById('reg-kvkk')?.checked;
    const kvkkError = document.getElementById('kvkk-error');
    if (!kvkkChecked) {
      if (kvkkError) kvkkError.textContent = 'KVKK Aydınlatma Metni\'ni onaylamadan kayıt olamazsınız.';
      return;
    }
    if (kvkkError) kvkkError.textContent = '';

    const data = {
      firstName:  document.getElementById('reg-first-name')?.value || '',
      lastName:   document.getElementById('reg-last-name')?.value  || '',
      birthDate:  document.getElementById('reg-birthdate')?.value  || '',
      gender:     document.getElementById('reg-gender')?.value     || '',
      profession: document.getElementById('reg-profession')?.value || '',
      bloodType:  document.getElementById('reg-blood')?.value      || null,
      code:       document.getElementById('reg-code')?.value       || ''
    };
    const errorEl = document.getElementById('reg-error');
    const btn = document.getElementById('reg-submit-btn');
    if (errorEl) errorEl.textContent = '';
    btn.disabled = true; btn.textContent = 'Kaydediliyor...';
    try {
      const r = await Auth.register(data);
      if (r.success) {
        _showHome();
        _showWelcomePopupsIfNeeded();
        Notifications.init(r.user.id).catch(() => {});
      } else {
        if (errorEl) errorEl.textContent = r.error;
      }
    } catch (e) {
      console.error('[App] Register error:', e);
      if (errorEl) errorEl.textContent = 'Kayıt sırasında hata oluştu: ' + (e.message || '');
    } finally {
      btn.disabled = false; btn.textContent = 'Kayıt Ol';
    }
  });

  document.getElementById('reg-back-btn')?.addEventListener('click', () => UI.showScreen('screen-login', 'back'));

  // ════════════════════════════════════════════════════════
  // HOME
  // ════════════════════════════════════════════════════════
  function _showHome() {
    UI.showScreen('screen-home');
    _updateHomeUI();
    _loadEventsBadge();
    _applySocialLinks();
    setTimeout(() => _checkPendingActions(), 2000);
  }

  function _applySocialLinks() {
    const links = APP_CONFIG?.socialLinks || {};
    const ig = document.getElementById('social-instagram');
    const tw = document.getElementById('social-twitter');
    const zp = document.getElementById('social-party');

    // Instagram
    if (ig) {
      ig.href   = links.instagram || 'https://www.instagram.com/zpgenclikdarica/';
      ig.target = '_blank';
      ig.rel    = 'noopener noreferrer';
    }
    // X / Twitter
    if (tw) {
      tw.href   = links.twitter || 'https://x.com/zaferpartisidarica';
      tw.target = '_blank';
      tw.rel    = 'noopener noreferrer';
    }
    // Zafer Partisi
    if (zp) {
      zp.href   = links.zaferPartisi || 'https://www.zaferpartisi.org.tr/';
      zp.target = '_blank';
      zp.rel    = 'noopener noreferrer';
    }
  }

  function _updateHomeUI() {
    const isAdmin = Auth.isAdmin();
    const isGuest = Auth.isGuest();

    // Members tile: locked for non-admin
    const membersTile = document.getElementById('main-action-btn');
    if (membersTile) {
      membersTile.classList.toggle('home-tile--locked', !isAdmin);
      // Add/remove lock icon
      let lockIcon = membersTile.querySelector('.home-tile__lock-icon');
      if (!isAdmin) {
        if (!lockIcon) {
          lockIcon = document.createElement('span');
          lockIcon.className = 'home-tile__lock-icon';
          lockIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>`;
          membersTile.appendChild(lockIcon);
        }
      } else {
        lockIcon?.remove();
      }
    }

    // Guest: show register button in header, update settings
    const headerRegBtn = document.getElementById('header-register-btn');
    const user = Auth.getUser();
    if (isGuest) {
      if (headerRegBtn) {
        headerRegBtn.textContent = 'Kayıt Ol';
        headerRegBtn.style.cssText = '';
        headerRegBtn.style.pointerEvents = 'auto';
        headerRegBtn.classList.remove('hidden');
      }
    } else if (user && !isGuest) {
      if (headerRegBtn) {
        headerRegBtn.textContent = `Hoş geldin, ${user.firstName}`;
        headerRegBtn.style.background = 'transparent';
        headerRegBtn.style.color = 'var(--color-text-secondary)';
        headerRegBtn.style.fontSize = '13px';
        headerRegBtn.style.pointerEvents = 'none';
        headerRegBtn.style.boxShadow = 'none';
        headerRegBtn.classList.remove('hidden');
      }
    } else {
      if (headerRegBtn) headerRegBtn.classList.add('hidden');
    }

    // Settings: show/hide logout & admin section
    const adminSection = document.getElementById('admin-section');
    if (adminSection) adminSection.classList.toggle('hidden', !isAdmin);

    // Notification center: show for registered (non-guest) users
    const notifSection = document.getElementById('notif-settings-section');
    if (notifSection) notifSection.classList.toggle('hidden', isGuest);

    // Dedicated bell button in header — show for registered users only
    const bellBtn = document.getElementById('notif-bell-btn');
    if (bellBtn) {
      bellBtn.classList.toggle('hidden', isGuest);

      // Ensure badge lives INSIDE the bell button (not on settings)
      // Remove any badge that's floating outside the bell
      let badge = document.getElementById('notif-bell-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'notif-bell-badge';
        badge.className = 'notif-bell-badge hidden';
        badge.style.cssText = [
          'position:absolute', 'top:-4px', 'right:-4px',
          'min-width:16px', 'height:16px', 'padding:0 4px',
          'border-radius:8px', 'background:#FF3B30', 'color:#fff',
          'font-size:10px', 'font-weight:700', 'line-height:16px',
          'display:flex', 'align-items:center', 'justify-content:center',
          'pointer-events:none'
        ].join(';');
        // Ensure the bell btn is position:relative for proper badge placement
        bellBtn.style.position = 'relative';
        bellBtn.appendChild(badge);
      }

      // Move bell button below settings button in header if not already done
      _ensureBellBelowSettings();
    }
  }

  function _ensureBellBelowSettings() {
    const bellBtn = document.getElementById('notif-bell-btn');
    const settingsBtn = document.getElementById('settings-btn') || document.getElementById('settings-btn-home');
    if (!bellBtn || !settingsBtn) return;
    // Check if they're siblings in the same parent — if so, ensure bell comes after settings
    if (bellBtn.parentElement === settingsBtn.parentElement) {
      const parent = bellBtn.parentElement;
      // If bell is before settings or directly beside (same row), restructure
      const children = Array.from(parent.children);
      const settingsIdx = children.indexOf(settingsBtn);
      const bellIdx = children.indexOf(bellBtn);
      // Already correct vertical ordering — only restructure if needed
      if (bellIdx < settingsIdx) {
        // Move bell after settings
        settingsBtn.insertAdjacentElement('afterend', bellBtn);
      }
      // Ensure parent displays them vertically
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.flexDirection === 'row' || parentStyle.display === 'flex') {
        parent.style.flexDirection = 'column';
        parent.style.alignItems = 'flex-end';
        parent.style.gap = '8px';
      }
    }
  }

  // Members tile click — locked for non-admin
  document.getElementById('main-action-btn')?.addEventListener('click', async () => {
    if (!Auth.isAdmin()) {
      // Show lock message
      _showToast('Bu bölüm sadece adminlere özeldir 🔒');
      return;
    }
    UI.showScreen('screen-people');
    await People.load();
    People.updateAdminUI();
  });

  document.getElementById('map-btn')?.addEventListener('click', () => { UI.showScreen('screen-map'); _initMap(); });
  document.getElementById('events-btn')?.addEventListener('click', async () => {
    UI.showScreen('screen-events');
    await _loadEvents();
    _updateEventAdminUI();
  });

  // Header register button (visible for guests)
  document.getElementById('header-register-btn')?.addEventListener('click', () => UI.showScreen('screen-register'));

  function _showToast(msg) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.cssText = [
        'position:fixed', 'bottom:100px', 'left:50%', 'transform:translateX(-50%)',
        'background:var(--color-text)', 'color:var(--color-bg)', 'padding:10px 18px',
        'border-radius:20px', 'font-size:13px', 'font-weight:500', 'white-space:nowrap',
        'z-index:9999', 'transition:opacity 0.3s ease', 'pointer-events:none'
      ].join(';');
      document.getElementById('app-shell').appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  }

  // ════════════════════════════════════════════════════════
  // WELCOME POPUPS
  // ════════════════════════════════════════════════════════
  async function _showWelcomePopupsIfNeeded() {
    const isGuest = Auth.isGuest();
    const userId  = Auth.getUser()?.id;
    const KEY     = userId ? `popup_count_${userId}` : 'popup_count_guest';
    const MAX     = 5;

    let count = 0;
    if (!isGuest && userId) {
      count = (await DB.getSetting(KEY, 0)) || 0;
      if (count >= MAX) {
        setTimeout(() => _showStoriesIfNeeded(), 600);
        return;
      }
      await DB.setSetting(KEY, count + 1);
    }
    // Each popup stays ~3s; delay stories until all popups have had time to display
    const popupCount = (APP_CONFIG?.popups || []).length;
    const storiesDelay = 500 + popupCount * 3200;
    setTimeout(() => UI.showWelcomePopups(), 500);
    setTimeout(() => _showStoriesIfNeeded(), storiesDelay);
  }

  async function _showStoriesIfNeeded() {
    const isGuest = Auth.isGuest();
    const userId  = Auth.getUser()?.id;
    const STORY_KEY = userId ? `stories_shown_${userId}` : null;

    if (!isGuest && STORY_KEY) {
      // Registered users: show only once ever
      const shown = await DB.getSetting(STORY_KEY, false);
      if (shown) return;
      await DB.setSetting(STORY_KEY, true);
    }
    // Guests: show every time (no check needed)
    let events = [];
    try { events = await FirebaseService.getDocs('events'); } catch {}
    if (events.length > 0) {
      setTimeout(() => UI.openStories(events), 500);
    }
  }

  // ════════════════════════════════════════════════════════
  // SETTINGS
  // ════════════════════════════════════════════════════════
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const label = Auth.isGuest() ? 'Misafir oturumunu sonlandırmak istiyor musunuz?' : 'Çıkış yapmak istediğinize emin misiniz?';
    if (!confirm(label)) return;
    Notifications.destroy();
    await Auth.logout();
    UI.closeSettings();
    ['login-first-name','login-last-name','login-code'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.textContent = '';
    UI.showScreen('screen-login', 'back');
  });

  document.getElementById('send-notif-settings-btn')?.addEventListener('click', () => {
    UI.closeSettings(); setTimeout(() => UI.openNotifyModal(), 200);
  });

  // Notification Center — settings entry (kept for back-compat)
  document.getElementById('open-notif-center-btn')?.addEventListener('click', () => {
    UI.closeSettings();
    setTimeout(() => Notifications.openPanel(), 200);
  });
  // Dedicated bell icon in home header
  document.getElementById('notif-bell-btn')?.addEventListener('click', () => {
    Notifications.openPanel();
  });
  document.getElementById('close-notif-center-btn')?.addEventListener('click', () => Notifications.closePanel());
  document.getElementById('modal-notif-center')?.addEventListener('click', e => {
    if (e.target.id === 'modal-notif-center') Notifications.closePanel();
  });

  document.getElementById('send-notify-btn')?.addEventListener('click', async () => {
    const title = document.getElementById('notify-title-input')?.value.trim();
    const body  = document.getElementById('notify-body-input')?.value.trim();
    if (!title) { alert('Başlık zorunludur.'); return; }
    const btn = document.getElementById('send-notify-btn');
    btn.disabled = true; btn.textContent = 'Gönderiliyor...';
    await Notifications.sendToAll(title, body);
    btn.disabled = false; btn.textContent = 'Tüm Kullanıcılara Gönder';
    UI.closeNotifyModal();
    _showToast('Bildirim gönderildi ✓');
  });

  document.getElementById('cancel-notify-btn')?.addEventListener('click', () => UI.closeNotifyModal());
  document.getElementById('modal-notify')?.addEventListener('click', e => { if (e.target.id === 'modal-notify') UI.closeNotifyModal(); });

  // ════════════════════════════════════════════════════════
  // PEOPLE SCREEN
  // ════════════════════════════════════════════════════════
  document.getElementById('back-btn')?.addEventListener('click', () => { People.destroy(); UI.showScreen('screen-home', 'back'); });

  const searchInput = document.getElementById('people-search');
  const clearBtn    = document.getElementById('clear-search-btn');
  searchInput?.addEventListener('input', e => {
    clearBtn?.classList.toggle('hidden', !e.target.value);
    People.search(e.target.value);
  });
  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn.classList.add('hidden');
    People.search('');
    searchInput?.focus();
  });

  document.getElementById('prev-page-btn')?.addEventListener('click', () => People.prevPage());
  document.getElementById('next-page-btn')?.addEventListener('click', () => People.nextPage());
  document.getElementById('add-person-btn')?.addEventListener('click', () => UI.openPersonModal(null));

  document.getElementById('save-person-btn')?.addEventListener('click', async () => {
    const modal  = document.getElementById('modal-person');
    const editId = modal?.dataset.editId || null;
    const data   = UI.getPersonFormData();
    const btn    = document.getElementById('save-person-btn');
    btn.disabled = true; btn.textContent = 'Kaydediliyor...';
    try {
      const r = await People.savePerson(data, editId);
      if (r.success) UI.closePersonModal();
      else alert(r.error);
    } catch (e) {
      console.error('[App] savePerson:', e);
      alert('Kayıt sırasında hata: ' + (e.message || ''));
    } finally { btn.disabled = false; btn.textContent = 'Kaydet'; }
  });

  document.getElementById('cancel-person-btn')?.addEventListener('click', () => UI.closePersonModal());
  document.getElementById('modal-person')?.addEventListener('click', e => { if (e.target.id === 'modal-person') UI.closePersonModal(); });

  // See More
  document.getElementById('close-see-more-btn')?.addEventListener('click', () => UI.closeSeeMoreModal());
  document.getElementById('modal-see-more')?.addEventListener('click', e => { if (e.target.id === 'modal-see-more') UI.closeSeeMoreModal(); });
  document.getElementById('see-more-save-notes-btn')?.addEventListener('click', async () => {
    const person = UI.getSeeMorePerson();
    if (!person) return;
    const notes = document.getElementById('see-more-notes-input')?.value.trim() || '';
    const btn = document.getElementById('see-more-save-notes-btn');
    btn.disabled = true; btn.textContent = 'Kaydediliyor...';
    await People.savePerson({ ...person, notes }, person.id);
    btn.disabled = false; btn.textContent = 'Notları Kaydet';
    UI.closeSeeMoreModal();
  });

  // ════════════════════════════════════════════════════════
  // MAP SCREEN
  // ════════════════════════════════════════════════════════
  let _map = null, _mapInitialized = false, _pinMarkers = {}, _pinsUnsub = null;

  document.getElementById('map-back-btn')?.addEventListener('click', () => UI.showScreen('screen-home', 'back'));
  document.getElementById('settings-btn-3')?.addEventListener('click', () => UI.openSettings());

  function _initMap() {
    if (_mapInitialized) { setTimeout(() => _map?.invalidateSize(), 400); return; }
    if (typeof L === 'undefined') { setTimeout(_initMap, 500); return; }

    _map = L.map('leaflet-map', {
      center: [40.748, 29.570], // Darıca merkezi
      zoom: 13, minZoom: 10, maxZoom: 19
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(_map);
    _mapInitialized = true;
    setTimeout(() => _map.invalidateSize(), 400);

    // Load Darıca boundary overlay
    _loadDaricaOverlay();

    if (Auth.isAdmin()) {
      // Normal click → action menu (only when NOT in draw mode)
      _map.on('click', e => {
        if (!_drawMode) UI.showMapActionModal(e.latlng);
      });
      _addDrawToolbar();
    }
    _loadMapPins();
  }

  // ── Darıca overlay ─────────────────────────────────────────
  let _daricaOverlay = null;
  let _daricaBorder  = null;

  async function _loadDaricaOverlay() {
    let boundary = APP_CONFIG?.daricaBoundary || [];
    try {
      const saved = await FirebaseService.getDoc('settings', 'daricaBoundary');
      if (saved?.coords?.length >= 3) boundary = saved.coords;
    } catch {}
    if (boundary.length >= 3) {
      _applyDaricaOverlay(boundary);
      try {
        if (_daricaBorder) {
          _map.fitBounds(_daricaBorder.getBounds(), { padding: [30, 30], maxZoom: 15 });
        }
      } catch {}
    }
  }

  function _applyDaricaOverlay(boundary) {
    if (!_map || !boundary?.length) return;
    _daricaOverlay?.remove();
    _daricaBorder?.remove();

    if (!_map.getPane('dimPane')) {
      _map.createPane('dimPane');
      _map.getPane('dimPane').style.zIndex = 350;
      _map.getPane('dimPane').style.pointerEvents = 'none';
    }

    // Dim the world outside Darıca
    _daricaOverlay = L.polygon(
      [ [[-90,-180],[-90,180],[90,180],[90,-180]], boundary ],
      { stroke: false, fillColor: '#000', fillOpacity: 0.35,
        interactive: false, pane: 'dimPane' }
    ).addTo(_map);

    // Solid colored border + subtle fill for Darıca area
    _daricaBorder = L.polygon(boundary, {
      color: '#1B2E6E', weight: 3, opacity: 0.85,
      fillColor: '#1B2E6E', fillOpacity: 0.06,
      dashArray: '8 4', interactive: false, pane: 'dimPane'
    }).addTo(_map);
  }

  // ── Paint-style draw toolbar ───────────────────────────────
  let _drawMode    = false;
  let _drawPoints  = [];
  let _drawPreview = null;
  let _isPainting  = false;

  function _addDrawToolbar() {
    const ctrl = L.control({ position: 'topright' });
    ctrl.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      div.innerHTML = `<a id="draw-boundary-btn" href="#" title="Darıca Sınırı Çiz"
        style="display:flex;align-items:center;justify-content:center;
               width:30px;height:30px;font-size:16px;text-decoration:none;
               background:var(--color-surface,#fff)" role="button">✏️</a>`;
      L.DomEvent.disableClickPropagation(div);
      div.querySelector('#draw-boundary-btn').onclick = e => {
        e.preventDefault();
        if (_drawMode) _finishDraw(); else _startDraw();
      };
      return div;
    };
    ctrl.addTo(_map);
  }

  function _startDraw() {
    _drawMode = true; _drawPoints = []; _isPainting = false;
    _drawPreview?.remove(); _drawPreview = null;
    _map.dragging.disable();
    _map.getContainer().style.cursor = 'crosshair';
    _showToast('Parmağınızı sürükleyerek Darıca sınırını çizin. Bitince ✅ butonuna basın.');
    document.getElementById('draw-boundary-btn').textContent = '✅';

    _map.on('mousedown touchstart', _onPaintStart);
    _map.on('mousemove',            _onPaintMove);
    _map.on('mouseup touchend',     _onPaintStop);
    // Touch move — Leaflet doesn't expose latlng on touchmove so we handle raw
    _map.getContainer().addEventListener('touchmove', _onTouchPaint, { passive: false });
  }

  function _onPaintStart()  { _isPainting = true; }
  function _onPaintStop()   { _isPainting = false; }
  function _onPaintMove(e)  {
    if (!_isPainting) return;
    _drawPoints.push([e.latlng.lat, e.latlng.lng]);
    _refreshPreview();
  }
  function _onTouchPaint(e) {
    if (!_isPainting || !e.touches[0]) return;
    e.preventDefault();
    const t = e.touches[0];
    const rect = _map.getContainer().getBoundingClientRect();
    const pt = L.point(t.clientX - rect.left, t.clientY - rect.top);
    const ll = _map.containerPointToLatLng(pt);
    _drawPoints.push([ll.lat, ll.lng]);
    _refreshPreview();
  }

  function _refreshPreview() {
    _drawPreview?.remove();
    if (_drawPoints.length < 2) return;
    _drawPreview = L.polygon(_drawPoints, {
      color: '#FF9500', weight: 2.5, dashArray: '6 4',
      fillOpacity: 0.06, interactive: false
    }).addTo(_map);
  }

  async function _finishDraw() {
    _drawMode = false; _isPainting = false;
    _map.off('mousedown touchstart', _onPaintStart);
    _map.off('mousemove',            _onPaintMove);
    _map.off('mouseup touchend',     _onPaintStop);
    _map.getContainer().removeEventListener('touchmove', _onTouchPaint);
    _map.dragging.enable();
    _map.getContainer().style.cursor = '';
    _drawPreview?.remove(); _drawPreview = null;
    const btn = document.getElementById('draw-boundary-btn');
    if (btn) btn.textContent = '✏️';

    if (_drawPoints.length < 10) {
      _showToast('Yeterli nokta yok. Parmağınızı sürükleyerek çizin.');
      return;
    }
    const closed = [..._drawPoints, _drawPoints[0]];
    try {
      await FirebaseService.setDoc('settings', 'daricaBoundary', { coords: closed });
    } catch (e) {
      console.error('[Map] Firebase save failed:', e);
      _showToast('Sınır kaydedilemedi. Firebase bağlantısını kontrol edin.');
      return;
    }
    _applyDaricaOverlay(closed);
    if (_daricaBorder) {
      try {
        _map.fitBounds(_daricaBorder.getBounds(), { padding: [30, 30], maxZoom: 15 });
      } catch {}
    }
    _showToast('Darıca sınırı kaydedildi ✓');
  }

  function _loadMapPins() {
    _pinsUnsub?.();
    _pinsUnsub = FirebaseService.onSnapshot('mapPins', docs => {
      const now = Date.now();
      Object.values(_pinMarkers).forEach(m => _map?.removeLayer(m));
      _pinMarkers = {};
      docs.filter(pin => {
        if (pin.deleteAt && pin.deleteAt < now) return false;
        if (pin.publishAt && pin.publishAt > now && !Auth.isAdmin()) return false;
        return true;
      }).forEach(pin => {
        const ic = (APP_CONFIG?.mapIcons || []).find(i => i.id === pin.iconId) || { emoji: '📍' };
        const icon = L.divIcon({
          className: '',
          html: `<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">${ic.emoji}</div>`,
          iconSize: [36, 36], iconAnchor: [18, 36]
        });
        const marker = L.marker([pin.lat, pin.lng], { icon });
        let popup = `<b>${pin.title}</b>`;
        if (pin.desc) popup += `<br><small>${pin.desc}</small>`;
        if (pin.publishAt && pin.publishAt > now) popup += `<br><small style="color:orange">⏰ Planlandı</small>`;

        popup += `<div class="pin-popup-actions">`;
        // Google Maps primary
        popup += `<a href="https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}" target="_blank" rel="noopener" class="pin-popup-btn pin-popup-btn--navigate">Git</a>`;
        // If this pin is linked to an event, show "Etkinlik" button
        if (pin.eventId) {
          popup += `<button onclick="window._openEventFromPin('${pin.eventId}')" class="pin-popup-btn pin-popup-btn--event">Etkinlik</button>`;
        }
        if (Auth.isAdmin()) {
          popup += `<button onclick="window._delPin('${pin.id}')" class="pin-popup-btn pin-popup-btn--delete">Sil</button>`;
        }
        popup += `</div>`;

        marker.bindPopup(popup);
        marker.addTo(_map);
        _pinMarkers[pin.id] = marker;
      });
    });
  }

  window._delPin = async id => {
    if (!confirm('Bu konumu silmek istiyor musunuz?')) return;
    try {
      // If this pin is linked to an event, delete the event too
      const pin = await FirebaseService.getDoc('mapPins', id);
      if (pin?.eventId) {
        await FirebaseService.deleteDoc('events', pin.eventId);
      }
    } catch {}
    await FirebaseService.deleteDoc('mapPins', id);
  };

  window._openEventFromPin = async eventId => {
    try {
      const ev = await FirebaseService.getDoc('events', eventId);
      if (ev) UI.openEventDetail(ev);
      else _showToast('Etkinlik bulunamadı');
    } catch {
      _showToast('Etkinlik yüklenemedi');
    }
  };

  document.getElementById('map-action-pin-btn')?.addEventListener('click', () => {
    const ll = UI.getPendingLatLng();
    UI.closeMapActionModal();
    setTimeout(() => UI.openMapPinModal(ll), 200);
  });
  document.getElementById('map-action-event-btn')?.addEventListener('click', () => {
    const ll = UI.getPendingLatLng();
    UI.closeMapActionModal();
    setTimeout(() => _openEventModal(null, ll), 200);
  });
  document.getElementById('map-action-cancel-btn')?.addEventListener('click', () => UI.closeMapActionModal());
  document.getElementById('modal-map-action')?.addEventListener('click', e => { if (e.target.id === 'modal-map-action') UI.closeMapActionModal(); });

  document.getElementById('save-pin-btn')?.addEventListener('click', async () => {
    const ll    = UI.getPendingLatLng();
    const title = document.getElementById('pin-title-input')?.value.trim();
    if (!title) { alert('Başlık zorunludur.'); return; }
    if (!ll) { UI.closeMapPinModal(); return; }
    const btn = document.getElementById('save-pin-btn');
    btn.disabled = true; btn.textContent = 'Kaydediliyor...';
    const sched = UI.getPinSchedule();
    const pin = {
      id: CryptoManager.generateId(),
      title, desc: document.getElementById('pin-desc-input')?.value.trim() || '',
      lat: ll.lat, lng: ll.lng,
      iconId:    UI.getSelectedPinIcon(),
      publishAt: sched.publishAt, deleteAt: sched.deleteAt,
      createdAt: Date.now(), authorId: Auth.getUser()?.id
    };
    try {
      await FirebaseService.setDoc('mapPins', pin.id, pin);
      UI.closeMapPinModal();
      _showToast('Konum kaydedildi ✓');
    } catch (e) {
      console.error('[Map] Pin save failed:', e);
      alert('Konum kaydedilemedi: ' + (e.message || 'Firebase bağlantısını kontrol edin.'));
    } finally {
      btn.disabled = false; btn.textContent = 'Kaydet';
    }
  });
  document.getElementById('cancel-pin-btn')?.addEventListener('click', () => UI.closeMapPinModal());
  document.getElementById('modal-map-pin')?.addEventListener('click', e => { if (e.target.id === 'modal-map-pin') UI.closeMapPinModal(); });

  // ════════════════════════════════════════════════════════
  // EVENTS SCREEN
  // ════════════════════════════════════════════════════════
  let _eventsUnsub = null;

  document.getElementById('events-back-btn')?.addEventListener('click', () => {
    _eventsUnsub?.(); UI.showScreen('screen-home', 'back'); _clearEventsBadge();
  });
  document.getElementById('settings-btn-4')?.addEventListener('click', () => UI.openSettings());
  document.getElementById('add-event-fab')?.addEventListener('click', () => _openEventModal(null));

  document.getElementById('save-event-btn')?.addEventListener('click', async () => {
    const modal  = document.getElementById('modal-event');
    const editId = modal?.dataset.editId || null;
    const title  = document.getElementById('event-title-input')?.value.trim();
    const body   = document.getElementById('event-body-input')?.value.trim();
    const date   = document.getElementById('event-date-input')?.value || null;
    if (!title) { alert('Başlık zorunludur.'); return; }
    const btn = document.getElementById('save-event-btn');
    btn.disabled = true; btn.textContent = 'Yayınlanıyor...';
    try {
      let existing = null;
      if (editId) { try { existing = await FirebaseService.getDoc('events', editId); } catch {} }
      const event = {
        id: editId || CryptoManager.generateId(),
        title, body: body || '', date,
        createdAt: existing?.createdAt ?? Date.now(),
        authorId:  Auth.getUser()?.id
      };
      await FirebaseService.setDoc('events', event.id, event);
      // If triggered from map, also add/update a linked pin
      const eLat = parseFloat(modal.dataset.eventLat);
      const eLng = parseFloat(modal.dataset.eventLng);
      if (!isNaN(eLat) && !isNaN(eLng)) {
        let pinId = modal.dataset.eventPinId;
        if (!pinId && editId) {
          try {
            const pins = await FirebaseService.getDocs('mapPins');
            const existingPin = pins.find(p => p.eventId === event.id);
            if (existingPin) pinId = existingPin.id;
          } catch {}
        }
        if (!pinId) pinId = CryptoManager.generateId();
        const pin = {
          id: pinId,
          title, desc: body ? body.substring(0, 60) : '',
          lat: eLat, lng: eLng,
          iconId: 'event', publishAt: Date.now(), deleteAt: null,
          createdAt: existing?.createdAt ?? Date.now(),
          authorId: Auth.getUser()?.id,
          eventId: event.id
        };
        await FirebaseService.setDoc('mapPins', pin.id, pin);
      } else if (editId) {
        try {
          const pins = await FirebaseService.getDocs('mapPins');
          const linked = pins.find(p => p.eventId === event.id);
          if (linked) {
            await FirebaseService.setDoc('mapPins', linked.id, {
              title,
              desc: body ? body.substring(0, 60) : ''
            });
          }
        } catch {}
      }
      _closeEventModal();
      // Only notify after everything succeeded
      try {
        await Notifications.sendToAll(
          editId ? `Etkinlik güncellendi: ${title}` : `Yeni Etkinlik: ${title}`,
          body ? body.substring(0, 100) : ''
        );
      } catch {}
      if (!editId) _incrementEventsBadge();
    } catch (e) {
      console.error('[App] Event save error:', e);
      alert('Hata: ' + (e.message || 'Bilinmeyen hata'));
    }
    finally { btn.disabled = false; btn.textContent = 'Yayınla'; }
  });

  document.getElementById('cancel-event-btn')?.addEventListener('click', _closeEventModal);
  document.getElementById('modal-event')?.addEventListener('click', e => { if (e.target.id === 'modal-event') _closeEventModal(); });

  async function _loadEvents() {
    const listEl  = document.getElementById('events-list');
    const emptyEl = document.getElementById('events-empty');
    if (!listEl) return;
    _eventsUnsub?.();
    _eventsUnsub = FirebaseService.onSnapshot('events', docs => {
      const events = docs.sort((a, b) => (b.createdAt||0) - (a.createdAt||0));
      if (!events.length) {
        listEl.innerHTML = '';
        if (emptyEl) { emptyEl.classList.remove('hidden'); listEl.appendChild(emptyEl); }
        return;
      }
      emptyEl?.classList.add('hidden');
      listEl.innerHTML = events.map(ev => {
        const isAdmin = Auth.isAdmin();
        const d = ev.date
          ? new Date(ev.date + 'T00:00:00').toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric' })
          : new Date(ev.createdAt).toLocaleDateString('tr-TR', { day:'numeric', month:'short' });
        const adminPart = isAdmin ? `
          <div class="event-card__admin-row">
            <button class="btn btn--outline btn--sm ec-edit" data-id="${ev.id}" style="flex:1">Düzenle</button>
            <button class="btn btn--ghost btn--sm ec-del" data-id="${ev.id}" style="flex:1;color:#FF3B30">Sil</button>
          </div>` : '';
        return `<div class="event-card" data-evid="${ev.id}">
          <div class="event-card__header">
            <p class="event-card__title">${UI._escHtml(ev.title)}</p>
            <span class="event-card__date">${d}</span>
          </div>
          ${ev.body ? `<p class="event-card__body">${UI._escHtml(ev.body)}</p>` : ''}
          ${adminPart}
        </div>`;
      }).join('');
      listEl.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.ec-edit') || e.target.closest('.ec-del')) return;
          const ev = docs.find(d => d.id === card.dataset.evid);
          if (ev) UI.openEventDetail(ev);
        });
      });

      if (Auth.isAdmin()) {
        listEl.querySelectorAll('.ec-edit').forEach(btn => {
          btn.addEventListener('click', () => { const ev = docs.find(e => e.id === btn.dataset.id); if (ev) _openEventModal(ev); });
        });
        listEl.querySelectorAll('.ec-del').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Bu etkinliği silmek istiyor musunuz?')) return;
            const ev = docs.find(e => e.id === btn.dataset.id);
            await FirebaseService.deleteDoc('events', btn.dataset.id);
            // Delete linked map pin by eventId (strong linkage)
            try {
              const pins = await FirebaseService.getDocs('mapPins');
              const relatedPin = pins.find(p => p.eventId === ev?.id);
              if (relatedPin) {
                await FirebaseService.deleteDoc('mapPins', relatedPin.id);
              }
            } catch {}
            await Notifications.sendToAll('Etkinlik İptal Edildi', ev?.title || '');
          });
        });
      }
    });
  }

  function _openEventModal(evData, ll = null) {
    const modal = document.getElementById('modal-event');
    if (!modal) return;
    document.getElementById('event-title-input').value = evData?.title || '';
    document.getElementById('event-body-input').value  = evData?.body  || '';
    document.getElementById('event-date-input').value  = evData?.date  || '';
    document.getElementById('modal-event-title').textContent = evData ? 'Etkinliği Düzenle' : 'Etkinlik Ekle';
    if (evData) modal.dataset.editId = evData.id; else delete modal.dataset.editId;
    if (ll) { modal.dataset.eventLat = ll.lat; modal.dataset.eventLng = ll.lng; }
    else    { delete modal.dataset.eventLat; delete modal.dataset.eventLng; delete modal.dataset.eventPinId; }
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  }

  function _closeEventModal() {
    const modal = document.getElementById('modal-event');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
    if (modal) delete modal.dataset.editId;
  }

  function _updateEventAdminUI() {
    document.getElementById('add-event-fab')?.classList.toggle('hidden', !Auth.isAdmin());
  }

  async function _incrementEventsBadge() {
    const count = ((await DB.getSetting('events_badge', 0))||0) + 1;
    await DB.setSetting('events_badge', count);
    _showEventsBadge(count);
  }
  async function _clearEventsBadge() {
    await DB.setSetting('events_badge', 0);
    document.getElementById('events-badge')?.classList.add('hidden');
  }
  function _showEventsBadge(n) {
    const b = document.getElementById('events-badge');
    if (!b) return;
    if (n > 0) { b.textContent = n > 9 ? '9+' : n; b.classList.remove('hidden'); }
    else b.classList.add('hidden');
  }
  async function _loadEventsBadge() {
    _showEventsBadge((await DB.getSetting('events_badge', 0)) || 0);
  }

  // ════════════════════════════════════════════════════════
  // USERS MODAL (admin) — with 3-dot see-more + super admin transfer
  // ════════════════════════════════════════════════════════
  document.getElementById('add-user-btn')?.addEventListener('click', () =>
    document.getElementById('add-user-form')?.classList.toggle('hidden'));

  document.getElementById('save-user-btn')?.addEventListener('click', async () => {
    const first = document.getElementById('new-user-first').value;
    const last  = document.getElementById('new-user-last').value;
    const code  = document.getElementById('new-user-code').value;
    const r = await Auth.addUser(first, last, code);
    if (r.success) {
      ['new-user-first','new-user-last','new-user-code'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      document.getElementById('add-user-form')?.classList.add('hidden');
      await _renderUsersList();
    } else alert(r.error);
  });

  document.getElementById('cancel-user-btn')?.addEventListener('click', () =>
    document.getElementById('add-user-form')?.classList.add('hidden'));
  document.getElementById('close-users-btn')?.addEventListener('click', () => UI.closeUsersModal());
  document.getElementById('modal-users')?.addEventListener('click', e => { if (e.target.id === 'modal-users') UI.closeUsersModal(); });

  // Override renderUsersList with full version
  UI.renderUsersList = _renderUsersList;

  // Fix: override openUsersModal so it always uses _renderUsersList (3-dot bug fix)
  UI.openUsersModal = async function() {
    const modal = document.getElementById('modal-users');
    if (!modal) return;
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) addUserForm.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
    await _renderUsersList();
  };

  async function _renderUsersList() {
    const list = document.getElementById('users-list');
    if (!list) return;
    const users = await Auth.getAllUsers();
    const me    = Auth.getUser();
    list.innerHTML = '';
    if (!users.length) {
      list.innerHTML = '<p style="color:var(--color-text-secondary);font-size:14px;padding:12px 0">Henüz kullanıcı yok.</p>';
      return;
    }
    users.forEach(u => {
      if (u.id === me?.id) return; // skip self
      const uIsAdmin = u.isAdmin;
      const row = document.createElement('div');
      row.className = 'user-row';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 14px';
      row.innerHTML = `
        <span class="user-row__name" style="flex:1">${UI._escHtml(u.firstName)} ${UI._escHtml(u.lastName)}</span>
        ${uIsAdmin ? '<span class="user-row__badge">Admin</span>' : ''}
        <button class="user-row-3dot" data-uid="${u.id}" aria-label="Seçenekler"
          style="background:none;border:none;color:var(--color-text-secondary);
                 cursor:pointer;padding:4px 8px;font-size:20px;line-height:1;
                 border-radius:8px;flex-shrink:0">⋮</button>`;
      list.appendChild(row);
    });

    list.querySelectorAll('.user-row-3dot').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const user = users.find(u => u.id === btn.dataset.uid);
        if (user) _showUserActionSheet(user, users);
      });
    });
  }

  function _showUserActionSheet(user, allUsers) {
    document.getElementById('user-action-sheet')?.remove();
    const iAmSuper = Auth.isSuperAdmin();
    const uIsAdmin = user.isAdmin;

    const items = [
      { label: 'Detaylar',     icon: '👤', action: 'detail' },
      !uIsAdmin
        ? { label: 'Admin Yap', icon: '⭐', action: 'grant' }
        : null,
      uIsAdmin && iAmSuper && !user.isSuperAdmin
        ? { label: 'Adminliği Al', icon: '↩️', action: 'revoke' }
        : null,
      uIsAdmin && iAmSuper && !user.isSuperAdmin
        ? { label: 'Üst Yetki Ver', icon: '👑', action: 'transfer' }
        : null,
      { label: 'Kodu Sıfırla', icon: '🔑', action: 'reset' },
      { label: 'Sil', icon: '🗑️', action: 'delete', danger: true }
    ].filter(Boolean);

    const overlay = document.createElement('div');
    overlay.id = 'user-action-sheet';
    overlay.style.cssText = [
      'position:fixed','inset:0','z-index:9000',
      'display:flex','align-items:flex-end','justify-content:center',
      'background:rgba(0,0,0,0.38)',
      'backdrop-filter:blur(4px)','-webkit-backdrop-filter:blur(4px)'
    ].join(';');

    const sheet = document.createElement('div');
    sheet.style.cssText = [
      'background:var(--color-surface)',
      'border-radius:24px 24px 0 0',
      'padding:12px 16px calc(32px + env(safe-area-inset-bottom))',
      'width:100%','max-width:480px',
      'transform:translateY(100%)',
      'transition:transform 0.35s cubic-bezier(0.32,0.72,0,1)'
    ].join(';');

    sheet.innerHTML = `
      <div style="width:36px;height:4px;background:var(--color-border);border-radius:2px;margin:0 auto 16px"></div>
      <p style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--color-text);margin-bottom:12px">
        ${UI._escHtml(user.firstName)} ${UI._escHtml(user.lastName)}
      </p>
      <div id="uas-items"></div>`;

    overlay.appendChild(sheet);

    const container = sheet.querySelector('#uas-items');
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.style.cssText = [
        'width:100%','display:flex','align-items:center','gap:14px',
        'padding:14px 16px','border:none','border-radius:14px',
        'background:var(--color-surface-elevated)',
        'font-family:"DM Sans",sans-serif','font-size:15px','font-weight:500',
        'cursor:pointer','margin-bottom:6px','text-align:left',
        item.danger ? 'color:#FF3B30' : 'color:var(--color-text)',
        'transition:background 0.15s'
      ].join(';');
      btn.innerHTML = `<span style="font-size:18px">${item.icon}</span><span>${item.label}</span>`;
      btn.onmouseenter = () => { btn.style.background = 'var(--color-surface-hover)'; };
      btn.onmouseleave = () => { btn.style.background = 'var(--color-surface-elevated)'; };
      btn.onclick = async () => {
        _closeUserActionSheet();
        if (item.action === 'detail') {
          setTimeout(() => _showUserDetailModal(user), 260);
        } else if (item.action === 'grant') {
          const r = await Auth.requestPromoteUser(user.id);
          if (r.success) { _showToast('Terfi isteği üst yetkiliye gönderildi'); _renderUsersList(); }
          else alert(r.error);
        } else if (item.action === 'revoke') {
          if (!confirm('Adminliği almak istiyor musunuz?')) return;
          const r = await Auth.setAdminStatus(user.id, false);
          if (r.success) _renderUsersList(); else alert(r.error);
        } else if (item.action === 'transfer') {
          if (!confirm(`Üst düzey admin yetkisini ${user.firstName}'a transfer etmek istiyor musunuz? Bu geri alınamaz.`)) return;
          const r = await Auth.transferSuperAdmin(user.id);
          if (r.success) { _renderUsersList(); _updateHomeUI(); } else alert(r.error);
        } else if (item.action === 'reset') {
          const newCode = prompt('Yeni kod:');
          if (!newCode?.trim()) return;
          await Auth.resetUserCode(user.id, newCode);
          _showToast('Kod sıfırlandı ✓');
        } else if (item.action === 'delete') {
          if (!confirm(`${user.firstName} ${user.lastName} silinmek üzere işaretlenecek. Üst yetkili onayına sunulacaktır. Onaylıyor musunuz?`)) return;
          const r = await Auth.requestDeleteUser(user.id);
          if (r.success) { _showToast('Silme isteği üst yetkiliye gönderildi'); _renderUsersList(); }
          else alert(r.error);
        }
      };
      container.appendChild(btn);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'İptal';
    cancelBtn.style.cssText = [
      'width:100%','padding:14px','border:none','border-radius:14px',
      'background:transparent','color:var(--color-text-secondary)',
      'font-family:"DM Sans",sans-serif','font-size:15px','font-weight:500',
      'cursor:pointer','margin-top:4px'
    ].join(';');
    cancelBtn.onclick = _closeUserActionSheet;
    sheet.appendChild(cancelBtn);

    document.getElementById('app-shell').appendChild(overlay);
    requestAnimationFrame(() => requestAnimationFrame(() => { sheet.style.transform = 'translateY(0)'; }));
    overlay.addEventListener('click', e => { if (e.target === overlay) _closeUserActionSheet(); });
  }

  function _closeUserActionSheet() {
    const overlay = document.getElementById('user-action-sheet');
    if (!overlay) return;
    const sheet = overlay.firstElementChild;
    if (sheet) { sheet.style.transform = 'translateY(100%)'; setTimeout(() => overlay.remove(), 380); }
    else overlay.remove();
  }

  // ── User detail modal (show registration data) ────────────
  function _showUserDetailModal(user) {
    let modal = document.getElementById('modal-user-detail');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-user-detail';
      modal.className = 'modal-overlay';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="modal-sheet">
          <div class="modal-sheet__handle"></div>
          <h3 class="modal-sheet__title" id="udm-name"></h3>
          <div id="udm-fields"></div>
          <button id="udm-close-btn" class="btn btn--ghost btn--full" style="margin-top:12px">Kapat</button>
        </div>`;
      document.getElementById('app-shell').appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) _closeUserDetailModal(); });
      document.getElementById('udm-close-btn')?.addEventListener('click', _closeUserDetailModal);
    }

    const labels = {
      firstName:  'Ad', lastName: 'Soyad', gender: 'Cinsiyet',
      birthDate:  'Doğum Tarihi', profession: 'Meslek',
      bloodType:  'Kan Grubu', createdAt: 'Kayıt Tarihi'
    };
    const fields = ['firstName','lastName','gender','birthDate','profession','bloodType','createdAt'];

    document.getElementById('udm-name').textContent = `${user.firstName} ${user.lastName}`;
    const container = document.getElementById('udm-fields');
    container.innerHTML = fields.map(k => {
      let val = user[k];
      if (!val) return '';
      if (k === 'createdAt') val = new Date(val).toLocaleDateString('tr-TR');
      if (k === 'gender') val = val.charAt(0).toUpperCase() + val.slice(1);
      return `<div class="user-detail__field">
        <span class="user-detail__label">${labels[k]}</span>
        <span class="user-detail__value">${UI._escHtml(String(val))}</span>
      </div>`;
    }).join('');

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  }

  function _closeUserDetailModal() {
    const modal = document.getElementById('modal-user-detail');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
  }

  // ════════════════════════════════════════════════════════
  // SCHEDULE SELECTS
  // ════════════════════════════════════════════════════════
  function _bindScheduleSelects() {
    document.getElementById('pin-publish-select')?.addEventListener('change', e =>
      document.getElementById('pin-publish-custom')?.classList.toggle('hidden', e.target.value !== 'custom'));
    document.getElementById('pin-delete-select')?.addEventListener('change', e =>
      document.getElementById('pin-delete-custom')?.classList.toggle('hidden', e.target.value !== 'custom'));
  }

  // ════════════════════════════════════════════════════════
  // SWIPE + iOS MISC
  // ════════════════════════════════════════════════════════
  document.addEventListener('dblclick', e => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) e.preventDefault();
  }, { passive: false });

  let _touchStartX = 0;
  document.addEventListener('touchstart', e => { _touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _touchStartX;
    if (dx > 80 && _touchStartX < 40) {
      const active = document.querySelector('.screen--active');
      if (!active) return;
      if (active.id === 'screen-people')   { People.destroy(); UI.showScreen('screen-home', 'back'); }
      if (active.id === 'screen-map')      { UI.showScreen('screen-home', 'back'); }
      if (active.id === 'screen-events')   { _eventsUnsub?.(); UI.showScreen('screen-home', 'back'); _clearEventsBadge(); }
      if (active.id === 'screen-orgtree')  { OrgTree.destroy(); UI.showScreen('screen-home', 'back'); }
      if (active.id === 'screen-library')  { Library.destroy(); UI.showScreen('screen-home', 'back'); }
      if (active.id === 'screen-register') { UI.showScreen('screen-login', 'back'); }
    }
  }, { passive: true });


  // ── Pending Actions — handled inside Notification Center ───
  // The notification center (Notifications module) now surfaces
  // pending approval requests to the super admin in real-time.
  // _checkPendingActions is kept for backwards compat but is a no-op.
  async function _checkPendingActions() {
    // Notification center handles this via real-time Firestore listener.
  }

  // Event detail bindings
  document.getElementById('close-event-detail-btn')?.addEventListener('click', () => UI.closeEventDetail());
  document.getElementById('modal-event-detail')?.addEventListener('click', e => { if (e.target.id === 'modal-event-detail') UI.closeEventDetail(); });
  document.getElementById('event-detail-add-photo-btn')?.addEventListener('click', async () => {
    const ev = UI.getCurrentEvent();
    if (!ev) return;
    const url = document.getElementById('event-detail-photo-input')?.value.trim();
    if (!url) return;
    const photos = [...(ev.photos || []), url];
    await FirebaseService.setDoc('events', ev.id, { photos });
    const updated = { ...ev, photos };
    UI.openEventDetail(updated);
  });

  document.getElementById('event-detail-add-link-btn')?.addEventListener('click', async () => {
    const ev = UI.getCurrentEvent();
    if (!ev) return;
    const url = document.getElementById('event-detail-link-input')?.value.trim();
    const label = document.getElementById('event-detail-link-label')?.value.trim() || url;
    if (!url) return;
    const links = [...(ev.links || []), { url, label }];
    await FirebaseService.setDoc('events', ev.id, { links });
    UI.openEventDetail({ ...ev, links });
  });

  // Stories bindings
  document.getElementById('stories-close')?.addEventListener('click', () => UI.closeStories());
  document.getElementById('stories-next')?.addEventListener('click', () => { UI._stopStoryTimer(); UI.nextStory(); });
  document.getElementById('stories-prev')?.addEventListener('click', () => { UI._stopStoryTimer(); UI.prevStory(); });
  document.getElementById('modal-stories')?.addEventListener('click', e => { if (e.target.id === 'modal-stories') UI.closeStories(); });

  // Lightbox bindings
  document.getElementById('lightbox-close')?.addEventListener('click', () => UI.closeLightbox());
  document.getElementById('lightbox')?.addEventListener('click', e => { if (e.target.id === 'lightbox') UI.closeLightbox(); });

  // ════════════════════════════════════════════════════════
  // ORG TREE
  // ════════════════════════════════════════════════════════

  document.getElementById('orgtree-btn')?.addEventListener('click', () => {
    UI.showScreen('screen-orgtree');
    OrgTree.load();
    document.getElementById('orgtree-edit-fab')?.classList.toggle('hidden', !Auth.isAdmin());
  });

  document.getElementById('orgtree-back-btn')?.addEventListener('click', () => {
    OrgTree.destroy();
    UI.showScreen('screen-home', 'back');
  });

  document.getElementById('orgtree-settings-btn')?.addEventListener('click', () => UI.openSettings());

  document.getElementById('orgtree-edit-fab')?.addEventListener('click', () => OrgTree.openEditModal());

  // Profile modal close
  document.getElementById('close-orgtree-member-btn')?.addEventListener('click', () => OrgTree.closeProfileModal());
  document.getElementById('modal-orgtree-member')?.addEventListener('click', e => {
    if (e.target.id === 'modal-orgtree-member') OrgTree.closeProfileModal();
  });

  // Edit modal close
  document.getElementById('close-orgtree-edit-btn')?.addEventListener('click', () => OrgTree.closeEditModal());
  document.getElementById('modal-orgtree-edit')?.addEventListener('click', e => {
    if (e.target.id === 'modal-orgtree-edit') OrgTree.closeEditModal();
  });

  // Add node button
  document.getElementById('orgtree-add-node-btn')?.addEventListener('click', () => {
    OrgTree.closeEditModal();
    setTimeout(() => OrgTree.openMemberForm(null), 220);
  });

  // Member form save/cancel
  document.getElementById('save-orgtree-member-btn')?.addEventListener('click', () => OrgTree.saveMemberForm());
  document.getElementById('cancel-orgtree-member-form-btn')?.addEventListener('click', () => OrgTree.closeMemberForm());
  document.getElementById('modal-orgtree-member-form')?.addEventListener('click', e => {
    if (e.target.id === 'modal-orgtree-member-form') OrgTree.closeMemberForm();
  });

  // Swipe back support
  // (handled globally by touchend listener — adding orgtree screen)

  // ════════════════════════════════════════════════════════
  // LIBRARY
  // ════════════════════════════════════════════════════════

  document.getElementById('library-btn')?.addEventListener('click', () => {
    UI.showScreen('screen-library');
    Library.load();
  });

  document.getElementById('lib-back-btn')?.addEventListener('click', () => {
    Library.destroy();
    UI.showScreen('screen-home', 'back');
  });

  document.getElementById('lib-settings-btn')?.addEventListener('click', () => UI.openSettings());

  // View toggle
  document.getElementById('lib-view-grid')?.addEventListener('click', () => Library.setViewMode('grid'));
  document.getElementById('lib-view-list')?.addEventListener('click', () => Library.setViewMode('list'));

  // Search icon toggle
  const _libSearchBtn   = document.getElementById('lib-search-btn');
  const _libSearchBar   = document.getElementById('lib-search-bar');
  const _libSearchInput = document.getElementById('lib-search-input');
  const _libSearchClear = document.getElementById('lib-search-clear');
  const _libContent     = document.querySelector('#screen-library .lib-content');

  function _libToggleSearch() {
    const isOpen = !_libSearchBar?.classList.contains('lib-search-bar--hidden');
    if (isOpen) {
      // Close
      _libSearchBar?.classList.add('lib-search-bar--hidden');
      _libSearchBar?.setAttribute('aria-hidden', 'true');
      _libSearchBtn?.classList.remove('lib-view-btn--active');
      _libContent?.classList.remove('lib-content--search-open');
      if (_libSearchInput) { _libSearchInput.value = ''; Library.search(''); }
    } else {
      // Open
      _libSearchBar?.classList.remove('lib-search-bar--hidden');
      _libSearchBar?.setAttribute('aria-hidden', 'false');
      _libSearchBtn?.classList.add('lib-view-btn--active');
      _libContent?.classList.add('lib-content--search-open');
      setTimeout(() => _libSearchInput?.focus(), 50);
    }
  }

  _libSearchBtn?.addEventListener('click', _libToggleSearch);

  _libSearchInput?.addEventListener('input', () => {
    const q = _libSearchInput.value;
    _libSearchClear?.classList.toggle('hidden', !q);
    Library.search(q);
  });

  _libSearchClear?.addEventListener('click', () => {
    if (_libSearchInput) { _libSearchInput.value = ''; _libSearchInput.focus(); }
    _libSearchClear?.classList.add('hidden');
    Library.search('');
  });

  // Add book FAB (admin)
  document.getElementById('lib-add-btn')?.addEventListener('click', () => Library.openBookForm());

  // Expanded overlay close
  document.getElementById('lib-expand-close')?.addEventListener('click', () => Library.closeExpanded());
  document.getElementById('lib-expand-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'lib-expand-overlay') Library.closeExpanded();
  });

  // PDF reader close
  document.getElementById('lib-pdf-close')?.addEventListener('click', () => Library.closePDFReader());

  // Author info modal close
  document.getElementById('close-author-info-btn')?.addEventListener('click', () => Library.closeAuthorInfo());
  document.getElementById('modal-author-info')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-author-info') Library.closeAuthorInfo();
  });

  // Book form modal
  document.getElementById('bf-save-btn')?.addEventListener('click', () => Library.saveBookForm());
  document.getElementById('bf-cancel-btn')?.addEventListener('click', () => Library.closeBookForm());
  document.getElementById('modal-book-form')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-book-form') Library.closeBookForm();
  });

})();

/* ============================================================
   OrgTree — Hierarchical animated tree for Youth Branch Board
   Data stored in Firestore collection: orgTree
   ============================================================ */

const OrgTree = (() => {

  // ── Layout constants ──────────────────────────────────────
  const NODE_W    = 100;  // card width
  const NODE_H    = 120;  // card height (root taller)
  const H_GAP     = 20;   // horizontal gap between siblings
  const V_GAP     = 70;   // vertical gap between levels
  const PAD_X     = 24;   // canvas horizontal padding
  const PAD_Y     = 24;   // canvas top padding

  let _members     = [];  // flat array from Firestore
  let _unsubscribe = null;
  let _editingId   = null; // which member is being edited in the form

  // ── Seed data — shown until Firestore has data ────────────
  const SEED = [
    {
      id: 'root',
      firstName: 'Ad',
      lastName: 'Soyad',
      titleRole: 'Gençlik Kolu Başkanı',
      bio: 'Gençlik Kolu Yönetim Kurulu Başkanı.',
      photoURL: '',
      parentId: null,
      socials: {},
      order: 0
    }
  ];

  // ── Load from Firestore ───────────────────────────────────
  function load() {
    _unsubscribe?.();
    _unsubscribe = FirebaseService.onSnapshot('orgTree', docs => {
      _members = docs.length ? docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : SEED;
      _render();
    });
  }

  // ── Build tree structure ──────────────────────────────────
  function _buildTree(members) {
    const map = {};
    members.forEach(m => { map[m.id] = { ...m, children: [] }; });
    let root = null;
    members.forEach(m => {
      if (!m.parentId || !map[m.parentId]) {
        if (!root) root = map[m.id];
      } else {
        map[m.parentId].children.push(map[m.id]);
      }
    });
    return root;
  }

  // ── Compute layout positions (Reingold-Tilford-ish) ───────
  function _computeLayout(node, depth, memo) {
    if (!node) return;
    node._depth = depth;
    if (!node.children || !node.children.length) {
      node._subtreeW = NODE_W;
      return;
    }
    node.children.forEach(c => _computeLayout(c, depth + 1, memo));
    const totalChildW = node.children.reduce((s, c) => s + c._subtreeW, 0)
      + H_GAP * (node.children.length - 1);
    node._subtreeW = Math.max(NODE_W, totalChildW);
  }

  function _assignXY(node, offsetX, offsetY) {
    if (!node) return;
    node._x = offsetX + node._subtreeW / 2 - NODE_W / 2;
    node._y = offsetY;
    let cursor = offsetX;
    (node.children || []).forEach(c => {
      _assignXY(c, cursor, offsetY + (node.id === _members[0]?.id ? 140 : NODE_H) + V_GAP);
      cursor += c._subtreeW + H_GAP;
    });
  }

  // ── Flatten tree to list ──────────────────────────────────
  function _flatten(node, out = []) {
    if (!node) return out;
    out.push(node);
    (node.children || []).forEach(c => _flatten(c, out));
    return out;
  }

  // ── Render ────────────────────────────────────────────────
  function _render() {
    const wrap     = document.getElementById('orgtree-canvas-wrap');
    const nodesDiv = document.getElementById('orgtree-nodes');
    const svgEl    = document.getElementById('orgtree-svg');
    if (!wrap || !nodesDiv || !svgEl) return;

    const root = _buildTree(_members);
    if (!root) {
      nodesDiv.innerHTML = '<p style="padding:40px;text-align:center;color:var(--color-text-secondary)">Henüz üye eklenmemiş.</p>';
      return;
    }

    _computeLayout(root, 0, {});
    _assignXY(root, PAD_X, PAD_Y);

    const allNodes  = _flatten(root);
    const maxRight  = Math.max(...allNodes.map(n => n._x + NODE_W)) + PAD_X;
    const maxBottom = Math.max(...allNodes.map(n => n._y + NODE_H)) + PAD_Y + 60;

    wrap.style.width  = maxRight  + 'px';
    wrap.style.height = maxBottom + 'px';

    // ── Draw SVG connectors ───────────────────────────────
    svgEl.innerHTML = '';
    svgEl.setAttribute('viewBox', `0 0 ${maxRight} ${maxBottom}`);
    svgEl.style.width  = maxRight  + 'px';
    svgEl.style.height = maxBottom + 'px';

    let lineDelay = 0;
    allNodes.forEach(node => {
      (node.children || []).forEach(child => {
        const px = node._x + NODE_W / 2;
        const py = node._y + (node.id === root.id ? 140 : NODE_H);
        const cx = child._x + NODE_W / 2;
        const cy = child._y;
        const midY = (py + cy) / 2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${px} ${py} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${cy}`);
        path.classList.add('otree-connector');
        path.style.animationDelay = lineDelay + 'ms';
        svgEl.appendChild(path);

        // Trigger animation after DOM insert
        requestAnimationFrame(() => requestAnimationFrame(() => {
          path.classList.add('otree-connector--animated');
        }));

        lineDelay += 60;
      });
    });

    // ── Render node cards ─────────────────────────────────
    nodesDiv.innerHTML = '';
    let nodeDelay = 80;

    allNodes.forEach(node => {
      const isRoot = !node.parentId || node.id === allNodes[0].id;
      const cardW  = isRoot ? 110 : NODE_W;

      const div = document.createElement('div');
      div.className = 'otree-node' + (isRoot ? ' otree-node--root' : '');
      div.style.cssText = `left:${node._x}px;top:${node._y}px;width:${cardW}px;animation-delay:${nodeDelay}ms`;
      div.dataset.id = node.id;

      const src = node.photoURL || '';
      const initials = ((node.firstName?.[0] || '') + (node.lastName?.[0] || '')).toUpperCase();
      const photoHtml = src
        ? `<img src="${UI._escHtml(src)}" alt="${UI._escHtml(node.firstName)}" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
          + `<div class="otree-node__initials" style="display:none">${initials}</div>`
        : `<div class="otree-node__initials">${initials}</div>`;

      const titleBadge = node.titleRole
        ? `<div class="otree-node__title-badge">${UI._escHtml(node.titleRole)}</div>` : '';

      div.innerHTML = `
        <div class="otree-node__card">
          <div class="otree-node__photo">${photoHtml}</div>
          <p class="otree-node__name">${UI._escHtml(node.firstName)} ${UI._escHtml(node.lastName)}</p>
          ${titleBadge}
        </div>`;

      div.addEventListener('click', () => _openProfile(node));
      nodesDiv.appendChild(div);

      // Staggered reveal
      requestAnimationFrame(() => requestAnimationFrame(() => {
        div.classList.add('otree-node--visible');
      }));

      nodeDelay += 55;
    });

    // Hint
    const hint = document.createElement('div');
    hint.className = 'orgtree-hint';
    hint.style.cssText = `position:absolute;bottom:10px;left:0;right:0`;
    hint.textContent = 'Profil detayları için karta dokunun';
    nodesDiv.appendChild(hint);
  }

  // ── Open profile modal ────────────────────────────────────
  function _openProfile(member) {
    const modal = document.getElementById('modal-orgtree-member');
    if (!modal) return;

    const photoWrap = document.getElementById('otp-photo');
    const src = member.photoURL || '';
    const initials = ((member.firstName?.[0] || '') + (member.lastName?.[0] || '')).toUpperCase();
    if (photoWrap) {
      if (src) {
        photoWrap.innerHTML = `<img src="${UI._escHtml(src)}" alt="${UI._escHtml(member.firstName)}" style="width:100%;height:100%;object-fit:cover" onerror="this.outerHTML='<div class=\\'orgtree-profile__photo-initials\\'>${initials}</div>'">`;
      } else {
        photoWrap.innerHTML = `<div class="orgtree-profile__photo-initials">${initials}</div>`;
      }
    }

    const nameEl  = document.getElementById('otp-name');
    const titleEl = document.getElementById('otp-title');
    const bioEl   = document.getElementById('otp-bio');
    if (nameEl)  nameEl.textContent  = `${member.firstName} ${member.lastName}`;
    if (titleEl) titleEl.textContent = member.titleRole || '';
    if (bioEl)   bioEl.textContent   = member.bio || '';

    // Socials
    const socialsEl = document.getElementById('otp-socials');
    if (socialsEl) socialsEl.innerHTML = UI.buildSocialLinks(member.socials || {});

    // Extra links (none in orgtree for now)
    document.getElementById('otp-extra-links').innerHTML = '';

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  }

  function closeProfileModal() {
    const modal = document.getElementById('modal-orgtree-member');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
  }

  // ── Edit modal ────────────────────────────────────────────
  function openEditModal() {
    const modal = document.getElementById('modal-orgtree-edit');
    if (!modal) return;
    _renderEditList();
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  }

  function closeEditModal() {
    const modal = document.getElementById('modal-orgtree-edit');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
  }

  function _renderEditList() {
    const list = document.getElementById('orgtree-members-edit-list');
    if (!list) return;
    if (!_members.length) {
      list.innerHTML = '<p style="color:var(--color-text-secondary);font-size:14px;padding:8px 0">Henüz üye yok.</p>';
      return;
    }
    list.innerHTML = '';
    _members.forEach(m => {
      const row = document.createElement('div');
      row.className = 'otree-edit-row';
      row.innerHTML = `
        <div class="otree-edit-row__info">
          <div class="otree-edit-row__name">${UI._escHtml(m.firstName)} ${UI._escHtml(m.lastName)}</div>
          <div class="otree-edit-row__role">${UI._escHtml(m.titleRole || '—')}</div>
        </div>
        <button class="icon-btn otree-edit-btn" data-id="${m.id}" aria-label="Düzenle" style="flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="icon-btn otree-del-btn" data-id="${m.id}" aria-label="Sil" style="flex-shrink:0;color:#FF3B30">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>`;
      list.appendChild(row);
    });

    list.querySelectorAll('.otree-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = _members.find(x => x.id === btn.dataset.id);
        if (m) { closeEditModal(); setTimeout(() => openMemberForm(m), 220); }
      });
    });

    list.querySelectorAll('.otree-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Bu üyeyi silmek istiyor musunuz?')) return;
        await FirebaseService.deleteDoc('orgTree', btn.dataset.id);
        _members = _members.filter(x => x.id !== btn.dataset.id);
        _renderEditList();
        _render();
      });
    });
  }

  // ── Member form ───────────────────────────────────────────
  function openMemberForm(member = null) {
    _editingId = member?.id || null;
    const modal = document.getElementById('modal-orgtree-member-form');
    if (!modal) return;

    // Populate parent select
    const parentSel = document.getElementById('otf-parent');
    if (parentSel) {
      parentSel.innerHTML = '<option value="">— Kök (En Üst) —</option>';
      _members.filter(m => m.id !== _editingId).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.firstName} ${m.lastName}${m.titleRole ? ' — ' + m.titleRole : ''}`;
        parentSel.appendChild(opt);
      });
    }

    // Fill fields
    document.getElementById('otf-first').value    = member?.firstName  || '';
    document.getElementById('otf-last').value     = member?.lastName   || '';
    document.getElementById('otf-title').value    = member?.titleRole  || '';
    document.getElementById('otf-bio').value      = member?.bio        || '';
    document.getElementById('otf-photo').value    = member?.photoURL   || '';
    if (parentSel) parentSel.value = member?.parentId || '';

    const s = member?.socials || {};
    document.getElementById('otf-instagram').value = s.instagram || '';
    document.getElementById('otf-twitter').value   = s.twitter   || '';
    document.getElementById('otf-linkedin').value  = s.linkedin  || '';
    document.getElementById('otf-facebook').value  = s.facebook  || '';
    document.getElementById('otf-youtube').value   = s.youtube   || '';

    const titleEl = document.getElementById('modal-orgtree-form-title');
    if (titleEl) titleEl.textContent = member ? 'Üyeyi Düzenle' : 'Yeni Üye Ekle';

    // Inject social icons
    modal.querySelectorAll('.social-input-icon[data-platform]').forEach(el => {
      const p = el.dataset.platform;
      el.innerHTML = (UI.SOCIAL_ICONS[p] || '');
      el.style.color = UI.SOCIAL_COLORS[p] || 'currentColor';
    });

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  }

  function closeMemberForm() {
    const modal = document.getElementById('modal-orgtree-member-form');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
    _editingId = null;
  }

  async function saveMemberForm() {
    const first = document.getElementById('otf-first')?.value.trim();
    const last  = document.getElementById('otf-last')?.value.trim();
    if (!first || !last) { alert('Ad ve soyad zorunludur.'); return; }

    const btn = document.getElementById('save-orgtree-member-btn');
    btn.disabled = true; btn.textContent = 'Kaydediliyor...';

    const id = _editingId || CryptoManager.generateId();
    const existing = _members.find(m => m.id === id);

    const member = {
      id,
      firstName: first,
      lastName:  last,
      titleRole: document.getElementById('otf-title')?.value.trim() || '',
      bio:       document.getElementById('otf-bio')?.value.trim()   || '',
      photoURL:  document.getElementById('otf-photo')?.value.trim() || '',
      parentId:  document.getElementById('otf-parent')?.value       || null,
      order:     existing?.order ?? Date.now(),
      socials: {
        instagram: document.getElementById('otf-instagram')?.value.trim() || null,
        twitter:   document.getElementById('otf-twitter')?.value.trim()   || null,
        linkedin:  document.getElementById('otf-linkedin')?.value.trim()  || null,
        facebook:  document.getElementById('otf-facebook')?.value.trim()  || null,
        youtube:   document.getElementById('otf-youtube')?.value.trim()   || null,
      }
    };

    try {
      await FirebaseService.setDoc('orgTree', id, member);
      closeMemberForm();
    } catch (e) {
      alert('Kayıt hatası: ' + (e.message || e));
    } finally {
      btn.disabled = false; btn.textContent = 'Kaydet';
    }
  }

  function destroy() { _unsubscribe?.(); }

  return { load, destroy, openEditModal, closeEditModal, openMemberForm, closeMemberForm, saveMemberForm, closeProfileModal };
})();
