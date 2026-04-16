/* ============================================================
   UI — Screen transitions, modals, offline banner, settings
   ============================================================ */

const UI = (() => {
  let _currentScreen = 'screen-splash';

  // ── Social media SVG icons (inline, no network needed) ───
  const SOCIAL_ICONS = {
    instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>`,
    twitter: `<svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>`,
    linkedin: `<svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect x="2" y="9" width="4" height="12"/>
      <circle cx="4" cy="4" r="2"/>
    </svg>`,
    facebook: `<svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>`,
    youtube: `<svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
    </svg>`
  };

  // Social icon colors for the input icons in the modal
  const SOCIAL_COLORS = {
    instagram: '#E1306C',
    twitter:   '#000000',
    linkedin:  '#0077B5',
    facebook:  '#1877F2',
    youtube:   '#FF0000'
  };

  // ── Init ─────────────────────────────────────────────────
  function init() {
    _bindOfflineBanner();
    _bindSettingsModal();
    _bindRippleOnMainBtn();
    _injectSocialIcons();
  }

  // ── Screen transitions ────────────────────────────────────
  function showScreen(screenId, direction = 'forward') {
    const current = document.getElementById(_currentScreen);
    const next    = document.getElementById(screenId);
    if (!next || screenId === _currentScreen) return;

    // Special case: hiding splash — it exits instantly (handled by playSplash)
    // but if showScreen is called for it, just remove active class immediately
    if (_currentScreen === 'screen-splash' && current) {
      current.classList.remove('screen--active');
      current.style.cssText = '';
    }

    // Prepare next screen (starts just offscreen)
    next.style.transition = 'none';
    next.style.transform  = direction === 'forward' ? 'translateX(30px)' : 'translateX(-30px)';
    next.style.opacity    = '0';
    next.classList.add('screen--active');
    next.style.pointerEvents = 'all';

    // Animate in next screen
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        next.style.transition = 'opacity 0.32s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)';
        next.style.transform  = 'translateX(0)';
        next.style.opacity    = '1';
      });
    });

    // Animate out current (only if not splash — splash already hidden)
    if (current && _currentScreen !== 'screen-splash') {
      current.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
      current.style.transform  = direction === 'forward' ? 'translateX(-20px)' : 'translateX(20px)';
      current.style.opacity    = '0';
      setTimeout(() => {
        current.classList.remove('screen--active');
        current.style.cssText = '';
      }, 240);
    }

    _currentScreen = screenId;
  }

  // ── Splash + video ────────────────────────────────────────
  function playSplash(onEnd) {
    const video    = document.getElementById('splash-video');
    const fallback = document.getElementById('splash-fallback');
    const splash   = document.getElementById('screen-splash');

    // Called when intro finishes — instantly hide splash, no opacity fade
    function _exitSplash() {
      if (splash) {
        splash.style.transition = 'none';
        splash.style.opacity    = '0';
        splash.style.pointerEvents = 'none';
        // Small delay to ensure paint before removing active class
        requestAnimationFrame(() => {
          splash.classList.remove('screen--active');
          splash.style.opacity = '';
          splash.style.transition = '';
        });
      }
      onEnd();
    }

    if (!video) { setTimeout(_exitSplash, 2200); return; }

    video.style.display = 'block';
    fallback.style.display = 'none';

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          video.addEventListener('ended', _exitSplash, { once: true });
          setTimeout(() => { if (!video.ended) _exitSplash(); }, 10000);
        })
        .catch(() => {
          video.style.display = 'none';
          fallback.style.display = 'flex';
          setTimeout(_exitSplash, 2200);
        });
    } else {
      video.addEventListener('ended', _exitSplash, { once: true });
      setTimeout(() => { if (!video.ended) _exitSplash(); }, 10000);
    }
  }

  // ── Offline banner ────────────────────────────────────────
  function showOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    banner.classList.add('offline-banner--visible');
    // Auto dismiss after 5s
    setTimeout(() => hideOfflineBanner(), 5000);
  }

  function hideOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.classList.remove('offline-banner--visible');
  }

  function _bindOfflineBanner() {
    const closeBtn = document.getElementById('close-banner-btn');
    if (closeBtn) closeBtn.addEventListener('click', hideOfflineBanner);
  }

  // ── Shake animation for login errors ─────────────────────
  function shakeLoginForm() {
    const card = document.querySelector('.login__form-card');
    if (!card) return;
    card.classList.remove('anim-shake');
    void card.offsetWidth; // reflow
    card.classList.add('anim-shake');
    setTimeout(() => card.classList.remove('anim-shake'), 600);
  }

  // ── Settings modal ────────────────────────────────────────
  function openSettings() {
    const modal = document.getElementById('modal-settings');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');

    // Mark active theme
    const current = document.documentElement.getAttribute('data-theme') || 'default';
    modal.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === current);
    });

    // Show/hide admin section
    const adminSection = document.getElementById('admin-section');
    if (adminSection) adminSection.classList.toggle('hidden', !Auth.isAdmin());
  }

  function closeSettings() {
    const modal = document.getElementById('modal-settings');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('modal-overlay--open');
  }

  function _bindSettingsModal() {
    // Open buttons
    ['settings-btn', 'settings-btn-2', 'settings-btn-3', 'settings-btn-4'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', openSettings);
    });

    // Close button
    document.getElementById('close-settings-btn')?.addEventListener('click', closeSettings);

    // Click outside to close
    document.getElementById('modal-settings')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-settings') closeSettings();
    });

    // Theme buttons
    document.querySelectorAll('.theme-option[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        setTheme(btn.dataset.theme);
        // Update active state
        document.querySelectorAll('.theme-option[data-theme]').forEach(b =>
          b.classList.toggle('active', b.dataset.theme === btn.dataset.theme)
        );
      });
    });

    // Manage users button
    document.getElementById('manage-users-btn')?.addEventListener('click', () => {
      closeSettings();
      setTimeout(() => openUsersModal(), 200);
    });
  }

  // ── Theme ─────────────────────────────────────────────────
  async function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    await DB.setSetting('theme', theme);
    // Update PWA theme-color meta
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const colors = { default: '#1B2E6E', dark: '#0D0D0F', light: '#FFFFFF' };
      meta.setAttribute('content', colors[theme] || '#1B2E6E');
    }
  }

  async function loadTheme() {
    const theme = await DB.getSetting('theme', 'default');
    document.documentElement.setAttribute('data-theme', theme);
  }

  // ── Person modal ──────────────────────────────────────────
  function openPersonModal(personData = null) {
    const modal  = document.getElementById('modal-person');
    const title  = document.getElementById('modal-person-title');
    if (!modal) return;

    // Clear form
    _clearPersonForm();

    if (personData) {
      title.textContent = 'Kişiyi Düzenle';
      _fillPersonForm(personData);
      modal.dataset.editId = personData.id;
    } else {
      title.textContent = 'Kişi Ekle';
      delete modal.dataset.editId;
    }

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  }

  function closePersonModal() {
    const modal = document.getElementById('modal-person');
    if (modal) {
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('modal-overlay--open');
      delete modal.dataset.editId;
    }
  }

  function _clearPersonForm() {
    ['person-first-name','person-last-name','person-desc',
     'person-instagram','person-twitter','person-linkedin',
     'person-facebook','person-youtube'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const img = document.getElementById('photo-preview-img');
    const circle = document.getElementById('photo-preview-circle');
    if (img) { img.src = ''; img.hidden = true; }
    if (circle) circle.dataset.photoBase64 = '';
    document.getElementById('photo-remove-btn')?.setAttribute('hidden', '');
  }

  function _fillPersonForm(p) {
    document.getElementById('person-first-name').value = p.firstName || '';
    document.getElementById('person-last-name').value  = p.lastName  || '';
    document.getElementById('person-desc').value       = p.description || '';
    document.getElementById('person-instagram').value  = p.socials?.instagram || '';
    document.getElementById('person-twitter').value    = p.socials?.twitter   || '';
    document.getElementById('person-linkedin').value   = p.socials?.linkedin  || '';
    document.getElementById('person-facebook').value   = p.socials?.facebook  || '';
    document.getElementById('person-youtube').value    = p.socials?.youtube   || '';

    if (p.photoBase64) {
      const img    = document.getElementById('photo-preview-img');
      const circle = document.getElementById('photo-preview-circle');
      if (img) { img.src = p.photoBase64; img.hidden = false; }
      if (circle) circle.dataset.photoBase64 = p.photoBase64;
      document.getElementById('photo-remove-btn')?.removeAttribute('hidden');
    }
  }

  function getPersonFormData() {
    const circle = document.getElementById('photo-preview-circle');
    return {
      firstName:   document.getElementById('person-first-name').value.trim(),
      lastName:    document.getElementById('person-last-name').value.trim(),
      description: document.getElementById('person-desc').value.trim(),
      photoBase64: circle?.dataset.photoBase64 || '',
      socials: {
        instagram: document.getElementById('person-instagram').value.trim() || null,
        twitter:   document.getElementById('person-twitter').value.trim()   || null,
        linkedin:  document.getElementById('person-linkedin').value.trim()  || null,
        facebook:  document.getElementById('person-facebook').value.trim()  || null,
        youtube:   document.getElementById('person-youtube').value.trim()   || null
      }
    };
  }

  // ── Photo upload ──────────────────────────────────────────
  function bindPhotoUpload() {
    const photoBtn    = document.getElementById('photo-btn');
    const photoInput  = document.getElementById('photo-input');
    const removeBtn   = document.getElementById('photo-remove-btn');

    photoBtn?.addEventListener('click', () => photoInput?.click());
    removeBtn?.addEventListener('click', () => {
      const img    = document.getElementById('photo-preview-img');
      const circle = document.getElementById('photo-preview-circle');
      if (img)    { img.src = ''; img.hidden = true; }
      if (circle) circle.dataset.photoBase64 = '';
      removeBtn.setAttribute('hidden', '');
    });

    photoInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result;
        // Resize to max 300x300 to keep DB lean
        _resizeImage(base64, 300, (resized) => {
          const img    = document.getElementById('photo-preview-img');
          const circle = document.getElementById('photo-preview-circle');
          if (img)    { img.src = resized; img.hidden = false; }
          if (circle) circle.dataset.photoBase64 = resized;
          document.getElementById('photo-remove-btn')?.removeAttribute('hidden');
        });
      };
      reader.readAsDataURL(file);
      photoInput.value = ''; // reset input
    });
  }

  function _resizeImage(base64, maxSize, callback) {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
      else       { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64;
  }

  // ── Users modal ───────────────────────────────────────────
  async function openUsersModal() {
    const modal = document.getElementById('modal-users');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
    await renderUsersList();
  }

  function closeUsersModal() {
    const modal = document.getElementById('modal-users');
    if (modal) {
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('modal-overlay--open');
      document.getElementById('add-user-form')?.classList.add('hidden');
    }
  }

  async function renderUsersList() {
    const list = document.getElementById('users-list');
    if (!list) return;
    const users = await Auth.getAllUsers();
    list.innerHTML = '';
    if (users.length === 0) {
      list.innerHTML = '<p style="color:var(--color-text-secondary);font-size:14px;padding:12px 0">Henüz kullanıcı yok.</p>';
      return;
    }
    users.forEach(u => {
      const row = document.createElement('div');
      row.className = 'user-row';
      row.innerHTML = `
        <span class="user-row__name">${_escHtml(u.firstName)} ${_escHtml(u.lastName)}</span>
        ${u.isAdmin ? '<span class="user-row__badge">Admin</span>' : ''}
        ${!u.isAdmin ? `<button class="user-row__delete" data-id="${u.id}" aria-label="Sil">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>` : ''}
      `;
      list.appendChild(row);
    });

    list.querySelectorAll('.user-row__delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
        await Auth.deleteUser(btn.dataset.id);
        await renderUsersList();
      });
    });
  }

  // ── Ripple on main action button ─────────────────────────
  function _bindRippleOnMainBtn() {
    const btn = document.getElementById('main-action-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      const core = btn.querySelector('.main-action-btn__core');
      if (!core) return;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const size = Math.max(core.offsetWidth, core.offsetHeight);
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${(core.offsetWidth-size)/2}px;top:${(core.offsetHeight-size)/2}px`;
      core.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });
  }

  // ── Inject social icons into form ─────────────────────────
  function _injectSocialIcons() {
    document.querySelectorAll('.social-input-icon[data-platform]').forEach(el => {
      const platform = el.dataset.platform;
      el.innerHTML = SOCIAL_ICONS[platform] || '';
      el.style.color = SOCIAL_COLORS[platform] || 'currentColor';
    });
  }

  // ── Build social links for a card ────────────────────────
  function buildSocialLinks(socials = {}) {
    let html = '';
    Object.entries(socials).forEach(([platform, url]) => {
      if (!url) return;
      html += `
        <a href="${_escAttr(url)}" target="_blank" rel="noopener noreferrer"
           class="social-link" aria-label="${platform}" style="color:${SOCIAL_COLORS[platform]||'currentColor'}">
          ${SOCIAL_ICONS[platform] || ''}
        </a>`;
    });
    return html;
  }

  // ── Escape helpers ────────────────────────────────────────
  function _escHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function _escAttr(str) { return _escHtml(str); }

  // ── Password toggle ───────────────────────────────────────
  function bindPasswordToggle() {
    const btn   = document.getElementById('toggle-password');
    const input = document.getElementById('login-code');
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  }

  return {
    init, showScreen, playSplash,
    showOfflineBanner, hideOfflineBanner, shakeLoginForm,
    openSettings, closeSettings, setTheme, loadTheme,
    openPersonModal, closePersonModal, getPersonFormData, bindPhotoUpload,
    openUsersModal, closeUsersModal, renderUsersList,
    bindPasswordToggle,
    buildSocialLinks, SOCIAL_ICONS, SOCIAL_COLORS,
    _escHtml
  };
})();

