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
    // Show admin elements if needed
    People.updateAdminUI();
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
  // iOS: Prevent double-tap zoom on buttons
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
      }
    }
  }, { passive: true });

})();
