/* ============================================================
   People — CRUD, rendering, pagination (10/page), search
   ============================================================ */

const People = (() => {
  const PAGE_SIZE = 10;

  let _allPeople    = [];   // full unfiltered list
  let _filtered     = [];   // search-filtered list
  let _currentPage  = 1;
  let _searchQuery  = '';
  let _direction    = 'left'; // for page transition

  // ── Load & render ─────────────────────────────────────────
  async function load() {
    _allPeople = await DB.getAllPeople();
    _searchQuery = '';
    _currentPage = 1;
    _applyFilter();
    _render();
  }

  function _applyFilter() {
    const q = _searchQuery.toLowerCase().trim();
    if (!q) {
      _filtered = [..._allPeople];
    } else {
      _filtered = _allPeople.filter(p => {
        const name = `${p.firstName} ${p.lastName}`.toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return name.includes(q) || desc.includes(q);
      });
    }
    // Clamp page
    const maxPage = Math.max(1, Math.ceil(_filtered.length / PAGE_SIZE));
    if (_currentPage > maxPage) _currentPage = maxPage;
  }

  function _render() {
    const listEl   = document.getElementById('people-list');
    const emptyEl  = document.getElementById('people-empty');
    const paginEl  = document.getElementById('pagination');
    if (!listEl) return;

    const totalPages = Math.max(1, Math.ceil(_filtered.length / PAGE_SIZE));
    const start = (_currentPage - 1) * PAGE_SIZE;
    const page  = _filtered.slice(start, start + PAGE_SIZE);

    // Empty state
    if (_filtered.length === 0) {
      listEl.innerHTML = '';
      emptyEl?.classList.remove('hidden');
      paginEl?.classList.add('hidden');
      return;
    }
    emptyEl?.classList.add('hidden');

    // Render cards with animation direction
    listEl.style.opacity = '0';
    setTimeout(() => {
      listEl.innerHTML = page.map(_buildCard).join('');
      listEl.style.opacity = '1';
      listEl.style.transition = 'opacity 0.2s ease';

      // Bind admin buttons
      if (Auth.isAdmin()) _bindAdminActions(listEl);
    }, 150);

    // Pagination
    if (totalPages > 1) {
      paginEl?.classList.remove('hidden');
      const indicator = document.getElementById('page-indicator');
      const prevBtn   = document.getElementById('prev-page-btn');
      const nextBtn   = document.getElementById('next-page-btn');
      if (indicator) indicator.textContent = `${_currentPage} / ${totalPages}`;
      if (prevBtn)   prevBtn.disabled = (_currentPage === 1);
      if (nextBtn)   nextBtn.disabled = (_currentPage === totalPages);
    } else {
      paginEl?.classList.add('hidden');
    }
  }

  function _buildCard(person) {
    const isAdmin = Auth.isAdmin();

    // Photo
    let photoHtml;
    if (person.photoBase64) {
      photoHtml = `<div class="people-card__photo"><img src="${person.photoBase64}" alt="${UI._escHtml(person.firstName)}" loading="lazy"></div>`;
    } else {
      const initials = `${person.firstName?.[0] || ''}${person.lastName?.[0] || ''}`.toUpperCase();
      photoHtml = `<div class="people-card__photo-placeholder">${initials}</div>`;
    }

    // Socials
    const socialsHtml = UI.buildSocialLinks(person.socials || {});

    // Admin actions
    const adminActions = isAdmin ? `
      <div class="people-card__admin-actions">
        <button class="card-action-btn card-action-btn--edit" data-id="${person.id}" aria-label="Düzenle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="card-action-btn card-action-btn--delete" data-id="${person.id}" aria-label="Sil">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6m4-6v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>` : '';

    return `
      <div class="people-card" role="listitem" data-id="${person.id}">
        ${adminActions}
        ${photoHtml}
        <div class="people-card__info">
          <p class="people-card__name">${UI._escHtml(person.firstName)} ${UI._escHtml(person.lastName)}</p>
          ${person.description ? `<p class="people-card__desc">${UI._escHtml(person.description)}</p>` : ''}
          ${socialsHtml ? `<div class="people-card__socials">${socialsHtml}</div>` : ''}
        </div>
      </div>`;
  }

  function _bindAdminActions(container) {
    container.querySelectorAll('.card-action-btn--edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const person = _allPeople.find(p => p.id === btn.dataset.id);
        if (person) UI.openPersonModal(person);
      });
    });

    container.querySelectorAll('.card-action-btn--delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Bu kişiyi silmek istediğinize emin misiniz?')) return;
        await DB.deletePerson(btn.dataset.id);
        await load();
      });
    });
  }

  // ── Add / Update person ───────────────────────────────────
  async function savePerson(data, editId = null) {
    if (!data.firstName || !data.lastName) {
      return { success: false, error: 'Ad ve soyad zorunludur.' };
    }

    const person = {
      id:          editId || CryptoManager.generateId(),
      firstName:   data.firstName,
      lastName:    data.lastName,
      description: data.description || '',
      photoBase64: data.photoBase64 || '',
      socials:     data.socials || {},
      order:       editId
        ? (_allPeople.find(p => p.id === editId)?.order ?? Date.now())
        : Date.now()
    };

    await DB.savePerson(person);
    await load();
    return { success: true };
  }

  // ── Search ────────────────────────────────────────────────
  function search(query) {
    _searchQuery = query;
    _currentPage = 1;
    _applyFilter();
    _render();
  }

  // ── Pagination ────────────────────────────────────────────
  function nextPage() {
    const totalPages = Math.ceil(_filtered.length / PAGE_SIZE);
    if (_currentPage < totalPages) {
      _direction = 'left';
      _currentPage++;
      _render();
      // Smooth slide
      const list = document.getElementById('people-list');
      list?.classList.remove('people-list--slide-left', 'people-list--slide-right');
      void list?.offsetWidth;
      list?.classList.add('people-list--slide-left');
    }
  }

  function prevPage() {
    if (_currentPage > 1) {
      _direction = 'right';
      _currentPage--;
      _render();
      const list = document.getElementById('people-list');
      list?.classList.remove('people-list--slide-left', 'people-list--slide-right');
      void list?.offsetWidth;
      list?.classList.add('people-list--slide-right');
    }
  }

  // ── Show/hide admin add button ────────────────────────────
  function updateAdminUI() {
    const addBtn = document.getElementById('add-person-btn');
    if (addBtn) addBtn.classList.toggle('hidden', !Auth.isAdmin());
  }

  return {
    load,
    savePerson,
    search,
    nextPage,
    prevPage,
    updateAdminUI
  };
})();
