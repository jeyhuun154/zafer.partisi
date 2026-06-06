/* ============================================================
   UI — Screen transitions, modals, offline banner, settings
   ============================================================ */

const UI = (() => {
  let _currentScreen = 'screen-splash'; 
  let _pendingPhotoBase64 = '';

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

    // Render wallpaper grid (async, non-blocking)
    if (typeof WallpaperManager !== 'undefined') {
      WallpaperManager.renderGrid().catch(() => {});
    }
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

    // Clear form first
    _clearPersonForm();

    if (personData) {
      if (title) title.textContent = 'Kişiyi Düzenle';
      _fillPersonForm(personData);
      modal.dataset.editId = personData.id;
    } else {
      if (title) title.textContent = 'Kişi Ekle';
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
    _pendingPhotoBase64 = '';
    const urlInput = document.getElementById('person-photo-url');
    if (urlInput) urlInput.value = '';
    const preview = document.getElementById('photo-url-preview');
    if (preview) preview.style.display = 'none';
    // Clear extra links
    const extraContainer = document.getElementById('extra-links-container');
    if (extraContainer) extraContainer.innerHTML = '';
    const removeBtn = document.getElementById('photo-remove-btn');
    if (removeBtn) removeBtn.setAttribute('hidden', '');
  }

  function _fillPersonForm(p) {
    const firstNameEl = document.getElementById('person-first-name');
    const lastNameEl = document.getElementById('person-last-name');
    const descEl = document.getElementById('person-desc');
    const instagramEl = document.getElementById('person-instagram');
    const twitterEl = document.getElementById('person-twitter');
    const linkedinEl = document.getElementById('person-linkedin');
    const facebookEl = document.getElementById('person-facebook');
    const youtubeEl = document.getElementById('person-youtube');

    if (firstNameEl) firstNameEl.value = p.firstName || '';
    if (lastNameEl) lastNameEl.value = p.lastName || '';
    if (descEl) descEl.value = p.description || '';
    if (instagramEl) instagramEl.value = p.socials?.instagram || '';
    if (twitterEl) twitterEl.value = p.socials?.twitter || '';
    if (linkedinEl) linkedinEl.value = p.socials?.linkedin || '';
    if (facebookEl) facebookEl.value = p.socials?.facebook || '';
    if (youtubeEl) youtubeEl.value = p.socials?.youtube || '';

    const photoSrc = p.photoURL || p.photoBase64 || '';
    const urlInput2 = document.getElementById('person-photo-url');
    if (urlInput2) urlInput2.value = photoSrc;
    if (photoSrc) {
      const preview = document.getElementById('photo-url-preview');
      const previewImg = document.getElementById('photo-url-img');
      if (previewImg) previewImg.src = photoSrc;
      if (preview) preview.style.display = 'flex';
    }
    // Fill extra links
    const extraLinks = p.socials?.extraLinks || [];
    _initExtraLinks(extraLinks);
  }

  function getPersonFormData() {
    const circle = document.getElementById('photo-preview-circle');
    const firstNameEl = document.getElementById('person-first-name');
    const lastNameEl = document.getElementById('person-last-name');
    const descEl = document.getElementById('person-desc');
    const instagramEl = document.getElementById('person-instagram');
    const twitterEl = document.getElementById('person-twitter');
    const linkedinEl = document.getElementById('person-linkedin');
    const facebookEl = document.getElementById('person-facebook');
    const youtubeEl = document.getElementById('person-youtube');

    return {
      firstName:   firstNameEl ? firstNameEl.value.trim() : '',
      lastName:    lastNameEl ? lastNameEl.value.trim() : '',
      description: descEl ? descEl.value.trim() : '',
      photoURL:    document.getElementById('person-photo-url')?.value.trim() || '',
      photoBase64: '',
      extraLinks:  _getExtraLinks(),
      socials: {
        instagram: instagramEl ? (instagramEl.value.trim() || null) : null,
        twitter:   twitterEl ? (twitterEl.value.trim() || null) : null,
        linkedin:  linkedinEl ? (linkedinEl.value.trim() || null) : null,
        facebook:  facebookEl ? (facebookEl.value.trim() || null) : null,
        youtube:   youtubeEl ? (youtubeEl.value.trim() || null) : null
      }
    };
  }

  function bindPhotoUpload() {
    const urlInput = document.getElementById('person-photo-url');
    const preview  = document.getElementById('photo-url-preview');
    const img      = document.getElementById('photo-url-img');
    if (!urlInput) return;
    urlInput.addEventListener('input', () => {
      const url = urlInput.value.trim();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        if (img)     img.src = url;
        if (preview) preview.style.display = 'flex';
      } else {
        if (preview) preview.style.display = 'none';
      }
    });
  }

  function _initExtraLinks(existingLinks = []) {
    const container = document.getElementById('extra-links-container');
    const addBtn    = document.getElementById('add-extra-link-btn');
    if (!container) return;
    container.innerHTML = '';
    (existingLinks || []).forEach(link => _addExtraLinkRow(link.label, link.url));
    if (addBtn) addBtn.onclick = () => _addExtraLinkRow('', '');
  }

  function _addExtraLinkRow(label = '', url = '') {
    const container = document.getElementById('extra-links-container');
    if (!container) return;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-top:6px;align-items:center';
    row.innerHTML = `
      <input type="text" class="form-input form-input--sm extra-link-label"
             placeholder="Etiket (ör. Web Sitesi)" value="${_escHtml(label)}" style="flex:1">
      <input type="url" class="form-input form-input--sm extra-link-url"
             placeholder="https://..." value="${_escHtml(url)}" style="flex:2">
      <button type="button" class="rm-extra-link"
              style="background:none;border:none;color:#FF3B30;cursor:pointer;
                     padding:4px;font-size:18px;line-height:1;flex-shrink:0">✕</button>`;
    row.querySelector('.rm-extra-link').onclick = () => row.remove();
    container.appendChild(row);
  }

  function _getExtraLinks() {
    return Array.from(document.querySelectorAll('#extra-links-container > div')).map(row => ({
      label: row.querySelector('.extra-link-label')?.value.trim() || '',
      url:   row.querySelector('.extra-link-url')?.value.trim()   || ''
    })).filter(l => l.url);
  }

  // ── Users modal ───────────────────────────────────────────
  async function openUsersModal() {
    const modal = document.getElementById('modal-users');
    if (!modal) return;
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) addUserForm.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
    await renderUsersList();
  }

  function closeUsersModal() {
    const modal = document.getElementById('modal-users');
    if (modal) {
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('modal-overlay--open');
      const addUserForm = document.getElementById('add-user-form');
      if (addUserForm) addUserForm.classList.add('hidden');
    }
  }

  async function renderUsersList() {
    const list = document.getElementById('users-list');
    if (!list) return;
    const users = await Auth.getAllUsers();
    const me = Auth.getUser ? Auth.getUser() : null;
    list.innerHTML = '';
    if (!users || users.length === 0) {
      list.innerHTML = '<p style="color:var(--color-text-secondary);font-size:14px;padding:12px 0">Henüz kullanıcı yok.</p>';
      return;
    }
    users.forEach(u => {
      if (u.id === me?.id) return;
      const uIsAdmin = u.isAdmin;
      const row = document.createElement('div');
      row.className = 'user-row';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 14px';
      row.innerHTML = `
        <span class="user-row__name" style="flex:1">${_escHtml(u.firstName)} ${_escHtml(u.lastName)}</span>
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
    const iAmSuper = Auth.isSuperAdmin && Auth.isSuperAdmin();
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
        ${_escHtml(user.firstName)} ${_escHtml(user.lastName)}
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
          if (r.success) { _showToast('Terfi isteği üst yetkiliye gönderildi'); renderUsersList(); }
          else alert(r.error);
        } else if (item.action === 'revoke') {
          if (!confirm('Adminliği almak istiyor musunuz?')) return;
          const r = await Auth.setAdminStatus(user.id, false);
          if (r.success) renderUsersList(); else alert(r.error);
        } else if (item.action === 'transfer') {
          if (!confirm(`Üst düzey admin yetkisini ${user.firstName}'a transfer etmek istiyor musunuz? Bu geri alınamaz.`)) return;
          const r = await Auth.transferSuperAdmin(user.id);
          if (r.success) { renderUsersList(); } else alert(r.error);
        } else if (item.action === 'reset') {
          const newCode = prompt('Yeni kod:');
          if (!newCode?.trim()) return;
          await Auth.resetUserCode(user.id, newCode);
          _showToast('Kod sıfırlandı ✓');
        } else if (item.action === 'delete') {
          if (!confirm(`${user.firstName} ${user.lastName} silinmek üzere işaretlenecek. Üst yetkili onayına sunulacaktır. Onaylıyor musunuz?`)) return;
          const r = await Auth.requestDeleteUser(user.id);
          if (r.success) { _showToast('Silme isteği üst yetkiliye gönderildi'); renderUsersList(); }
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
        <span class="user-detail__value">${_escHtml(String(val))}</span>
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

  // ── Ripple on main action button ─────────────────────────  // ── Ripple on main action button ─────────────────────────
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

  function buildSocialLinks(socials = {}) {
    let html = '';
    Object.entries(socials).forEach(([platform, url]) => {
      if (!url || platform === 'extraLinks') return;
      html += `
        <a href="${_escAttr(url)}" target="_blank" rel="noopener noreferrer"
           class="social-link" aria-label="${platform}" style="color:${SOCIAL_COLORS[platform]||'currentColor'}">
          ${SOCIAL_ICONS[platform] || ''}
        </a>`;
    });
    // Extra custom links
    if (Array.isArray(socials?.extraLinks)) {
      socials.extraLinks.forEach(link => {
        if (!link?.url) return;
        html += `<a href="${_escAttr(link.url)}" target="_blank" rel="noopener noreferrer"
          class="social-link" aria-label="${_escHtml(link.label||'Link')}"
          style="color:var(--color-text-secondary);width:auto;padding:0 8px;border-radius:8px;
                 font-size:11px;font-weight:600;gap:4px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;flex-shrink:0">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          ${_escHtml(link.label||'Link')}
        </a>`;
      });
    }
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
    _escHtml, _showToast
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
      } else {
        this._popupActive = false;
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

    const nameEl = document.getElementById('see-more-name');
    const descEl = document.getElementById('see-more-desc');
    if (nameEl) nameEl.textContent = `${person.firstName} ${person.lastName}`;
    if (descEl) descEl.textContent = person.description || '';

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
    const modal = document.getElementById('modal-map-action');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
  },

  getPendingLatLng() { return this._pendingLatLng; },

  // ── Map Pin Modal ─────────────────────────────────────────
  _selectedPinIcon: 'hq',

  openMapPinModal(latlng) {
    this._pendingLatLng = latlng;
    this._selectedPinIcon = 'hq';
    
    const titleInput = document.getElementById('pin-title-input');
    const descInput = document.getElementById('pin-desc-input');
    const publishSelect = document.getElementById('pin-publish-select');
    const deleteSelect = document.getElementById('pin-delete-select');
    const publishCustom = document.getElementById('pin-publish-custom');
    const deleteCustom = document.getElementById('pin-delete-custom');
    
    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    if (publishSelect) publishSelect.value = 'now';
    if (deleteSelect) deleteSelect.value = 'never';
    publishCustom?.classList.add('hidden');
    deleteCustom?.classList.add('hidden');
    
    this._buildIconPicker();
    
    const modal = document.getElementById('modal-map-pin');
    modal?.setAttribute('aria-hidden', 'false');
    modal?.classList.add('modal-overlay--open');
  },

  closeMapPinModal() {
    const modal = document.getElementById('modal-map-pin');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
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
    const titleInput = document.getElementById('notify-title-input');
    const bodyInput = document.getElementById('notify-body-input');
    if (titleInput) titleInput.value = '';
    if (bodyInput) bodyInput.value = '';
    
    const modal = document.getElementById('modal-notify');
    modal?.setAttribute('aria-hidden', 'false');
    modal?.classList.add('modal-overlay--open');
  },

  closeNotifyModal() {
    const modal = document.getElementById('modal-notify');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
  },

  // ── Event Detail Modal ────────────────────────────────────
  _currentEvent: null,

  openEventDetail(event) {
    this._currentEvent = event;
    const modal = document.getElementById('modal-event-detail');
    if (!modal) return;

    document.getElementById('event-detail-title').textContent = event.title || '';
    const dateEl = document.getElementById('event-detail-date');
    if (event.date) {
      dateEl.textContent = new Date(event.date + 'T00:00:00').toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
    } else {
      dateEl.textContent = new Date(event.createdAt).toLocaleDateString('tr-TR', { day:'numeric', month:'long' });
    }
    document.getElementById('event-detail-body').textContent = event.body || '';

    const gallery = document.getElementById('event-detail-gallery');
    const photos = event.photos || [];
    gallery.innerHTML = photos.map((url, idx) => `
      <div style="position:relative;flex-shrink:0">
        <img src="${UI._escHtml(url)}" alt="" data-lightbox-url="${UI._escHtml(url)}" style="height:160px;width:auto;border-radius:12px;object-fit:cover;cursor:pointer;background:var(--color-surface-elevated)">
        ${Auth.isAdmin() ? `<button class="event-photo-del-btn" data-idx="${idx}" aria-label="Fotoğrafı sil" title="Fotoğrafı sil"
          style="position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:8px;border:none;background:rgba(255,59,48,0.85);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/></svg>
        </button>` : ''}
      </div>`).join('');

    // Bind lightbox on images via delegation (safe — no inline JS)
    gallery.querySelectorAll('img[data-lightbox-url]').forEach(img => {
      img.addEventListener('click', () => UI.openLightbox(img.dataset.lightboxUrl));
    });

    // Bind photo delete buttons (admin only)
    if (Auth.isAdmin()) {
      gallery.querySelectorAll('.event-photo-del-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Bu fotoğrafı silmek istiyor musunuz?')) return;
          const idx = parseInt(btn.dataset.idx);
          const newPhotos = photos.filter((_, i) => i !== idx);
          // Also remove from featuredPhotos if present
          const featuredList = (event.featuredPhotos || (event.featuredPhoto ? [event.featuredPhoto] : [])).filter(u => u !== photos[idx]);
          try {
            await FirebaseService.setDoc('events', event.id, {
              photos: newPhotos,
              featuredPhotos: featuredList,
              featuredPhoto: featuredList[0] || null
            });
            UI.openEventDetail({ ...event, photos: newPhotos, featuredPhotos: featuredList, featuredPhoto: featuredList[0] || null });
          } catch (err) { alert('Hata: ' + (err.message || err)); }
        });
      });
    }

    const linksContainer = document.getElementById('event-detail-links');
    const links = event.links || [];
    this._renderEventLinks(linksContainer, links, event);

    const adminSection = document.getElementById('event-detail-admin');
    if (Auth.isAdmin()) {
      adminSection.classList.remove('hidden');
      document.getElementById('event-detail-photo-input').value = '';
      document.getElementById('event-detail-link-input').value = '';
      document.getElementById('event-detail-link-label').value = '';
      this._buildFeaturedPicker(event);
    } else {
      adminSection.classList.add('hidden');
    }

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  },

  // ── Event links renderer (with edit/delete for admins) ───
  _renderEventLinks(container, links, event) {
    if (!container) return;
    if (!links || !links.length) { container.innerHTML = ''; return; }
    container.innerHTML = '';
    links.forEach((l, idx) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px';

      const link = document.createElement('a');
      link.href = UI._escHtml(l.url);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = '🔗 ' + (l.label || l.url);
      link.style.cssText = 'flex:1;display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--color-primary-subtle);border-radius:12px;color:var(--color-primary);text-decoration:none;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      wrap.appendChild(link);

      if (Auth.isAdmin()) {
        const editBtn = document.createElement('button');
        editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        editBtn.style.cssText = 'flex-shrink:0;width:32px;height:32px;border-radius:8px;border:none;background:var(--color-surface-elevated);color:var(--color-text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center';
        editBtn.title = 'Düzenle';
        editBtn.onclick = () => this._editEventLink(event, idx);
        wrap.appendChild(editBtn);

        const delBtn = document.createElement('button');
        delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/></svg>`;
        delBtn.style.cssText = 'flex-shrink:0;width:32px;height:32px;border-radius:8px;border:none;background:var(--color-surface-elevated);color:#FF3B30;cursor:pointer;display:flex;align-items:center;justify-content:center';
        delBtn.title = 'Sil';
        delBtn.onclick = () => this._deleteEventLink(event, idx);
        wrap.appendChild(delBtn);
      }
      container.appendChild(wrap);
    });
  },

  async _editEventLink(event, idx) {
    const link = (event.links || [])[idx];
    if (!link) return;
    const newLabel = prompt('Link başlığı:', link.label || '');
    if (newLabel === null) return;
    const newUrl = prompt('Link URL:', link.url || '');
    if (newUrl === null) return;
    const links = [...(event.links || [])];
    links[idx] = { label: newLabel.trim() || newUrl, url: newUrl.trim() };
    try {
      await FirebaseService.setDoc('events', event.id, { links });
      this.openEventDetail({ ...event, links });
    } catch (e) { alert('Hata: ' + (e.message || e)); }
  },

  async _deleteEventLink(event, idx) {
    if (!confirm('Bu linki silmek istiyor musunuz?')) return;
    const links = (event.links || []).filter((_, i) => i !== idx);
    try {
      await FirebaseService.setDoc('events', event.id, { links });
      this.openEventDetail({ ...event, links });
    } catch (e) { alert('Hata: ' + (e.message || e)); }
  },

  // ── Featured photo picker ─────────────────────────────────
  _buildFeaturedPicker(event) {
    const picker = document.getElementById('event-featured-picker');
    if (!picker) return;
    const photos = event.photos || [];
    const featuredList = event.featuredPhotos || (event.featuredPhoto ? [event.featuredPhoto] : []);
    if (!photos.length) {
      picker.innerHTML = '<p style="font-size:12px;color:var(--color-text-secondary)">Henüz fotoğraf yok. Önce fotoğraf ekleyin.</p>';
      return;
    }
    picker.innerHTML = '';
    photos.forEach(url => {
      const isFeatured = featuredList.includes(url);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = [
        'position:relative;width:72px;height:72px;border-radius:10px;overflow:hidden;',
        'border:3px solid ' + (isFeatured ? 'var(--color-primary)' : 'var(--color-border)') + ';',
        'cursor:pointer;background:var(--color-surface-elevated);padding:0;flex-shrink:0;',
        'transition:border-color 0.18s'
      ].join('');
      btn.title = isFeatured ? '⭐ Öne çıkarıldı — kaldırmak için tıkla' : 'Öne çıkar';
      btn.dataset.url = url;
      btn.dataset.featured = isFeatured ? '1' : '0';

      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      btn.appendChild(img);

      if (isFeatured) {
        const star = document.createElement('div');
        star.textContent = '⭐';
        star.style.cssText = 'position:absolute;bottom:2px;right:2px;font-size:14px;line-height:1;pointer-events:none';
        btn.appendChild(star);
      }

      btn.onclick = () => this._toggleFeaturedPhoto(event, url, btn, picker);
      picker.appendChild(btn);
    });
  },

  async _toggleFeaturedPhoto(event, url, btn, picker) {
    const isFeatured = btn.dataset.featured === '1';
    let featuredList = [...(event.featuredPhotos || (event.featuredPhoto ? [event.featuredPhoto] : []))];

    if (isFeatured) {
      featuredList = featuredList.filter(u => u !== url);
    } else {
      if (!featuredList.includes(url)) featuredList.push(url);
    }

    const updateData = {
      featuredPhotos: featuredList,
      featuredPhoto: featuredList[0] || null
    };
    try {
      await FirebaseService.setDoc('events', event.id, updateData);
      const updated = { ...event, ...updateData };
      this._currentEvent = updated;
      this._buildFeaturedPicker(updated);
      UI._showToast(isFeatured ? 'Öne çıkarmadan kaldırıldı' : 'Öne çıkan fotoğraf eklendi ⭐');
    } catch (e) { alert('Hata: ' + (e.message || e)); }
  },

  closeEventDetail() {
    const modal = document.getElementById('modal-event-detail');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
    this._currentEvent = null;
  },

  getCurrentEvent() { return this._currentEvent; },

  // ── Lightbox ──────────────────────────────────────────────
  openLightbox(src) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (img) img.src = src;
    lb?.classList.add('lightbox--open');
    lb?.setAttribute('aria-hidden', 'false');
  },

  closeLightbox() {
    const lb = document.getElementById('lightbox');
    lb?.classList.remove('lightbox--open');
    lb?.setAttribute('aria-hidden', 'true');
  },

  // ── Stories / Highlights ──────────────────────────────────
  _storiesEvents: [],
  _storiesIndex: 0,
  _storiesTimer: null,
  _storiesProgress: 0,

  openStories(events) {
    if (!events || !events.length) return;
    this._storiesEvents = events.slice().sort((a, b) => (b.createdAt||0) - (a.createdAt||0));
    this._storiesIndex = 0;
    this._renderStory();
    const modal = document.getElementById('modal-stories');
    modal?.setAttribute('aria-hidden', 'false');
    modal?.classList.add('modal-overlay--open');
    this._startStoryTimer();
  },

  closeStories() {
    this._stopStoryTimer();
    const modal = document.getElementById('modal-stories');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
  },

  _renderStory() {
    const ev = this._storiesEvents[this._storiesIndex];
    if (!ev) { this.closeStories(); return; }

    const img = document.getElementById('stories-image');
    const title = document.getElementById('stories-title');
    const desc = document.getElementById('stories-desc');
    const dots = document.getElementById('stories-dots');

    // Use featuredPhotos array if set, fall back to legacy featuredPhoto, then first photo
    const photos = ev.photos || [];
    const featuredList = ev.featuredPhotos || (ev.featuredPhoto ? [ev.featuredPhoto] : []);
    const photoUrl = featuredList[0] || (photos.length ? photos[0] : '');
    if (photoUrl && img) { img.src = photoUrl; img.style.display = 'block'; }
    else if (img) img.style.display = 'none';

    if (title) title.textContent = ev.title || '';
    if (desc) desc.textContent = ev.body ? (ev.body.length > 120 ? ev.body.substring(0, 120) + '...' : ev.body) : '';

    if (dots) {
      dots.innerHTML = this._storiesEvents.map((_, i) =>
        `<div class="stories-dot ${i === this._storiesIndex ? 'active' : ''}"></div>`
      ).join('');
    }

    this._storiesProgress = 0;
    const bar = document.getElementById('stories-progress');
    if (bar) bar.style.width = '0%';
  },

  _startStoryTimer() {
    this._stopStoryTimer();
    this._storiesTimer = setInterval(() => {
      this._storiesProgress += 2;
      const bar = document.getElementById('stories-progress');
      if (bar) bar.style.width = this._storiesProgress + '%';
      if (this._storiesProgress >= 100) {
        this.nextStory();
      }
    }, 100);
  },

  _stopStoryTimer() {
    if (this._storiesTimer) { clearInterval(this._storiesTimer); this._storiesTimer = null; }
  },

  nextStory() {
    if (this._storiesIndex < this._storiesEvents.length - 1) {
      this._storiesIndex++;
      this._renderStory();
      this._startStoryTimer();
    } else {
      this.closeStories();
    }
  },

  prevStory() {
    if (this._storiesIndex > 0) {
      this._storiesIndex--;
      this._renderStory();
      this._startStoryTimer();
    }
  },
};

// Expose UIExtended methods on the UI object
Object.assign(UI, UIExtended);

// ═══════════════════════════════════════════════════════════
// WallpaperManager — Admin upload + user pick, glassmorphism
// ═══════════════════════════════════════════════════════════

const WallpaperManager = (() => {

  // ── Storage keys ─────────────────────────────────────────
  const KEY_LIST     = 'wallpapers';
  const KEY_SELECTED = 'selectedWallpaper';

  let _wallpapers  = [];
  let _selected    = null;

  // ── Apply wallpaper to DOM ────────────────────────────────
  function _apply(url) {
    _selected = url || null;
    const html = document.documentElement;
    if (url) {
      html.setAttribute('data-wallpaper', '1');
      html.style.setProperty('--wallpaper-url', `url("${CSS.escape ? url : url}")`);
    } else {
      html.removeAttribute('data-wallpaper');
      html.style.removeProperty('--wallpaper-url');
    }
  }

  // ── Load saved selection from IndexedDB ──────────────────
  async function loadSaved() {
    try {
      const saved = await DB.getSetting(KEY_SELECTED, null);
      if (saved) _apply(saved);
    } catch {}
  }

  // ── Save selection ────────────────────────────────────────
  async function _saveSelection(url) {
    _apply(url);
    try { await DB.setSetting(KEY_SELECTED, url || null); } catch {}
  }

  // ── Fetch wallpaper list from Firestore ───────────────────
  async function _fetchList() {
    try {
      const docs = await FirebaseService.getDocs('wallpapers');
      _wallpapers = docs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } catch {
      _wallpapers = [];
    }
  }

  // ── Render grid inside settings modal ────────────────────
  async function renderGrid() {
    const grid     = document.getElementById('wallpaper-grid');
    const adminRow = document.getElementById('wallpaper-admin-row');
    if (!grid) return;

    if (adminRow) {
      adminRow.classList.toggle('hidden', !Auth.isAdmin());
    }

    await _fetchList();

    const items = [{ id: '__none__', url: null }, ..._wallpapers];

    grid.innerHTML = items.map(wp => {
      const isActive = wp.url === _selected || (wp.id === '__none__' && !_selected);
      const isAdmin  = Auth.isAdmin();

      if (wp.id === '__none__') {
        return `<div class="wallpaper-thumb wallpaper-thumb--none ${isActive ? 'wallpaper-thumb--active' : ''}"
             data-wp-id="__none__" data-wp-url="" role="button" tabindex="0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="2" width="20" height="20" rx="4"/>
            <line x1="2" y1="2" x2="22" y2="22" stroke-width="1.5"/>
          </svg>
          <span>Yok</span>
          <div class="wallpaper-thumb__check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>`;
      }

      return `<div class="wallpaper-thumb ${isActive ? 'wallpaper-thumb--active' : ''}"
           data-wp-id="${wp.id}" data-wp-url="${wp.url}" role="button" tabindex="0">
        <img src="${wp.url}" alt="" loading="lazy"
             onerror="this.parentElement.style.background='var(--color-surface-elevated)'">
        <div class="wallpaper-thumb__check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        ${isAdmin ? `<button class="wallpaper-del-btn" data-del-id="${wp.id}">Sil</button>` : ''}
      </div>`;
    }).join('');

    grid.querySelectorAll('.wallpaper-thumb').forEach(thumb => {
      const activate = async () => {
        const url = thumb.dataset.wpUrl || null;
        await _saveSelection(url || null);
        grid.querySelectorAll('.wallpaper-thumb').forEach(t =>
          t.classList.toggle('wallpaper-thumb--active', t === thumb)
        );
      };
      thumb.addEventListener('click', activate);
      thumb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
    });

    grid.querySelectorAll('.wallpaper-del-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Bu duvar kağıdını silmek istiyor musunuz?')) return;
        const id = btn.dataset.delId;
        try {
          await FirebaseService.deleteDoc('wallpapers', id);
          const wp = _wallpapers.find(w => w.id === id);
          if (wp && wp.url === _selected) await _saveSelection(null);
          await renderGrid();
          UI._showToast('Duvar kağıdı silindi');
        } catch (err) { alert('Silme hatası: ' + (err.message || err)); }
      });
    });
  }

  async function addWallpaper(url) {
    if (!Auth.isAdmin()) return;
    const trimmed = (url || '').trim();
    if (!trimmed || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
      UI._showToast('Geçerli bir URL girin');
      return;
    }
    try {
      const id = CryptoManager.generateId();
      await FirebaseService.setDoc('wallpapers', id, { id, url: trimmed, createdAt: Date.now() });
      UI._showToast('Duvar kağıdı eklendi ✓');
      await renderGrid();
    } catch (err) { alert('Ekleme hatası: ' + (err.message || err)); }
  }

  function bindAdminControls() {
    const addBtn   = document.getElementById('wallpaper-add-btn');
    const urlInput = document.getElementById('wallpaper-url-input');
    if (!addBtn) return;
    addBtn.addEventListener('click', async () => {
      await addWallpaper(urlInput?.value || '');
      if (urlInput) urlInput.value = '';
    });
    urlInput?.addEventListener('keydown', async e => {
      if (e.key === 'Enter') {
        await addWallpaper(urlInput.value);
        urlInput.value = '';
      }
    });
  }

  return { loadSaved, renderGrid, bindAdminControls };
})();

UI.WallpaperManager = WallpaperManager;
