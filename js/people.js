/* ============================================================
   People — CRUD with Firebase Firestore
   + see-more modal, keyword search, pagination
   ============================================================ */

const People = (() => {
  const PAGE_SIZE = 10;

  let _allPeople   = [];
  let _filtered    = [];
  let _currentPage = 1;
  let _searchQuery = '';
  let _unsubscribe = null;

  // ── Real-time load from Firestore ─────────────────────────
  async function load() {
    _unsubscribe?.();
    _unsubscribe = FirebaseService.onSnapshot('people', (docs) => {
      _allPeople = docs.sort((a, b) => {
        const na = ((a.firstName||'') + ' ' + (a.lastName||'')).toLowerCase().trim();
        const nb = ((b.firstName||'') + ' ' + (b.lastName||'')).toLowerCase().trim();
        return na.localeCompare(nb, 'tr');
      });
      _applyFilter();
      _render();
    });
  }



  function _applyFilter() {
    const q = _searchQuery.toLowerCase().trim();
    _filtered = q
      ? _allPeople.filter(p => [p.firstName, p.lastName, p.description, p.notes].join(' ').toLowerCase().includes(q))
      : [..._allPeople];
    const maxPage = Math.max(1, Math.ceil(_filtered.length / PAGE_SIZE));
    if (_currentPage > maxPage) _currentPage = maxPage;
  }

  function _render() {
    const listEl  = document.getElementById('people-list');
    const emptyEl = document.getElementById('people-empty');
    const paginEl = document.getElementById('pagination');
    if (!listEl) return;

    const totalPages = Math.max(1, Math.ceil(_filtered.length / PAGE_SIZE));
    const start = (_currentPage - 1) * PAGE_SIZE;
    const page  = _filtered.slice(start, start + PAGE_SIZE);

    if (_filtered.length === 0) {
      listEl.innerHTML = '';
      emptyEl?.classList.remove('hidden');
      paginEl?.classList.add('hidden');
      return;
    }
    emptyEl?.classList.add('hidden');

    listEl.style.opacity = '0';
    setTimeout(() => {
      listEl.innerHTML = page.map(_buildCard).join('');
      listEl.style.opacity = '1';
      listEl.style.transition = 'opacity 0.2s ease';
      if (Auth.isAdmin()) _bindAdminActions(listEl);
      _bindSeeMore(listEl);
    }, 150);

    if (totalPages > 1) {
      paginEl?.classList.remove('hidden');
      document.getElementById('page-indicator').textContent = `${_currentPage} / ${totalPages}`;
      document.getElementById('prev-page-btn').disabled = (_currentPage === 1);
      document.getElementById('next-page-btn').disabled = (_currentPage === totalPages);
      if (paginEl) {
        paginEl.style.opacity = '0';
        paginEl.style.pointerEvents = 'none';
        paginEl.style.transition = 'opacity 0.25s ease';
        const listEl2 = document.getElementById('people-list');
        listEl2?.removeEventListener('scroll', listEl2._paginScroll);
        listEl2._paginScroll = () => {
          const near = listEl2.scrollTop + listEl2.clientHeight >= listEl2.scrollHeight - 50;
          paginEl.style.opacity       = near ? '1' : '0';
          paginEl.style.pointerEvents = near ? 'all' : 'none';
        };
        listEl2?.addEventListener('scroll', listEl2._paginScroll, { passive: true });
      }
    } else {
      paginEl?.classList.add('hidden');
    }
  }

  function _buildCard(person) {
    const isAdmin = Auth.isAdmin();
    let photoHtml;
    if (person.photoURL) {
      photoHtml = `<div class="people-card__photo"><img src="${person.photoURL}" alt="${UI._escHtml(person.firstName)}" loading="lazy" onerror="this.parentElement.outerHTML='<div class=\\'people-card__photo-placeholder\\'>${(person.firstName?.[0]||'').toUpperCase()}${(person.lastName?.[0]||'').toUpperCase()}</div>'"></div>`;
    } else {
      const initials = `${person.firstName?.[0]||''}${person.lastName?.[0]||''}`.toUpperCase();
      photoHtml = `<div class="people-card__photo-placeholder">${initials}</div>`;
    }

    const socialsHtml = UI.buildSocialLinks(person.socials || {});
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
            <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>` : '';

    const seeMoreBtn = `
      <button class="card-see-more-btn" data-id="${person.id}" aria-label="Daha fazla">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>`;

    return `
      <div class="people-card" role="listitem" data-id="${person.id}">
        ${adminActions}
        ${seeMoreBtn}
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
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const p = _allPeople.find(p => p.id === btn.dataset.id);
        if (p) UI.openPersonModal(p);
      });
    });
    container.querySelectorAll('.card-action-btn--delete').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Bu kişiyi silmek istediğinize emin misiniz?')) return;
        await deletePerson(btn.dataset.id);
      });
    });
  }

  function _bindSeeMore(container) {
    container.querySelectorAll('.card-see-more-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const p = _allPeople.find(p => p.id === btn.dataset.id);
        if (p) UI.openSeeMoreModal(p);
      });
    });
  }

  // ── Save person ───────────────────────────────────────────
  async function savePerson(data, editId = null) {
    if (!data.firstName || !data.lastName) return { success: false, error: 'Ad ve soyad zorunludur.' };

    const id       = editId || CryptoManager.generateId();
    const existing = editId ? _allPeople.find(p => p.id === editId) : null;

    const person = {
      id,
      firstName:   data.firstName,
      lastName:    data.lastName,
      description: data.description || '',
      notes:       data.notes !== undefined ? data.notes : (existing?.notes || ''),
      photoURL:    data.photoURL || existing?.photoURL || null,
      socials:     { ...(data.socials || {}), extraLinks: data.extraLinks || [] },
      order:       existing?.order ?? Date.now(),
      updatedAt:   Date.now()
    };

    await FirebaseService.setDoc('people', id, person);
    return { success: true };
  }

  async function deletePerson(id) {
    await FirebaseService.deleteDoc('people', id);
    FirebaseService.deleteFile(`people/${id}/photo.jpg`).catch(() => {});
  }

  // ── Search / Pagination ───────────────────────────────────
  function search(query) { _searchQuery = query; _currentPage = 1; _applyFilter(); _render(); }
  function nextPage() { if (_currentPage < Math.ceil(_filtered.length / PAGE_SIZE)) { _currentPage++; _render(); } }
  function prevPage() { if (_currentPage > 1) { _currentPage--; _render(); } }
  function updateAdminUI() { document.getElementById('add-person-btn')?.classList.toggle('hidden', !Auth.isAdmin()); }
  function destroy() { _unsubscribe?.(); }

  return { load, savePerson, deletePerson, search, nextPage, prevPage, updateAdminUI, destroy };
})();
