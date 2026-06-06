/* ============================================================
   CryptoManager — AES-256-GCM encryption via Web Crypto API
   All sensitive data (users, sessions) is encrypted at rest.
   ============================================================ */

const CryptoManager = (() => {
  const APP_SECRET = 'ZaferPartisi_AppKey_v1_NeverShare';
  const SALT = new Uint8Array([
    90,97,102,101,114,80,97,114,116,105,115,105,95,83,97,108,116,95,50,48,50,52
  ]);

  let _cachedKey = null;

  async function _getKey() {
    if (_cachedKey) return _cachedKey;
    const enc    = new TextEncoder();
    const rawKey = await crypto.subtle.importKey('raw', enc.encode(APP_SECRET), { name: 'PBKDF2' }, false, ['deriveKey']);
    _cachedKey   = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: SALT, iterations: 120000, hash: 'SHA-256' },
      rawKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    return _cachedKey;
  }

  async function encrypt(data) {
    const key       = await _getKey();
    const enc       = new TextEncoder();
    const iv        = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
    const combined  = new Uint8Array(12 + cipherBuf.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuf), 12);
    let binary = '';
    combined.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  async function decrypt(ciphertext) {
    const key      = await _getKey();
    const binary   = atob(ciphertext);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12));
    return JSON.parse(new TextDecoder().decode(plainBuf));
  }

  async function hashCode(code) {
    const data = new TextEncoder().encode(code.trim() + APP_SECRET);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function generateId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  return { encrypt, decrypt, hashCode, generateId };
})();
