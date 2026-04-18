/* ============================================================
   App — Main orchestrator v3
   ============================================================ */

(async () => {

  Sync.registerSW();
  try { await DB.init(); } catch (e) { console.error('[App] DB:', e); }
  await UI.loadTheme();
  try { await FirebaseService.init(); } catch (e) { console.error('[App] Firebase:', e); }

  UI.init();
  UI.bindPasswordToggle();
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
    if (headerRegBtn) headerRegBtn.classList.toggle('hidden', !isGuest);

    // Settings: show/hide logout & admin section
    const adminSection = document.getElementById('admin-section');
    if (adminSection) adminSection.classList.toggle('hidden', !isAdmin);
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

  // ── Toast notification ────────────────────────────────────
  function _showToast(msg) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.cssText = [
        'position:absolute', 'bottom:100px', 'left:50%', 'transform:translateX(-50%)',
        'background:var(--color-text)', 'color:var(--color-bg)', 'padding:10px 18px',
        'border-radius:20px', 'font-size:13px', 'font-weight:500', 'white-space:nowrap',
        'z-index:500', 'transition:opacity 0.3s ease', 'pointer-events:none'
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
    const MAX     = 5; // max for logged-in users

    let count = 0;
    if (!isGuest) {
      count = (await DB.getSetting(KEY, 0)) || 0;
      if (count >= MAX) return; // already shown 5 times
    }
    // Show popups
    setTimeout(() => UI.showWelcomePopups(), 500);
    // Increment counter for logged-in users
    if (!isGuest && userId) {
      await DB.setSetting(KEY, count + 1);
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
        zoom: 13,
        minZoom: 10,
        maxZoom: 19,
     });

     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19
     }).addTo(_map);

     _mapInitialized = true;
     setTimeout(() => _map.invalidateSize(), 400);

     // Darıca overlay yükle (önce Firestore'dan, yoksa config'den)
     _loadDaricaOverlay();

     // Admin: haritaya tıklayınca menü
     if (Auth.isAdmin(() {
        _map.on('click', e => {
           if (_drawMode) {
              _drawPoints.push([e.latlng.lat, e.latlng.lng]);
              _updateDrawPreview();
           } else {
              UI.showMapActionModal(e.latlng);
           }
        });
     }

     // Admin toolbar (sınır çiz butonu)
     if (Auth.isAdmin()) _addDrawToolbar();

     _loadMapPins();
  }

   // ── Darıca overlay ─────────────────────────────────────────
   let _daricaOverlay = null;
   let _daricaBorder  = null;

   async function _loadDaricaOverlay() {
      let boundary = APP_CONFIG.daricaBoundary;
      try {
         const saved = await FirebaseService.getDoc('settings', 'daricaBoundary');
         if (saved?.coords?.length >= 3) boundary = saved.coords;
      } catch {}
      _applyDaricaOverlay(boundary);
   }

   function _applyDaricaOverlay(boundary) {
      if (!_map || !boundary?.length) return;
      _daricaOverlay?.remove();
      _daricaBorder?.remove();

      // Dünya bbox'u → içine Darıca deliği
      _daricaOverlay = L.polygon(
         [ [[-90,-180],[-90,180],[90,180]], boundary ],
         { stroke: false, fillColor: '#000', fillOpacity: 0.22, interactive: false }
         ).addTo(_map);

         // Darıca çerçevesi (kesik çizgi)
         _daricaBorder = L.polygon(boundary, {
            color: '#1B2E6E', weight: 2, opacity: 0.55,
            fillOpacity: 0, dashArray: '7 5', interactive: false
         }).addTo(_map);
   }

   // ── Admin: sınır çizme modu ────────────────────────────────
   let _drawMode   = false;
   let _drawPoints = [];
   let _drawPreview = null;

   function _addDrawToolbar() {
      const btn = L.control({ position: 'topright' });
      btn.onAdd = () => {
         const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
         div.innerHTML = `
         <a id="draw-boundary-btn" href="#" title="Darıca Sınırı Çiz"
           style="display:flex;align-items:center;justify-content:center;
                  width:30px;height:30px;font-size:16px;text-decoration:none;
                  color:var(--color-primary)" role="button">✏️</a>`;
         L.DomEvent.disableClickProgration(div);
         div.querySelector('#draw-boundary-btn').onclick = e => {
            e.preventDefault();
            if (_drawMode) _finishDraw(); else _startDraw();
         };
         return div;
      };
      btn.addTo(_map);
   }

   function _startDraw() {
      _drawMode   = true;
      _drawPoints = [];
      _drawPreview?.remove();
      _showToast('Noktaları tıklayarak seç. Bitirmek için ✏️ butonuna tekrar bas.');
      document.getElementById('draw-boundary-btn').style.background = '#FF9500';
      document.getElementById('draw-boundary-btn').style.color = '#fff';
   }

   function _updateDrawPreview () {
      _drawPreview?.remove();
      if (_drawPoints.lenght > 2) return;
      _drawPreview = L.polyline(_drawPoints, {
         color: '#FF9500', weight: 2, dashArray: '5 4'
      }).addTo(_map);
   }

   async function _finishDraw() {
      _drawMode = false;
      document.getElementById('draw-boundary-btn').style.background = '';
      document.getElementById('draw-boundary-btn').style.color = '';
      _drawPreview?.remove();
      if (_drawPoints.length < 3) { _showToast('En az 3nokta gerekli.'); return; }

      // Poligonu kapat
      const closed = [..._drawPoints, _drawPoints[0]];
      await FirebaseService.setDoc('settings', 'daricaBoundary', { coords: closed });
      _applyDaricaOverlay(closed);
      _showToast('Sınır kaydedildi ✓');
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
        if (Auth.isAdmin()) popup += `<br><button onclick="window._delPin('${pin.id}')" style="margin-top:6px;padding:4px 10px;border:none;background:#ff3b30;color:#fff;border-radius:6px;cursor:pointer;font-size:12px">Sil</button>`;
        marker.bindPopup(popup);
        marker.addTo(_map);
        _pinMarkers[pin.id] = marker;
      });
    });
  }

  window._delPin = async id => {
    if (!confirm('Bu konumu silmek istiyor musunuz?')) return;
    await FirebaseService.deleteDoc('mapPins', id);
  };

  document.getElementById('map-action-pin-btn')?.addEventListener('click', () => {
    const ll = UI.getPendingLatLng();
    UI.closeMapActionModal();
    setTimeout(() => UI.openMapPinModal(ll), 200);
  });
  document.getElementById('map-action-event-btn')?.addEventListener('click', () => {
    UI.closeMapActionModal();
    setTimeout(() => _openEventModal(null), 200);
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
    await FirebaseService.setDoc('mapPins', pin.id, pin);
    btn.disabled = false; btn.textContent = 'Kaydet';
    UI.closeMapPinModal();
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
      await DB.saveEvent(event);
      _closeEventModal();
      await Notifications.sendToAll(
        editId ? `Etkinlik güncellendi: ${title}` : `Yeni Etkinlik: ${title}`,
        body ? body.substring(0, 100) : ''
      );
      if (!editId) _incrementEventsBadge();
    } catch (e) { alert('Hata: ' + (e.message || '')); }
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
        return `<div class="event-card">
          <div class="event-card__header">
            <p class="event-card__title">${UI._escHtml(ev.title)}</p>
            <span class="event-card__date">${d}</span>
          </div>
          ${ev.body ? `<p class="event-card__body">${UI._escHtml(ev.body)}</p>` : ''}
          ${adminPart}
        </div>`;
      }).join('');
      if (Auth.isAdmin()) {
        listEl.querySelectorAll('.ec-edit').forEach(btn => {
          btn.addEventListener('click', () => { const ev = docs.find(e => e.id === btn.dataset.id); if (ev) _openEventModal(ev); });
        });
        listEl.querySelectorAll('.ec-del').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Bu etkinliği silmek istiyor musunuz?')) return;
            const ev = docs.find(e => e.id === btn.dataset.id);
            await FirebaseService.deleteDoc('events', btn.dataset.id);
            await DB.deleteEvent(btn.dataset.id).catch(() => {});
            await Notifications.sendToAll('Etkinlik İptal Edildi', ev?.title || '');
          });
        });
      }
    });
  }

  function _openEventModal(evData) {
    const modal = document.getElementById('modal-event');
    if (!modal) return;
    document.getElementById('event-title-input').value = evData?.title || '';
    document.getElementById('event-body-input').value  = evData?.body  || '';
    document.getElementById('event-date-input').value  = evData?.date  || '';
    document.getElementById('modal-event-title').textContent = evData ? 'Etkinliği Düzenle' : 'Etkinlik Ekle';
    if (evData) modal.dataset.editId = evData.id; else delete modal.dataset.editId;
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
      const isMe       = u.id === me?.id;
      const uIsAdmin   = u.isAdmin;
      const iAmSuper   = Auth.isSuperAdmin();

      const row = document.createElement('div');
      row.className = 'user-row';
      row.style.cssText = 'flex-direction:column;align-items:stretch;gap:8px;padding:12px 14px';

      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:8px';
      header.innerHTML = `
        <span class="user-row__name" style="flex:1">${UI._escHtml(u.firstName)} ${UI._escHtml(u.lastName)}</span>
        ${uIsAdmin ? '<span class="user-row__badge">Admin</span>' : ''}
        <button class="user-row-more-btn" data-uid="${u.id}" aria-label="Detaylar">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>`;
      row.appendChild(header);

      // Action buttons
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';

      if (!isMe) {
        if (!uIsAdmin) {
          const grantBtn = document.createElement('button');
          grantBtn.className = 'btn btn--outline btn--sm';
          grantBtn.textContent = 'Admin Yap';
          grantBtn.onclick = async () => {
            const r = await Auth.setAdminStatus(u.id, true);
            if (r.success) _renderUsersList(); else alert(r.error);
          };
          actions.appendChild(grantBtn);
        } else if (iAmSuper && !u.isSuperAdmin) {
          // Only super admin can revoke
          const revokeBtn = document.createElement('button');
          revokeBtn.className = 'btn btn--ghost btn--sm';
          revokeBtn.style.color = '#FF9500';
          revokeBtn.textContent = 'Adminliği Al';
          revokeBtn.onclick = async () => {
            if (!confirm('Bu kullanıcının adminliğini almak istiyor musunuz?')) return;
            const r = await Auth.setAdminStatus(u.id, false);
            if (r.success) _renderUsersList(); else alert(r.error);
          };
          actions.appendChild(revokeBtn);

          // Super admin transfer button
          if (Auth.isSuperAdmin()) {
            const transferBtn = document.createElement('button');
            transferBtn.className = 'btn btn--ghost btn--sm';
            transferBtn.style.color = '#AF52DE';
            transferBtn.textContent = 'Üst Yetki Ver';
            transferBtn.onclick = async () => {
              if (!confirm(`Üst düzey admin yetkisini ${u.firstName} ${u.lastName}'a transfer etmek istiyor musunuz? Bu işlem geri alınamaz.`)) return;
              const r = await Auth.transferSuperAdmin(u.id);
              if (r.success) { _renderUsersList(); _updateHomeUI(); }
              else alert(r.error);
            };
            actions.appendChild(transferBtn);
          }
        }

        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn btn--ghost btn--sm';
        resetBtn.textContent = 'Kodu Sıfırla';
        resetBtn.onclick = async () => {
          const newCode = prompt('Yeni kodu girin:');
          if (!newCode?.trim()) return;
          await Auth.resetUserCode(u.id, newCode);
          _showToast('Kod sıfırlandı ✓');
        };
        actions.appendChild(resetBtn);

        // Delete: only super admin can delete admins
        const canDelete = !uIsAdmin || (iAmSuper && !u.isSuperAdmin);
        if (canDelete) {
          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn--ghost btn--sm';
          delBtn.style.color = '#FF3B30';
          delBtn.textContent = 'Sil';
          delBtn.onclick = async () => {
            if (!confirm('Bu kullanıcıyı silmek istiyor musunuz?')) return;
            await Auth.deleteUser(u.id);
            _renderUsersList();
          };
          actions.appendChild(delBtn);
        }
      }

      row.appendChild(actions);
      list.appendChild(row);
    });

    // Bind 3-dot buttons
    list.querySelectorAll('.user-row-more-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid  = btn.dataset.uid;
        const user = users.find(u => u.id === uid);
        if (!user) return;
        _showUserDetailModal(user);
      });
    });
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
      if (active.id === 'screen-register') { UI.showScreen('screen-login', 'back'); }
    }
  }, { passive: true });

})();
