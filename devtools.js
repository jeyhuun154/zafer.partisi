/* ============================================================
   DevTools Protection — v2
   Fixed: mobile keyboard no longer triggers false positive
   ============================================================ */
(function () {
  'use strict';

  // ── Disable right-click ───────────────────────────────────
  document.addEventListener('contextmenu', e => {
    // Allow on form inputs (needed for paste on mobile)
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
  });

  // ── Block keyboard shortcuts ──────────────────────────────
  document.addEventListener('keydown', e => {
    // Don't block if user is typing in an input
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const blocked =
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c','K','k'].includes(e.key)) ||
      (e.ctrlKey && ['u','U'].includes(e.key)) ||
      (e.metaKey && e.altKey && ['i','I','j','J'].includes(e.key));
    if (blocked) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // ── DevTools via window size — desktop only ───────────────
  // On mobile, the keyboard opens and shrinks innerHeight by ~300px
  // We only run this check on desktop (non-touch, non-mobile UA)
  const _isMobile = () =>
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0);

  if (!_isMobile()) {
    let _baseW = window.outerWidth;
    let _baseH = window.outerHeight;
    const _threshold = 160;

    function _checkDevTools() {
      const widthDiff  = window.outerWidth  - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      // Only detect if BOTH outer dims are stable and inner significantly smaller
      // AND outer hasn't shrunk (which would mean something else)
      if (Math.abs(window.outerWidth - _baseW) < 10 &&
          Math.abs(window.outerHeight - _baseH) < 10) {
        if (widthDiff > _threshold || heightDiff > _threshold) {
          _onDetected();
        }
      }
    }

    setInterval(_checkDevTools, 1500);
  }

  function _onDetected() {
    const overlay = document.getElementById('devtools-block');
    if (overlay) overlay.style.display = 'flex';
  }

  function _injectOverlay() {
    if (document.getElementById('devtools-block')) return;
    const el = document.createElement('div');
    el.id = 'devtools-block';
    el.style.cssText = [
      'display:none',
      'position:fixed',
      'inset:0',
      'z-index:999999',
      'background:#0d0d0f',
      'align-items:center',
      'justify-content:center',
      'flex-direction:column',
      'gap:16px',
      'font-family:sans-serif',
      'color:#f2f2f7'
    ].join(';');
    el.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p style="font-size:18px;font-weight:600;margin:0">Güvenlik Uyarısı</p>
      <p style="font-size:14px;opacity:.6;margin:0;text-align:center;max-width:260px">
        Bu sayfa geliştirici araçlarıyla görüntülenemez.
      </p>`;
    document.body.appendChild(el);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectOverlay);
  } else {
    _injectOverlay();
  }
})();
