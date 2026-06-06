/* ============================================================
   Library — Book listing, cover expand, PDF read/download,
   author info, purchase link. Admin can add/edit/delete books.
   Data stored in Firestore 'library' collection.
   ============================================================ */

const Library = (() => {
  let _allBooks    = [];
  let _unsubscribe = null;
  let _viewMode    = 'grid'; // 'grid' | 'list'
  let _expandedBookId = null;

  // ── Real-time load ────────────────────────────────────────
  async function load() {
    _unsubscribe?.();
    _loadViewMode();

    _unsubscribe = FirebaseService.onSnapshot('library', (docs) => {
      _allBooks = docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      _render();
    });
  }

  function _loadViewMode() {
    // Try DB async but don't block render — use cached value from DB if available
    DB.getSetting('library_view_mode', 'grid').then(saved => {
      if (saved === 'list' || saved === 'grid') {
        _viewMode = saved;
        _updateViewToggle();
      }
    }).catch(() => {});
    _updateViewToggle();
  }

  function _saveViewMode(mode) {
    _viewMode = mode;
    DB.setSetting('library_view_mode', mode).catch(() => {});
    _updateViewToggle();
  }

  function _updateViewToggle() {
    const gridBtn = document.getElementById('lib-view-grid');
    const listBtn = document.getElementById('lib-view-list');
    gridBtn?.classList.toggle('lib-view-btn--active', _viewMode === 'grid');
    listBtn?.classList.toggle('lib-view-btn--active', _viewMode === 'list');
  }

  // ── Render book list ──────────────────────────────────────
  function _render() {
    const gridEl  = document.getElementById('library-grid');
    const emptyEl = document.getElementById('library-empty');
    const addBtn  = document.getElementById('lib-add-btn');
    if (!gridEl) return;

    if (addBtn) addBtn.classList.toggle('hidden', !Auth.isAdmin());

    if (_allBooks.length === 0) {
      gridEl.innerHTML = '';
      gridEl.className = 'library-grid';
      emptyEl?.classList.remove('hidden');
      return;
    }
    emptyEl?.classList.add('hidden');

    gridEl.className = _viewMode === 'grid' ? 'library-grid library-grid--grid' : 'library-grid library-grid--list';

    gridEl.style.opacity = '0';
    setTimeout(() => {
      gridEl.innerHTML = _allBooks.map(b => _buildBookCard(b)).join('');
      gridEl.style.opacity = '1';
      gridEl.style.transition = 'opacity 0.2s ease';
      _bindCardEvents(gridEl);
    }, 120);
  }

  function _buildBookCard(book) {
    const isAdmin = Auth.isAdmin();
    const coverSrc = book.coverURL || book.coverBase64 || '';
    const coverHtml = coverSrc
      ? `<img class="book-card__cover-img" src="${UI._escHtml(coverSrc)}" alt="${UI._escHtml(book.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const placeholderHtml = `<div class="book-card__cover-placeholder" style="${coverSrc ? 'display:none' : ''}">${(book.title?.[0] || '?').toUpperCase()}</div>`;

    const adminHtml = isAdmin ? `
      <div class="book-card__admin-actions">
        <button class="card-action-btn card-action-btn--edit" data-id="${book.id}" aria-label="Düzenle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="card-action-btn card-action-btn--delete" data-id="${book.id}" aria-label="Sil">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>` : '';

    if (_viewMode === 'list') {
      return `
        <div class="book-card book-card--list" data-id="${book.id}" role="listitem">
          ${adminHtml}
          <div class="book-card__cover book-card__cover--sm" data-id="${book.id}">
            ${coverHtml}${placeholderHtml}
          </div>
          <div class="book-card__info">
            <p class="book-card__title">${UI._escHtml(book.title)}</p>
            <p class="book-card__author">${UI._escHtml(book.author)}</p>
            ${book.description ? `<p class="book-card__desc-sm">${UI._escHtml(book.description.substring(0, 80))}${book.description.length > 80 ? '…' : ''}</p>` : ''}
            <div class="book-card__stats">
              <span class="book-stat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${book.viewCount || 0}</span>
              <span class="book-stat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>${book.downloadCount || 0}</span>
            </div>
          </div>
        </div>`;
    }

    return `
      <div class="book-card" data-id="${book.id}" role="listitem">
        ${adminHtml}
        <div class="book-card__cover" data-id="${book.id}">
          ${coverHtml}${placeholderHtml}
        </div>
        <p class="book-card__author">${UI._escHtml(book.author)}</p>
        <p class="book-card__title">${UI._escHtml(book.title)}</p>
      </div>`;
  }

  function _bindCardEvents(container) {
    // Cover click → expand
    container.querySelectorAll('.book-card__cover').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const id = el.dataset.id;
        const book = _allBooks.find(b => b.id === id);
        if (book) _openExpanded(book);
      });
    });

    // Card click (list mode) → expand
    container.querySelectorAll('.book-card--list').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('.card-action-btn')) return;
        const id = el.dataset.id;
        const book = _allBooks.find(b => b.id === id);
        if (book) _openExpanded(book);
      });
    });

    // Admin actions
    if (Auth.isAdmin()) {
      container.querySelectorAll('.card-action-btn--edit').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const book = _allBooks.find(b => b.id === btn.dataset.id);
          if (book) _openBookForm(book);
        });
      });
      container.querySelectorAll('.card-action-btn--delete').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          if (!confirm('Bu kitabı silmek istediğinize emin misiniz?')) return;
          await _deleteBook(btn.dataset.id);
        });
      });
    }
  }

  // ── Expanded book overlay ─────────────────────────────────
  async function _openExpanded(book) {
    _expandedBookId = book.id;

    // Increment view count (fire & forget)
    _incrementStat(book.id, 'viewCount');

    const overlay = document.getElementById('lib-expand-overlay');
    if (!overlay) return;

    const coverSrc = book.coverURL || book.coverBase64 || '';

    // Build cover HTML
    const coverEl = overlay.querySelector('.lib-expand__cover');
    if (coverEl) {
      if (coverSrc) {
        coverEl.innerHTML = `<img src="${UI._escHtml(coverSrc)}" alt="${UI._escHtml(book.title)}" onerror="this.style.display='none'">`;
        coverEl.style.background = '';
      } else {
        coverEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:48px;color:white;font-weight:700">${(book.title?.[0]||'?').toUpperCase()}</div>`;
        coverEl.style.background = 'var(--color-primary)';
      }
    }

    // Stats
    const statsEl = overlay.querySelector('.lib-expand__stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <span class="lib-stat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${(book.viewCount||0)+1} görüntülenme</span>
        <span class="lib-stat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>${book.downloadCount||0} indirme</span>`;
    }

    // Title & author
    const titleEl = overlay.querySelector('.lib-expand__title');
    const authorEl = overlay.querySelector('.lib-expand__author');
    if (titleEl) titleEl.textContent = book.title || '';
    if (authorEl) authorEl.textContent = book.author || '';

    // Action buttons
    const downloadBtn = overlay.querySelector('.lib-action-btn--download');
    const readBtn     = overlay.querySelector('.lib-action-btn--read');
    const infoBtn     = overlay.querySelector('.lib-action-btn--info');
    const buyBtn      = overlay.querySelector('.lib-action-btn--buy');

    if (downloadBtn) {
      downloadBtn.onclick = () => _handleDownload(book);
      downloadBtn.style.opacity = book.pdfURL ? '1' : '0.4';
      downloadBtn.disabled = !book.pdfURL;
    }
    if (readBtn) {
      readBtn.onclick = () => _handleRead(book);
      readBtn.style.opacity = book.pdfURL ? '1' : '0.4';
      readBtn.disabled = !book.pdfURL;
    }
    if (infoBtn) {
      infoBtn.onclick = () => _openAuthorInfo(book);
    }
    if (buyBtn) {
      buyBtn.onclick = () => { if (book.purchaseURL) window.open(book.purchaseURL, '_blank'); };
      buyBtn.style.opacity = book.purchaseURL ? '1' : '0.4';
      buyBtn.disabled = !book.purchaseURL;
    }

    // Show overlay
    overlay.classList.add('lib-expand-overlay--open');
    document.body.style.overflow = 'hidden';
  }

  function _closeExpanded() {
    const overlay = document.getElementById('lib-expand-overlay');
    overlay?.classList.remove('lib-expand-overlay--open');
    document.body.style.overflow = '';
    _expandedBookId = null;
  }

  // ── Read PDF ──────────────────────────────────────────────
  function _handleRead(book) {
    if (!book.pdfURL) return;
    // Try to open Google Drive preview (viewer) if it's a Drive link
    let viewURL = book.pdfURL;
    // Convert Drive download link to preview link if possible
    const driveMatch = book.pdfURL.match(/\/file\/d\/([^/]+)\//);
    if (driveMatch) {
      viewURL = `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    } else {
      // Use Google Docs viewer for non-Drive PDFs
      viewURL = `https://docs.google.com/viewer?url=${encodeURIComponent(book.pdfURL)}&embedded=true`;
    }

    // Open in-app PDF reader
    _openPDFReader(book, viewURL);
  }

  function _openPDFReader(book, viewURL) {
    const readerEl = document.getElementById('lib-pdf-reader');
    if (!readerEl) return;

    const titleEl  = readerEl.querySelector('.lib-pdf-reader__title');
    const frameEl  = readerEl.querySelector('.lib-pdf-reader__frame');

    if (titleEl) titleEl.textContent = book.title || 'Kitap Okuyucu';
    if (frameEl) {
      frameEl.src = '';
      frameEl.src = viewURL;
    }

    readerEl.classList.add('lib-pdf-reader--open');
  }

  function _closePDFReader() {
    const readerEl = document.getElementById('lib-pdf-reader');
    const frameEl  = readerEl?.querySelector('.lib-pdf-reader__frame');
    readerEl?.classList.remove('lib-pdf-reader--open');
    if (frameEl) frameEl.src = '';
  }

  // ── Download PDF ──────────────────────────────────────────
  async function _handleDownload(book) {
    if (!book.pdfURL) return;
    _incrementStat(book.id, 'downloadCount');
    // Trigger download
    const a = document.createElement('a');
    a.href = book.pdfURL;
    a.download = (book.title || 'kitap') + '.pdf';
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    UI._showToast('İndirme başlatıldı');
  }

  // ── Author info modal ─────────────────────────────────────
  function _openAuthorInfo(book) {
    const modal = document.getElementById('modal-author-info');
    if (!modal) return;

    const photoEl   = modal.querySelector('.author-profile__photo-wrap');
    const nameEl    = modal.querySelector('.author-profile__name');
    const titleEl   = modal.querySelector('.author-profile__subtitle');
    const bioEl     = modal.querySelector('.author-profile__bio');
    const socialsEl = modal.querySelector('.author-profile__socials');
    const linksEl   = modal.querySelector('.author-profile__links');

    if (photoEl) {
      const src = book.authorPhotoURL || '';
      const initials = (book.author || '?').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
      if (src) {
        photoEl.innerHTML = `<img src="${UI._escHtml(src)}" alt="${UI._escHtml(book.author)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.innerHTML='<div class=\\'author-profile__initials\\'>${initials}</div>'">`;
      } else {
        photoEl.innerHTML = `<div class="author-profile__initials">${initials}</div>`;
      }
    }

    if (nameEl)    nameEl.textContent    = book.author || '';
    if (titleEl)   titleEl.textContent   = book.authorTitle || '';
    if (bioEl)     bioEl.textContent     = book.authorBio || 'Yazar hakkında bilgi eklenmemiş.';

    // Socials
    if (socialsEl) {
      const s = book.authorSocials || {};
      socialsEl.innerHTML = UI.buildSocialLinks(s) || '';
    }

    // Extra links
    if (linksEl) {
      const extraLinks = book.authorLinks || [];
      if (extraLinks.length > 0) {
        linksEl.innerHTML = extraLinks.map(l => `
          <a href="${UI._escHtml(l.url)}" target="_blank" rel="noopener" class="author-link-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            ${UI._escHtml(l.label || l.url)}
          </a>`).join('');
        linksEl.classList.remove('hidden');
      } else {
        linksEl.innerHTML = '';
        linksEl.classList.add('hidden');
      }
    }

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  }

  function _closeAuthorInfo() {
    const modal = document.getElementById('modal-author-info');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
  }

  // ── Admin: Book form ──────────────────────────────────────
  function _openBookForm(book = null) {
    const modal = document.getElementById('modal-book-form');
    if (!modal) return;

    const titleEl = modal.querySelector('#book-form-title-heading');
    if (titleEl) titleEl.textContent = book ? 'Kitabı Düzenle' : 'Yeni Kitap Ekle';

    const fields = {
      'bf-title':        book?.title        || '',
      'bf-author':       book?.author       || '',
      'bf-description':  book?.description  || '',
      'bf-cover-url':    book?.coverURL     || '',
      'bf-pdf-url':      book?.pdfURL       || '',
      'bf-purchase-url': book?.purchaseURL  || '',
      'bf-author-photo': book?.authorPhotoURL || '',
      'bf-author-title': book?.authorTitle  || '',
      'bf-author-bio':   book?.authorBio    || '',
      'bf-author-links': (book?.authorLinks || []).map(l => `${l.label}|${l.url}`).join('\n'),
    };

    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });

    // Socials
    const as = book?.authorSocials || {};
    ['instagram','twitter','linkedin','facebook','youtube'].forEach(p => {
      const el = document.getElementById('bf-author-' + p);
      if (el) el.value = as[p] || '';
    });

    modal._editId = book?.id || null;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-overlay--open');
  }

  function _closeBookForm() {
    const modal = document.getElementById('modal-book-form');
    modal?.setAttribute('aria-hidden', 'true');
    modal?.classList.remove('modal-overlay--open');
  }

  async function _saveBookForm() {
    const modal = document.getElementById('modal-book-form');
    if (!modal) return;

    const title  = document.getElementById('bf-title')?.value.trim();
    const author = document.getElementById('bf-author')?.value.trim();
    if (!title || !author) { alert('Kitap adı ve yazar zorunludur.'); return; }

    const rawLinks = document.getElementById('bf-author-links')?.value.trim() || '';
    const authorLinks = rawLinks.split('\n').filter(Boolean).map(line => {
      const [label, ...rest] = line.split('|');
      return { label: label.trim(), url: (rest.join('|')).trim() };
    }).filter(l => l.url);

    const authorSocials = {};
    ['instagram','twitter','linkedin','facebook','youtube'].forEach(p => {
      const v = document.getElementById('bf-author-' + p)?.value.trim();
      if (v) authorSocials[p] = v;
    });

    const id = modal._editId || CryptoManager.generateId();
    const existing = _allBooks.find(b => b.id === id);

    const book = {
      id,
      title,
      author,
      description:    document.getElementById('bf-description')?.value.trim()  || '',
      coverURL:       document.getElementById('bf-cover-url')?.value.trim()    || '',
      pdfURL:         document.getElementById('bf-pdf-url')?.value.trim()      || '',
      purchaseURL:    document.getElementById('bf-purchase-url')?.value.trim() || '',
      authorPhotoURL: document.getElementById('bf-author-photo')?.value.trim() || '',
      authorTitle:    document.getElementById('bf-author-title')?.value.trim() || '',
      authorBio:      document.getElementById('bf-author-bio')?.value.trim()   || '',
      authorLinks,
      authorSocials,
      viewCount:      existing?.viewCount    ?? 0,
      downloadCount:  existing?.downloadCount ?? 0,
      order:          existing?.order         ?? Date.now(),
      updatedAt:      Date.now()
    };

    const btn = document.getElementById('bf-save-btn');
    btn.disabled = true; btn.textContent = 'Kaydediliyor...';

    try {
      await FirebaseService.setDoc('library', id, book);
      _closeBookForm();
      UI._showToast('Kitap kaydedildi.');
    } catch (e) {
      alert('Hata: ' + (e.message || e));
    } finally {
      btn.disabled = false; btn.textContent = 'Kaydet';
    }
  }

  async function _deleteBook(id) {
    // Super admins can delete directly; regular admins must request approval
    if (Auth.isSuperAdmin()) {
      try {
        await FirebaseService.deleteDoc('library', id);
        UI._showToast('Kitap silindi.');
      } catch (e) {
        alert('Silme hatası: ' + (e.message || e));
      }
      return;
    }

    // Regular admin: submit approval request
    const book = _allBooks.find(b => b.id === id);
    if (!book) return;

    const actionId = CryptoManager.generateId();
    const user = Auth.getUser();
    try {
      await FirebaseService.setDoc('pendingActions', actionId, {
        id: actionId,
        type: 'delete_book',
        targetBookId: id,
        targetBookTitle: book.title || '(başlıksız)',
        requesterId: user?.id || '',
        requesterName: user ? `${user.firstName} ${user.lastName}` : 'Admin',
        status: 'pending',
        createdAt: Date.now()
      });
      UI._showToast('Silme isteği üst yetkiliye gönderildi');
    } catch (e) {
      alert('İstek gönderilemedi: ' + (e.message || e));
    }
  }

  // ── Stat increment ────────────────────────────────────────
  async function _incrementStat(id, field) {
    try {
      const book = await FirebaseService.getDoc('library', id);
      if (book) {
        await FirebaseService.setDoc('library', id, { [field]: (book[field] || 0) + 1 });
      }
    } catch {}
  }

  // ── View toggle ───────────────────────────────────────────
  function setViewMode(mode) {
    _saveViewMode(mode);
    _render();
  }

  function destroy() { _unsubscribe?.(); }

  return {
    load,
    destroy,
    setViewMode,
    openBookForm: _openBookForm,
    closeBookForm: _closeBookForm,
    saveBookForm: _saveBookForm,
    closeExpanded: _closeExpanded,
    closeAuthorInfo: _closeAuthorInfo,
    closePDFReader: _closePDFReader,
  };
})();
