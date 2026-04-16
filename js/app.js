/* ============================================================
   App — Main orchestrator (full rewrite)
   ============================================================ */

(async () => {
  // ── 1. Service Worker ─────────────────────────────────────
  Sync.registerSW();

  // ── 2. DB ────────────────────────────────────────────────
  try { await DB.init(); } catch (e) { console.error('[App] DB:', e); }

  // ── 3. Theme ─────────────────────────────────────────────
  await UI.loadTheme();

  // ── 4. Firebase ───────────────────────────────────────────
  try { await FirebaseService.init(); } catch (e) { console.error('[App] Firebase:', e); }

  // ── 5. UI static bindings ────────────────────────────────
  UI.init();
  UI.bindPasswordToggle();
  UI.bindPhotoUpload();
  _bindScheduleSelects();

  // ── 6. Splash then route ──────────────────────────────────
  UI.playSplash(async () => {
    const user = await Auth.init();
    if (user) {
      _showHome();
      _showWelcomePopupsIfNeeded();
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
  document.getElementById('go-register-btn')?.addEventListener('click', () => {
    UI.showScreen('screen-register');
  });
  ['login-first-name','login-last-name','login-code'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') _handleLogin(); });
  });

  async function _handleLogin() {
    const firstName = document.getElementById('login-first-name').value;
    const lastName  = document.getElementById('login-last-name').value;
    const code      = document.getElementById('login-code').value;
    const errorEl   = document.getElementById('login-error');
    const btn       = document.getElementById('login-btn');
    const labelEl   = btn.querySelector('.btn__label');
    const spinnerEl = btn.querySelector('.btn__spinner');
    if (errorEl) errorEl.textContent = '';
    if (labelEl)   labelEl.textContent = 'Giriş yapılıyor...';
    if (spinnerEl) spinnerEl.removeAttribute('hidden');
    btn.disabled = true;
    try {
      const r = await Auth.login(firstName, lastName, code);
      if (r.success) {
        _showHome();
        _showWelcomePopupsIfNeeded();
        if (!Auth.isGuest()) Notifications.init(r.user.id).catch(() => {});
      } else {
        if (errorEl) errorEl.textContent = r.error;
        UI.shakeLoginForm();
      }
    } catch (err) {
      if (errorEl) errorEl.textContent = 'Bir hata oluştu.';
    } finally {
      if (labelEl)   labelEl.textContent = 'Giriş Yap';
      if (spinnerEl) spinnerEl.setAttribute('hidden', '');
      btn.disabled = false;
    }
  }

  // ════════════════════════════════════════════════════════
  // REGISTER
  // ════════════════════════════════════════════════════════
  document.getElementById('reg-submit-btn')?.addEventListener('click', async () => {
    const data = {
      firstName:  document.getElementById('reg-first-name').value,
      lastName:   document.getElementById('reg-last-name').value,
      birthDate:  document.getElementById('reg-birthdate').value,
      gender:     document.getElementById('reg-gender').value,
      profession: document.getElementById('reg-profession').value,
      bloodType:  document.getElementById('reg-blood').value || null,
      code:       document.getElementById('reg-code').value
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
      if (errorEl) errorEl.textContent = 'Kayıt sırasında hata oluştu.';
    } finally {
      btn.disabled = false; btn.textContent = 'Kayıt Ol';
    }
  });

  document.getElementById('reg-back-btn')?.addEventListener('click', () => {
    UI.showScreen('screen-login', 'back');
  });

  // ════════════════════════════════════════════════════════
  // HOME
  // ════════════════════════════════════════════════════════
  function _showHome() {
    UI.showScreen('screen-home');
    People.updateAdminUI();
    _loadEventsBadge();
  }

  document.getElementById('main-action-btn')?.addEventListener('click', async () => {
    UI.showScreen('screen-people');
    await People.load();
    People.updateAdminUI();
  });

  document.getElementById('map-btn')?.addEventListener('click', () => {
    UI.showScreen('screen-map');
    _initMap();
  });

  document.getElementById('events-btn')?.addEventListener('click', async () => {
    UI.showScreen('screen-events');
    await _loadEvents();
    _updateEventAdminUI();
  });

  // ════════════════════════════════════════════════════════
  // WELCOME POPUPS
  // ════════════════════════════════════════════════════════
  async function _showWelcomePopupsIfNeeded() {
    // Show every time on launch
    setTimeout(() => UI.showWelcomePopups(), 400);
  }

  // ════════════════════════════════════════════════════════
  // SETTINGS
  // ════════════════════════════════════════════════════════
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    if (!confirm('Çıkış yapmak istediğinize emin misiniz?')) return;
    Notifications.destroy();
    await Auth.logout();
    UI.closeSettings();
    ['login-first-name','login-last-name','login-code'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('login-error').textContent = '';
    UI.showScreen('screen-login', 'back');
  });

  document.getElementById('send-notif-settings-btn')?.addEventListener('click', () => {
    UI.closeSettings();
    setTimeout(() => UI.openNotifyModal(), 200);
  });

  document.getElementById('send-notify-btn')?.addEventListener('click', async () => {
    const title = document.getElementById('notify-title-input').value.trim();
    const body  = document.getElementById('notify-body-input').value.trim();
    if (!title) { alert('Başlık zorunludur.'); return; }
    const btn = document.getElementById('send-notify-btn');
    btn.disabled = true; btn.textContent = 'Gönderiliyor...';
    await Notifications.sendToAll(title, body);
    btn.disabled = false; btn.textContent = 'Tüm Kullanıcılara Gönder';
    UI.closeNotifyModal();
    alert('Bildirim gönderildi!');
  });

  document.getElementById('cancel-notify-btn')?.addEventListener('click', () => UI.closeNotifyModal());
  document.getElementById('modal-notify')?.addEventListener('click', e => {
    if (e.target.id === 'modal-notify') UI.closeNotifyModal();
  });

  // ════════════════════════════════════════════════════════
  // PEOPLE SCREEN
  // ════════════════════════════════════════════════════════
  document.getElementById('back-btn')?.addEventListener('click', () => {
    People.destroy();
    UI.showScreen('screen-home', 'back');
  });

  const searchInput = document.getElementById('people-search');
  const clearBtn    = document.getElementById('clear-search-btn');
  searchInput?.addEventListener('input', e => {
    const q = e.target.value;
    clearBtn?.classList.toggle('hidden', !q);
    People.search(q);
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
    } catch { alert('Kayıt sırasında hata oluştu.'); }
    finally { btn.disabled = false; btn.textContent = 'Kaydet'; }
  });

  document.getElementById('cancel-person-btn')?.addEventListener('click', () => UI.closePersonModal());
  document.getElementById('modal-person')?.addEventListener('click', e => {
    if (e.target.id === 'modal-person') UI.closePersonModal();
  });

  // ── See More Modal ────────────────────────────────────────
  document.getElementById('close-see-more-btn')?.addEventListener('click', () => UI.closeSeeMoreModal());
  document.getElementById('modal-see-more')?.addEventListener('click', e => {
    if (e.target.id === 'modal-see-more') UI.closeSeeMoreModal();
  });

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
  let _map            = null;
  let _mapInitialized = false;
  let _pinMarkers     = {};
  let _pinsUnsubscribe = null;

  document.getElementById('map-back-btn')?.addEventListener('click', () => {
    UI.showScreen('screen-home', 'back');
  });
  document.getElementById('settings-btn-3')?.addEventListener('click', () => UI.openSettings());

  function _initMap() {
    if (_mapInitialized) { setTimeout(() => _map?.invalidateSize(), 400); return; }
    if (typeof L === 'undefined') { setTimeout(_initMap, 500); return; }

    _map = L.map('leaflet-map', { center: [39.9334, 32.8597], zoom: 6, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(_map);

    _mapInitialized = true;
    setTimeout(() => _map.invalidateSize(), 400);

    // Admin: long-press or click to open action menu
    if (Auth.isAdmin()) {
      _map.on('click', e => {
        UI.showMapActionModal(e.latlng);
      });
    }

    // Load existing pins
    _loadMapPins();
  }

  function _loadMapPins() {
    _pinsUnsubscribe?.();
    _pinsUnsubscribe = FirebaseService.onSnapshot('mapPins', (docs) => {
      const now = Date.now();
      // Clear old markers
      Object.values(_pinMarkers).forEach(m => _map.removeLayer(m));
      _pinMarkers = {};
      // Add visible pins
      docs.filter(pin => {
        if (pin.deleteAt && pin.deleteAt < now) return false;
        if (pin.publishAt && pin.publishAt > now) return !Auth.isAdmin(); // admins see scheduled
        return true;
      }).forEach(pin => _addPinMarker(pin));
    });
  }

  function _addPinMarker(pin) {
    if (!_map) return;
    const iconConf = (APP_CONFIG?.mapIcons || []).find(i => i.id === pin.iconId) || { emoji: '📍' };
    const icon = L.divIcon({
      className: '',
      html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">${iconConf.emoji}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
    const marker = L.marker([pin.lat, pin.lng], { icon });
    let popupContent = `<b>${pin.title}</b>`;
    if (pin.desc) popupContent += `<br><small>${pin.desc}</small>`;
    if (Auth.isAdmin()) {
      popupContent += `<br><button onclick="window._deletePin('${pin.id}')" style="margin-top:6px;padding:4px 10px;border:none;background:#ff3b30;color:#fff;border-radius:6px;cursor:pointer;font-size:12px">Sil</button>`;
    }
    marker.bindPopup(popupContent);
    marker.addTo(_map);
    _pinMarkers[pin.id] = marker;
  }

  // Global delete handler called from popup HTML
  window._deletePin = async (id) => {
    if (!confirm('Bu konumu silmek istiyor musunuz?')) return;
    await FirebaseService.deleteDoc('mapPins', id);
  };

  // Map action modal buttons
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
  document.getElementById('modal-map-action')?.addEventListener('click', e => {
    if (e.target.id === 'modal-map-action') UI.closeMapActionModal();
  });

  // Save pin
  document.getElementById('save-pin-btn')?.addEventListener('click', async () => {
    const ll      = UI.getPendingLatLng();
    const title   = document.getElementById('pin-title-input').value.trim();
    const desc    = document.getElementById('pin-desc-input').value.trim();
    const iconId  = UI.getSelectedPinIcon();
    const sched   = UI.getPinSchedule();
    if (!title) { alert('Başlık zorunludur.'); return; }
    if (!ll)    { UI.closeMapPinModal(); return; }

    const btn = document.getElementById('save-pin-btn');
    btn.disabled = true; btn.textContent = 'Kaydediliyor...';

    const pin = {
      id:        CryptoManager.generateId(),
      title,
      desc:      desc || '',
      lat:       ll.lat,
      lng:       ll.lng,
      iconId,
      publishAt: sched.publishAt,
      deleteAt:  sched.deleteAt,
      createdAt: Date.now(),
      authorId:  Auth.getUser()?.id
    };

    await FirebaseService.setDoc('mapPins', pin.id, pin);
    btn.disabled = false; btn.textContent = 'Kaydet';
    UI.closeMapPinModal();
  });

  document.getElementById('cancel-pin-btn')?.addEventListener('click', () => UI.closeMapPinModal());
  document.getElementById('modal-map-pin')?.addEventListener('click', e => {
    if (e.target.id === 'modal-map-pin') UI.closeMapPinModal();
  });

  // ════════════════════════════════════════════════════════
  // EVENTS SCREEN
  // ════════════════════════════════════════════════════════
  let _eventsUnsubscribe = null;

  document.getElementById('events-back-btn')?.addEventListener('click', () => {
    _eventsUnsubscribe?.();
    UI.showScreen('screen-home', 'back');
    _clearEventsBadge();
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
      if (editId) {
        try { existing = await FirebaseService.getDoc('events', editId); } catch {}
      }
      const event = {
        id:        editId || CryptoManager.generateId(),
        title, body: body || '', date,
        createdAt: existing?.createdAt ?? Date.now(),
        authorId:  Auth.getUser()?.id
      };
      await FirebaseService.setDoc('events', event.id, event);
      await DB.saveEvent(event);
      _closeEventModal();
      // Auto notification for new events
      await Notifications.sendToAll(
        editId ? `Etkinlik güncellendi: ${title}` : `Yeni Etkinlik: ${title}`,
        body ? body.substring(0, 100) : ''
      );
      if (!editId) _incrementEventsBadge();
    } catch (e) { alert('Kayıt sırasında hata oluştu.'); }
    finally { btn.disabled = false; btn.textContent = 'Yayınla'; }
  });

  document.getElementById('cancel-event-btn')?.addEventListener('click', _closeEventModal);
  document.getElementById('modal-event')?.addEventListener('click', e => {
    if (e.target.id === 'modal-event') _closeEventModal();
  });

  async function _loadEvents() {
    const listEl  = document.getElementById('events-list');
    const emptyEl = document.getElementById('events-empty');
    if (!listEl) return;

    _eventsUnsubscribe?.();
    _eventsUnsubscribe = FirebaseService.onSnapshot('events', (docs) => {
      const events = docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (events.length === 0) {
        listEl.innerHTML = '';
        if (emptyEl) { emptyEl.classList.remove('hidden'); listEl.appendChild(emptyEl); }
        return;
      }
      emptyEl?.classList.add('hidden');
      listEl.innerHTML = events.map(_buildEventCard).join('');
      if (Auth.isAdmin()) {
        listEl.querySelectorAll('.event-card__edit').forEach(btn => {
          btn.addEventListener('click', async () => {
            const ev = events.find(e => e.id === btn.dataset.id);
            if (ev) _openEventModal(ev);
          });
        });
        listEl.querySelectorAll('.event-card__delete').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Bu etkinliği silmek istiyor musunuz?')) return;
            await FirebaseService.deleteDoc('events', btn.dataset.id);
            await DB.deleteEvent(btn.dataset.id).catch(() => {});
            await Notifications.sendToAll('Etkinlik İptal Edildi', events.find(e=>e.id===btn.dataset.id)?.title || '');
          });
        });
      }
    });
  }

  function _buildEventCard(ev) {
    const isAdmin = Auth.isAdmin();
    const dateStr = ev.date
      ? new Date(ev.date + 'T00:00:00').toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric' })
      : new Date(ev.createdAt).toLocaleDateString('tr-TR', { day:'numeric', month:'short' });
    const admin = isAdmin ? `
      <div class="event-card__admin-row">
        <button class="btn btn--outline btn--sm event-card__edit" data-id="${ev.id}" style="flex:1">Düzenle</button>
        <button class="btn btn--ghost btn--sm event-card__delete" data-id="${ev.id}" style="flex:1;color:#FF3B30">Sil</button>
      </div>` : '';
    return `<div class="event-card">
      <div class="event-card__header">
        <p class="event-card__title">${UI._escHtml(ev.title)}</p>
        <span class="event-card__date">${dateStr}</span>
      </div>
      ${ev.body ? `<p class="event-card__body">${UI._escHtml(ev.body)}</p>` : ''}
      ${admin}
    </div>`;
  }

  function _openEventModal(evData = null) {
    const modal = document.getElementById('modal-event');
    const title = document.getElementById('modal-event-title');
    if (!modal) return;
    document.getElementById('event-title-input').value = evData?.title || '';
    document.getElementById('event-body-input').value  = evData?.body  || '';
    document.getElementById('event-date-input').value  = evData?.date  || '';
    if (evData) { title.textContent = 'Etkinliği Düzenle'; modal.dataset.editId = evData.id; }
    else        { title.textContent = 'Etkinlik Ekle'; delete modal.dataset.editId; }
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  }

  function _closeEventModal() {
    const modal = document.getElementById('modal-event');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
    delete modal?.dataset.editId;
  }

  function _updateEventAdminUI() {
    document.getElementById('add-event-fab')?.classList.toggle('hidden', !Auth.isAdmin());
  }

  async function _incrementEventsBadge() {
    const count = ((await DB.getSetting('events_badge', 0)) || 0) + 1;
    await DB.setSetting('events_badge', count);
    _showEventsBadge(count);
  }
  async function _clearEventsBadge() {
    await DB.setSetting('events_badge', 0);
    document.getElementById('events-badge')?.classList.add('hidden');
  }
  function _showEventsBadge(count) {
    const badge = document.getElementById('events-badge');
    if (!badge) return;
    if (count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  }
  async function _loadEventsBadge() {
    const count = await DB.getSetting('events_badge', 0);
    _showEventsBadge(count);
  }

  // ════════════════════════════════════════════════════════
  // USERS MODAL (admin)
  // ════════════════════════════════════════════════════════
  document.getElementById('add-user-btn')?.addEventListener('click', () => {
    document.getElementById('add-user-form')?.classList.toggle('hidden');
  });

  document.getElementById('save-user-btn')?.addEventListener('click', async () => {
    const first = document.getElementById('new-user-first').value;
    const last  = document.getElementById('new-user-last').value;
    const code  = document.getElementById('new-user-code').value;
    const r = await Auth.addUser(first, last, code);
    if (r.success) {
      document.getElementById('new-user-first').value = '';
      document.getElementById('new-user-last').value  = '';
      document.getElementById('new-user-code').value  = '';
      document.getElementById('add-user-form')?.classList.add('hidden');
      await UI.renderUsersList();
    } else { alert(r.error); }
  });

  document.getElementById('cancel-user-btn')?.addEventListener('click', () => {
    document.getElementById('add-user-form')?.classList.add('hidden');
  });
  document.getElementById('close-users-btn')?.addEventListener('click', () => UI.closeUsersModal());
  document.getElementById('modal-users')?.addEventListener('click', e => {
    if (e.target.id === 'modal-users') UI.closeUsersModal();
  });

  // ── Extended renderUsersList with admin toggle + code reset
  const _origRenderUsers = UI.renderUsersList.bind(UI);
  UI.renderUsersList = async function() {
    const list = document.getElementById('users-list');
    if (!list) return;
    const users = await Auth.getAllUsers();
    list.innerHTML = '';
    if (!users.length) {
      list.innerHTML = '<p style="color:var(--color-text-secondary);font-size:14px;padding:12px 0">Henüz kullanıcı yok.</p>';
      return;
    }
    users.forEach(u => {
      const row = document.createElement('div');
      row.className = 'user-row';
      row.style.flexDirection = 'column';
      row.style.alignItems = 'stretch';
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <span class="user-row__name" style="flex:1">${UI._escHtml(u.firstName)} ${UI._escHtml(u.lastName)}</span>
          ${u.isAdmin ? '<span class="user-row__badge">Admin</span>' : ''}
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          ${!u.isAdmin ? `<button class="btn btn--outline btn--sm admin-toggle-btn" data-id="${u.id}" data-admin="false">Admin Yap</button>` : u.id !== Auth.getUser()?.id ? `<button class="btn btn--ghost btn--sm admin-toggle-btn" data-id="${u.id}" data-admin="true">Admin Al</button>` : ''}
          <button class="btn btn--ghost btn--sm reset-code-btn" data-id="${u.id}">Kodu Sıfırla</button>
          ${u.id !== Auth.getUser()?.id ? `<button class="btn btn--ghost btn--sm delete-user-btn" data-id="${u.id}" style="color:#FF3B30">Sil</button>` : ''}
        </div>`;
      list.appendChild(row);
    });

    list.querySelectorAll('.admin-toggle-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const isAdmin = btn.dataset.admin === 'true';
        await Auth.setAdminStatus(btn.dataset.id, !isAdmin);
        await UI.renderUsersList();
      });
    });
    list.querySelectorAll('.reset-code-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newCode = prompt('Yeni kodu girin:');
        if (!newCode?.trim()) return;
        await Auth.resetUserCode(btn.dataset.id, newCode);
        alert('Kod sıfırlandı.');
      });
    });
    list.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Bu kullanıcıyı silmek istiyor musunuz?')) return;
        await Auth.deleteUser(btn.dataset.id);
        await UI.renderUsersList();
      });
    });
  };

  // ════════════════════════════════════════════════════════
  // SCHEDULE SELECT HELPERS
  // ════════════════════════════════════════════════════════
  function _bindScheduleSelects() {
    document.getElementById('pin-publish-select')?.addEventListener('change', e => {
      document.getElementById('pin-publish-custom')?.classList.toggle('hidden', e.target.value !== 'custom');
    });
    document.getElementById('pin-delete-select')?.addEventListener('change', e => {
      document.getElementById('pin-delete-custom')?.classList.toggle('hidden', e.target.value !== 'custom');
    });
  }

  // ════════════════════════════════════════════════════════
  // iOS: double-tap + swipe back
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
      else if (active.id === 'screen-map') { UI.showScreen('screen-home', 'back'); }
      else if (active.id === 'screen-events') { _eventsUnsubscribe?.(); UI.showScreen('screen-home', 'back'); _clearEventsBadge(); }
      else if (active.id === 'screen-register') { UI.showScreen('screen-login', 'back'); }
    }
  }, { passive: true });

})();
