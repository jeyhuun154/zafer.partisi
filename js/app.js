/* ============================================================
   App — Main orchestrator
   Initialises modules and wires up all event listeners
   ============================================================ */

(async () => {
  // ── 1. Register Service Worker (background) ───────────────
  Sync.registerSW();

  // ── 2. Init DB ────────────────────────────────────────────
  try {
    await DB.init();
  } catch (err) {
    console.error('[App] DB init failed:', err);
    // Continue — some features won't work without IndexedDB
  }

  // ── 3. Load saved theme ───────────────────────────────────
  await UI.loadTheme();

  // ── 4. Init UI (bind static handlers) ────────────────────
  UI.init();
  UI.bindPasswordToggle();
  UI.bindPhotoUpload();

  // ── 5. Play splash video, then route to correct screen ───
  UI.playSplash(async () => {
    // After splash: check if user is already logged in
    const user = await Auth.init();

    if (user) {
      // Returning user → go straight to home
      _showHome();
    } else {
      // First time / logged out → show login
      UI.showScreen('screen-login');
    }

    // ── 6. Init connectivity listeners (after UI ready) ──
    Sync.initConnectivityListeners();
  });

  // ══════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ══════════════════════════════════════════════════════════
  const loginBtn = document.getElementById('login-btn');
  loginBtn?.addEventListener('click', _handleLogin);

  // Allow Enter key to submit
  ['login-first-name','login-last-name','login-code'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _handleLogin();
    });
  });

  async function _handleLogin() {
    const firstName = document.getElementById('login-first-name').value;
    const lastName  = document.getElementById('login-last-name').value;
    const code      = document.getElementById('login-code').value;
    const errorEl   = document.getElementById('login-error');
    const btn       = document.getElementById('login-btn');

    // Basic validation
    if (!firstName.trim() || !lastName.trim() || !code.trim()) {
      if (errorEl) errorEl.textContent = 'Lütfen tüm alanları doldurun.';
      UI.shakeLoginForm();
      return;
    }

    // Show loading state
    if (errorEl) errorEl.textContent = '';
    const labelEl   = btn.querySelector('.btn__label');
    const spinnerEl = btn.querySelector('.btn__spinner');
    if (labelEl)   labelEl.textContent = 'Giriş yapılıyor...';
    if (spinnerEl) spinnerEl.removeAttribute('hidden');
    btn.disabled = true;

    try {
      const result = await Auth.login(firstName, lastName, code);

      if (result.success) {
        _showHome();
      } else {
        if (errorEl) errorEl.textContent = result.error;
        UI.shakeLoginForm();
      }
    } catch (err) {
      console.error('[App] Login error:', err);
      if (errorEl) errorEl.textContent = 'Bir hata oluştu. Lütfen tekrar deneyin.';
    } finally {
      if (labelEl)   labelEl.textContent = 'Giriş Yap';
      if (spinnerEl) spinnerEl.setAttribute('hidden', '');
      btn.disabled = false;
    }
  }

  function _showHome() {
    UI.showScreen('screen-home');
    People.updateAdminUI();
    _loadEventsBadge();
  }

  // ══════════════════════════════════════════════════════════
  // HOME SCREEN
  // ══════════════════════════════════════════════════════════
  document.getElementById('main-action-btn')?.addEventListener('click', async () => {
    UI.showScreen('screen-people');
    await People.load();
    People.updateAdminUI();
  });

  // ══════════════════════════════════════════════════════════
  // PEOPLE SCREEN
  // ══════════════════════════════════════════════════════════

  // Back button
  document.getElementById('back-btn')?.addEventListener('click', () => {
    UI.showScreen('screen-home', 'back');
  });

  // Search
  const searchInput = document.getElementById('people-search');
  const clearBtn    = document.getElementById('clear-search-btn');

  searchInput?.addEventListener('input', (e) => {
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

  // Pagination
  document.getElementById('prev-page-btn')?.addEventListener('click', () => People.prevPage());
  document.getElementById('next-page-btn')?.addEventListener('click', () => People.nextPage());

  // Add person button (admin only)
  document.getElementById('add-person-btn')?.addEventListener('click', () => {
    UI.openPersonModal(null);
  });

  // Save person
  document.getElementById('save-person-btn')?.addEventListener('click', async () => {
    const modal  = document.getElementById('modal-person');
    const editId = modal?.dataset.editId || null;
    const data   = UI.getPersonFormData();

    const saveBtn = document.getElementById('save-person-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Kaydediliyor...';

    try {
      const result = await People.savePerson(data, editId);
      if (result.success) {
        UI.closePersonModal();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error('[App] Save person error:', err);
      alert('Kayıt sırasında hata oluştu.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Kaydet';
    }
  });

  // Cancel person modal
  document.getElementById('cancel-person-btn')?.addEventListener('click', () => {
    UI.closePersonModal();
  });

  // Click outside person modal to close
  document.getElementById('modal-person')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-person') UI.closePersonModal();
  });

  // ══════════════════════════════════════════════════════════
  // SETTINGS
  // ══════════════════════════════════════════════════════════

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    if (!confirm('Çıkış yapmak istediğinize emin misiniz?')) return;
    await Auth.logout();
    UI.closeSettings();
    UI.showScreen('screen-login', 'back');
    // Clear form
    ['login-first-name','login-last-name','login-code'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('login-error').textContent = '';
  });

  // ══════════════════════════════════════════════════════════
  // USERS MODAL (admin)
  // ══════════════════════════════════════════════════════════

  document.getElementById('add-user-btn')?.addEventListener('click', () => {
    const form = document.getElementById('add-user-form');
    form?.classList.toggle('hidden');
  });

  document.getElementById('save-user-btn')?.addEventListener('click', async () => {
    const first = document.getElementById('new-user-first').value;
    const last  = document.getElementById('new-user-last').value;
    const code  = document.getElementById('new-user-code').value;

    const result = await Auth.addUser(first, last, code);
    if (result.success) {
      // Clear form
      document.getElementById('new-user-first').value = '';
      document.getElementById('new-user-last').value  = '';
      document.getElementById('new-user-code').value  = '';
      document.getElementById('add-user-form')?.classList.add('hidden');
      await UI.renderUsersList();
    } else {
      alert(result.error);
    }
  });

  document.getElementById('cancel-user-btn')?.addEventListener('click', () => {
    document.getElementById('add-user-form')?.classList.add('hidden');
  });

  document.getElementById('close-users-btn')?.addEventListener('click', () => {
    UI.closeUsersModal();
  });

  document.getElementById('modal-users')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-users') UI.closeUsersModal();
  });

  // ══════════════════════════════════════════════════════════
  // MAP SCREEN
  // ══════════════════════════════════════════════════════════
  let _mapInitialized = false;

  document.getElementById('map-btn')?.addEventListener('click', () => {
    UI.showScreen('screen-map');
    _initMap();
  });

  document.getElementById('map-back-btn')?.addEventListener('click', () => {
    UI.showScreen('screen-home', 'back');
  });

  document.getElementById('settings-btn-3')?.addEventListener('click', () => UI.openSettings());

  function _initMap() {
    if (_mapInitialized) return;
    if (typeof L === 'undefined') {
      // Leaflet not yet loaded — wait and retry
      setTimeout(_initMap, 500);
      return;
    }
    const mapEl = document.getElementById('leaflet-map');
    if (!mapEl) return;

    const map = L.map('leaflet-map', {
      center: [39.9334, 32.8597], // Ankara
      zoom: 6,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    _mapInitialized = true;

    // Fix map size after screen transition
    setTimeout(() => map.invalidateSize(), 400);
  }

  // ══════════════════════════════════════════════════════════
  // EVENTS SCREEN
  // ══════════════════════════════════════════════════════════

  document.getElementById('events-btn')?.addEventListener('click', async () => {
    UI.showScreen('screen-events');
    await _loadEvents();
    _updateEventAdminUI();
  });

  document.getElementById('events-back-btn')?.addEventListener('click', () => {
    UI.showScreen('screen-home', 'back');
    // Clear badge when user visits events
    _clearEventsBadge();
  });

  document.getElementById('settings-btn-4')?.addEventListener('click', () => UI.openSettings());

  // FAB → open add event modal
  document.getElementById('add-event-fab')?.addEventListener('click', () => {
    _openEventModal(null);
  });

  // Save event
  document.getElementById('save-event-btn')?.addEventListener('click', async () => {
    const modal   = document.getElementById('modal-event');
    const editId  = modal?.dataset.editId || null;
    const title   = document.getElementById('event-title-input')?.value.trim();
    const body    = document.getElementById('event-body-input')?.value.trim();
    const date    = document.getElementById('event-date-input')?.value || null;

    if (!title) { alert('Başlık zorunludur.'); return; }

    const btn = document.getElementById('save-event-btn');
    btn.disabled = true; btn.textContent = 'Yayınlanıyor...';

    try {
      const event = {
        id:        editId || CryptoManager.generateId(),
        title,
        body:      body || '',
        date,
        createdAt: editId
          ? ((await DB.get('events', editId))?.createdAt ?? Date.now())
          : Date.now(),
        authorId: Auth.getUser()?.id
      };
      await DB.saveEvent(event);
      _closeEventModal();
      await _loadEvents();
      // Show badge on home for new events
      if (!editId) _incrementEventsBadge();
    } catch (err) {
      console.error('[App] Save event error:', err);
      alert('Kayıt sırasında hata oluştu.');
    } finally {
      btn.disabled = false; btn.textContent = 'Yayınla';
    }
  });

  document.getElementById('cancel-event-btn')?.addEventListener('click', _closeEventModal);
  document.getElementById('modal-event')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-event') _closeEventModal();
  });

  async function _loadEvents() {
    const listEl  = document.getElementById('events-list');
    const emptyEl = document.getElementById('events-empty');
    if (!listEl) return;

    const events = await DB.getAllEvents();

    if (events.length === 0) {
      listEl.innerHTML = '';
      listEl.appendChild(emptyEl);
      emptyEl?.classList.remove('hidden');
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
          if (!confirm('Bu etkinliği silmek istediğinize emin misiniz?')) return;
          await DB.deleteEvent(btn.dataset.id);
          await _loadEvents();
        });
      });
    }
  }

  function _buildEventCard(ev) {
    const isAdmin = Auth.isAdmin();
    const dateStr = ev.date
      ? new Date(ev.date + 'T00:00:00').toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric' })
      : new Date(ev.createdAt).toLocaleDateString('tr-TR', { day:'numeric', month:'short' });

    const adminActions = isAdmin ? `
      <div class="event-card__admin-row">
        <button class="btn btn--outline btn--sm event-card__edit" data-id="${ev.id}" style="flex:1">Düzenle</button>
        <button class="btn btn--ghost btn--sm event-card__delete" data-id="${ev.id}" style="flex:1;color:#FF3B30">Sil</button>
      </div>` : '';

    return `
      <div class="event-card">
        <div class="event-card__header">
          <p class="event-card__title">${UI._escHtml(ev.title)}</p>
          <span class="event-card__date">${dateStr}</span>
        </div>
        ${ev.body ? `<p class="event-card__body">${UI._escHtml(ev.body)}</p>` : ''}
        ${adminActions}
      </div>`;
  }

  function _openEventModal(evData = null) {
    const modal = document.getElementById('modal-event');
    const title = document.getElementById('modal-event-title');
    if (!modal) return;

    document.getElementById('event-title-input').value = evData?.title || '';
    document.getElementById('event-body-input').value  = evData?.body  || '';
    document.getElementById('event-date-input').value  = evData?.date  || '';

    if (evData) {
      title.textContent = 'Etkinliği Düzenle';
      modal.dataset.editId = evData.id;
    } else {
      title.textContent = 'Etkinlik Ekle';
      delete modal.dataset.editId;
    }

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  }

  function _closeEventModal() {
    const modal = document.getElementById('modal-event');
    if (modal) {
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('modal-overlay--open');
      delete modal.dataset.editId;
    }
  }

  function _updateEventAdminUI() {
    const fab = document.getElementById('add-event-fab');
    if (fab) fab.classList.toggle('hidden', !Auth.isAdmin());
  }

  // Events badge (unread count stored in settings)
  async function _incrementEventsBadge() {
    const count = ((await DB.getSetting('events_badge', 0)) || 0) + 1;
    await DB.setSetting('events_badge', count);
    _showEventsBadge(count);
  }

  async function _clearEventsBadge() {
    await DB.setSetting('events_badge', 0);
    const badge = document.getElementById('events-badge');
    if (badge) badge.classList.add('hidden');
  }

  function _showEventsBadge(count) {
    const badge = document.getElementById('events-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  async function _loadEventsBadge() {
    const count = await DB.getSetting('events_badge', 0);
    _showEventsBadge(count);
  }
  // ══════════════════════════════════════════════════════════
  document.addEventListener('dblclick', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      e.preventDefault();
    }
  }, { passive: false });

  // ══════════════════════════════════════════════════════════
  // Swipe back gesture (iOS-like)
  // ══════════════════════════════════════════════════════════
  let _touchStartX = 0;

  document.addEventListener('touchstart', (e) => {
    _touchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const deltaX = e.changedTouches[0].clientX - _touchStartX;
    // Swipe right from left edge → go back
    if (deltaX > 80 && _touchStartX < 40) {
      const activeScreen = document.querySelector('.screen--active');
      if (activeScreen?.id === 'screen-people') {
        UI.showScreen('screen-home', 'back');
      } else if (activeScreen?.id === 'screen-map') {
        UI.showScreen('screen-home', 'back');
      } else if (activeScreen?.id === 'screen-events') {
        UI.showScreen('screen-home', 'back');
        _clearEventsBadge();
      }
    }
  }, { passive: true });

})();