// ═══════════════════════════════════════════════════════════
// ADDED: Welcome Popup, See More, Map modals
// ═══════════════════════════════════════════════════════════

const UIExtended = {

  // ── Welcome Popups ────────────────────────────────────────
  _popupQueue: [],
  _popupActive: false,

  showWelcomePopups() {
    const popups = APP_CONFIG?.popups || [];
    this._popupQueue = [...popups];
    this._nextPopup();
  },

  _nextPopup() {
    if (this._popupQueue.length === 0) { this._popupActive = false; return; }
    const popup = this._popupQueue.shift();
    this._popupActive = true;
    const modal   = document.getElementById('modal-welcome');
    const img     = document.getElementById('welcome-img');
    const title   = document.getElementById('welcome-title');
    const desc    = document.getElementById('welcome-desc');
    const closeBtn = document.getElementById('welcome-close-btn');

    if (img)   { img.src = popup.image || ''; img.alt = popup.title || ''; }
    if (title) title.textContent = popup.title || '';
    if (desc)  desc.textContent  = popup.description || '';

    modal?.setAttribute('aria-hidden', 'false');
    modal?.classList.add('modal-overlay--open');

    const onClose = () => {
      modal?.setAttribute('aria-hidden', 'true');
      modal?.classList.remove('modal-overlay--open');
      closeBtn?.removeEventListener('click', onClose);
      // Show next popup after 500ms
      if (this._popupQueue.length > 0) {
        setTimeout(() => this._nextPopup(), 500);
      }
    };
    closeBtn?.addEventListener('click', onClose);
  },

  // ── See More Modal ────────────────────────────────────────
  _seeMorePerson: null,

  openSeeMoreModal(person) {
    this._seeMorePerson = person;
    const modal = document.getElementById('modal-see-more');
    if (!modal) return;

    // Photo
    const photoWrap = document.getElementById('see-more-photo');
    if (photoWrap) {
      const src = person.photoURL || person.photoBase64;
      if (src) {
        photoWrap.innerHTML = `<img src="${src}" alt="${UI._escHtml(person.firstName)}" style="width:100%;height:100%;object-fit:cover">`;
      } else {
        const initials = `${person.firstName?.[0]||''}${person.lastName?.[0]||''}`.toUpperCase();
        photoWrap.innerHTML = `<div class="see-more__photo-initials">${initials}</div>`;
      }
    }

    document.getElementById('see-more-name').textContent = `${person.firstName} ${person.lastName}`;
    document.getElementById('see-more-desc').textContent = person.description || '';

    // Notes
    const notesSection = document.getElementById('see-more-notes-section');
    const notesText    = document.getElementById('see-more-notes');
    if (person.notes) {
      notesSection?.classList.remove('hidden');
      if (notesText) notesText.textContent = person.notes;
    } else {
      notesSection?.classList.add('hidden');
    }

    // Socials
    const socialsRow = document.getElementById('see-more-socials-row');
    if (socialsRow) socialsRow.innerHTML = UI.buildSocialLinks(person.socials || {});

    // Admin: show notes editor
    const adminRow = document.getElementById('see-more-admin-row');
    const notesInput = document.getElementById('see-more-notes-input');
    if (Auth.isAdmin()) {
      adminRow?.classList.remove('hidden');
      if (notesInput) notesInput.value = person.notes || '';
    } else {
      adminRow?.classList.add('hidden');
    }

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  },

  closeSeeMoreModal() {
    const modal = document.getElementById('modal-see-more');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
    this._seeMorePerson = null;
  },

  getSeeMorePerson() { return this._seeMorePerson; },

  // ── Map Action Menu ───────────────────────────────────────
  _pendingLatLng: null,

  showMapActionModal(latlng) {
    this._pendingLatLng = latlng;
    const modal = document.getElementById('modal-map-action');
    modal?.setAttribute('aria-hidden', 'false');
    modal?.classList.add('modal-overlay--open');
  },

  closeMapActionModal() {
    document.getElementById('modal-map-action')?.setAttribute('aria-hidden', 'true');
    document.getElementById('modal-map-action')?.classList.remove('modal-overlay--open');
  },

  getPendingLatLng() { return this._pendingLatLng; },

  // ── Map Pin Modal ─────────────────────────────────────────
  _selectedPinIcon: 'hq',

  openMapPinModal(latlng) {
    this._pendingLatLng = latlng;
    this._selectedPinIcon = 'hq';
    document.getElementById('pin-title-input').value = '';
    document.getElementById('pin-desc-input').value  = '';
    document.getElementById('pin-publish-select').value = 'now';
    document.getElementById('pin-delete-select').value  = 'never';
    document.getElementById('pin-publish-custom')?.classList.add('hidden');
    document.getElementById('pin-delete-custom')?.classList.add('hidden');
    this._buildIconPicker();
    const modal = document.getElementById('modal-map-pin');
    modal?.setAttribute('aria-hidden', 'false');
    modal?.classList.add('modal-overlay--open');
  },

  closeMapPinModal() {
    document.getElementById('modal-map-pin')?.setAttribute('aria-hidden', 'true');
    document.getElementById('modal-map-pin')?.classList.remove('modal-overlay--open');
  },

  _buildIconPicker() {
    const picker = document.getElementById('pin-icon-picker');
    if (!picker) return;
    picker.innerHTML = (APP_CONFIG?.mapIcons || []).map(ic => `
      <button class="pin-icon-option ${ic.id === this._selectedPinIcon ? 'selected' : ''}"
              data-icon="${ic.id}" type="button">
        ${ic.emoji}<span class="label">${ic.label}</span>
      </button>`).join('');
    picker.querySelectorAll('.pin-icon-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this._selectedPinIcon = btn.dataset.icon;
        picker.querySelectorAll('.pin-icon-option').forEach(b => b.classList.toggle('selected', b === btn));
      });
    });
  },

  getSelectedPinIcon() { return this._selectedPinIcon; },

  getPinSchedule() {
    const publishSel = document.getElementById('pin-publish-select')?.value;
    const deleteSel  = document.getElementById('pin-delete-select')?.value;
    const now = Date.now();
    const _offset = { '1d': 86400000, '3d': 259200000, '1w': 604800000, '2w': 1209600000, '1m': 2592000000 };

    let publishAt = now;
    if (publishSel === 'custom') {
      const v = document.getElementById('pin-publish-custom')?.value;
      publishAt = v ? new Date(v).getTime() : now;
    } else if (_offset[publishSel]) {
      publishAt = now + _offset[publishSel];
    }

    let deleteAt = null;
    if (deleteSel === 'custom') {
      const v = document.getElementById('pin-delete-custom')?.value;
      deleteAt = v ? new Date(v).getTime() : null;
    } else if (_offset[deleteSel]) {
      deleteAt = now + _offset[deleteSel];
    }

    return { publishAt, deleteAt };
  },

  // ── Notify Modal ──────────────────────────────────────────
  openNotifyModal() {
    document.getElementById('notify-title-input').value = '';
    document.getElementById('notify-body-input').value  = '';
    const modal = document.getElementById('modal-notify');
    modal?.setAttribute('aria-hidden', 'false');
    modal?.classList.add('modal-overlay--open');
  },

  closeNotifyModal() {
    document.getElementById('modal-notify')?.setAttribute('aria-hidden', 'true');
    document.getElementById('modal-notify')?.classList.remove('modal-overlay--open');
  }
};

// Expose UIExtended methods on the UI object
Object.assign(UI, UIExtended);
