/* ============================================================
   DevTools Protection
   ⚠️  Browser source is never fully hideable — this raises the
   bar significantly. True security lives in Firebase Rules.
   ============================================================ */
(function () {
  'use strict';

  // ── Disable right-click context menu ─────────────────────
  document.addEventListener('contextmenu', e => e.preventDefault());

  // ── Block keyboard shortcuts ──────────────────────────────
  document.addEventListener('keydown', e => {
    const blocked =
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c','K','k'].includes(e.key)) ||
      (e.ctrlKey && e.key === 'u') ||
      (e.ctrlKey && e.key === 'U') ||
      (e.metaKey && e.altKey && ['i','I','j','J'].includes(e.key)); // macOS
    if (blocked) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // ── Detect DevTools via window size heuristic ─────────────
  const _threshold = 160;
  function _checkDevTools() {
    const widthDiff  = window.outerWidth  - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    if (widthDiff > _threshold || heightDiff > _threshold) {
      _onDetected();
    }
  }

  // ── Detect via console.log override ──────────────────────
  const _origLog = console.log;
  let _devtoolsOpen = false;

  const _detector = /./;
  _detector.toString = function () {
    _devtoolsOpen = true;
    _onDetected();
    return '';
  };
  // Uncomment to activate (may break debugging):
  // console.log('%c', _detector);

  function _onDetected() {
    // Clear visible content — but keep app shell so it's not obvious what happened
    const overlay = document.getElementById('devtools-block');
    if (overlay) overlay.style.display = 'flex';
  }

  // Periodic check
  setInterval(_checkDevTools, 1000);

  // ── Create block overlay (injected once DOM ready) ────────
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
