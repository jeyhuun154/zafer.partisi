/* ============================================================
   People — CRUD with Firebase Firestore + Storage
   + see-more modal, keyword search
   ============================================================ */

const People = (() => {
  const PAGE_SIZE = 5;

  let _allPeople   = [];
  let _filtered    = [];
  let _currentPage = 1;
  let _searchQuery = '';
  let _unsubscribe = null;

  // ── Real-time load from Firestore ─────────────────────────
  async function load() {
    // Unsubscribe previous listener
    _unsubscribe?.();

    _unsubscribe = FirebaseService.onSnapshot('people', (docs) => {
      _allPeople = docs.sort((a, b) => {
         const la = (a.lastName||'').toLowerCase(), lb = (b.lastName||'').toLowerCase();
         if (la !== lb) return la.localeCompare(lb, 'tr');
         return (a.firstName||'').toLowerCase().localeCompare((b.firstName||'').toLowerCase(), 'tr');
      }};
      _applyFilter();
      _render();
    });
  }

  // One-time load (for offline fallback)
  async function loadOnce() {
    try {
      const docs = await FirebaseService.getDocs('people');
      _allPeople = docs.sort((a, b) => {
         const la = (a.lastName||'').toLowerCase(), lb = (b.lastName||'').toLowerCase();
         if (la !== lb) return la.localeCompare(lb, 'tr');
         return (a.firstName||'').toLowerCase().localeCompare((b.firstName||'').toLowerCase(), 'tr');
      }};
    } catch {
      _allPeople = await DB.getAllPeople();
    }
    _applyFilter();
    _render();
  }

  function _applyFilter() {
    const q = _searchQuery.toLowerCase().trim();
    if (!q) { _filtered = [..._allPeople]; }
    else {
      _filtered = _allPeople.filter(p => {
        const combined = [p.firstName, p.lastName, p.description, p.notes].join(' ').toLowerCase();
        return combined.includes(q);
      });
    }
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
    } else {
      paginEl?.classList.add('hidden');
    }
  }

  function _buildCard(person) {
    const isAdmin = Auth.isAdmin();
    let photoHtml;
    if (person.photoURL || person.photoBase64) {
      const src = person.photoURL || person.photoBase64;
      photoHtml = `<div class="people-card__photo"><img src="${src}" alt="${UI._escHtml(person.firstName)}" loading="lazy" onerror="this.parentElement.outerHTML='<div class=\\'people-card__photo-placeholder\\'>${(person.firstName?.[0]||'').toUpperCase()}${(person.lastName?.[0]||'').toUpperCase()}</div>'"></div>`;
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

    // 3-dot "see more" button
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

  // ── Save person (Firestore + Storage) ─────────────────────
  async function savePerson(data, editId = null) {
    if (!data.firstName || !data.lastName) return { success: false, error: 'Ad ve soyad zorunludur.' };

    const id = editId || CryptoManager.generateId();
    const existing = editId ? _allPeople.find(p => p.id === editId) : null;

    let photoURL    = existing?.photoURL  || data.photoURL  || null;
    let photoBase64 = existing?.photoBase64 || '';

    // If a new base64 photo was provided, try Storage upload first
    if (data.photoBase64 && data.photoBase64.startsWith('data:')) {
      try {
        const url = await FirebaseService.uploadBase64(`people/${id}/photo.jpg`, data.photoBase64);
        if (url) {
          photoURL    = url;
          photoBase64 = ''; // no need to store base64 separately
        } else {
          // Storage unavailable — store base64 directly in Firestore
          // Limit to 800KB to keep Firestore happy
          if (data.photoBase64.length < 800000) {
            photoBase64 = data.photoBase64;
          } else {
            photoBase64 = await _compressBase64(data.photoBase64, 200);
          }
          photoURL = null;
        }
      } catch (e) {
        console.warn('[People] Photo upload failed, using base64:', e.message);
        photoBase64 = data.photoBase64;
        photoURL = null;
      }
    }

    const person = {
      id,
      firstName:   data.firstName,
      lastName:    data.lastName,
      description: data.description || '',
      notes:       data.notes !== undefined ? data.notes : (existing?.notes || ''),
      photoURL,
      photoBase64,
      socials:     data.socials || {},
      order:       existing?.order ?? Date.now(),
      updatedAt:   Date.now()
    };

    await FirebaseService.setDoc('people', id, person);
    await DB.savePerson(person);
    return { success: true };
  }

  // Compress base64 image to max dimension
  async function _compressBase64(base64, maxSize) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
        else       { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
        canvas.width = Math.round(w); canvas.height = Math.round(h);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  }

  async function deletePerson(id) {
    await FirebaseService.deleteDoc('people', id);
    await DB.deletePerson(id).catch(() => {});
    // Try delete storage photo
    FirebaseService.deleteFile(`people/${id}/photo.jpg`).catch(() => {});
  }

  // ── Search / Pagination ───────────────────────────────────
  function search(query) {
    _searchQuery = query;
    _currentPage = 1;
    _applyFilter();
    _render();
  }

  function nextPage() {
    const total = Math.ceil(_filtered.length / PAGE_SIZE);
    if (_currentPage < total) { _currentPage++; _render(); }
  }

  function prevPage() {
    if (_currentPage > 1) { _currentPage--; _render(); }
  }

  function updateAdminUI() {
    document.getElementById('add-person-btn')?.classList.toggle('hidden', !Auth.isAdmin());
  }

  function destroy() { _unsubscribe?.(); }

  return { load, loadOnce, savePerson, deletePerson, search, nextPage, prevPage, updateAdminUI, destroy };
})();
