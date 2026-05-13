/* ============================================================
   CryptoManager — AES-256-GCM encryption via Web Crypto API
   All sensitive data (users, sessions) is encrypted at rest.
   ============================================================ */

const CryptoManager = (() => {
  // App-level secret for key derivation. Change before deploy.
  const APP_SECRET = 'ZaferPartisi_AppKey_v1_NeverShare';
  const SALT = new Uint8Array([
    90,97,102,101,114,80,97,114,116,105,115,105,95,83,97,108,116,95,50,48,50,52
  ]);

  let _cachedKey = null;

  // ── Key derivation ──────────────────────────────────────
  async function _getKey() {
    if (_cachedKey) return _cachedKey;

    const enc = new TextEncoder();
    const rawKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(APP_SECRET),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    _cachedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: SALT,
        iterations: 120000,
        hash: 'SHA-256'
      },
      rawKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return _cachedKey;
  }

  // ── Encrypt ─────────────────────────────────────────────
  // Returns a base64 string: [12-byte IV][ciphertext]
  async function encrypt(data) {
    const key = await _getKey();
    const enc = new TextEncoder();
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = enc.encode(JSON.stringify(data));

    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );

    // Combine IV + ciphertext into one Uint8Array
    const combined = new Uint8Array(12 + cipherBuf.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuf), 12);

    // Encode as base64
    let binary = '';
    combined.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  // ── Decrypt ─────────────────────────────────────────────
  async function decrypt(ciphertext) {
    const key = await _getKey();

    // Decode base64
    const binary = atob(ciphertext);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);

    const iv         = combined.slice(0, 12);
    const cipherData = combined.slice(12);

    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherData
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(plainBuf));
  }

  // ── Hash (one-way, for codes) ────────────────────────────
  // Returns hex string of SHA-256(code + APP_SECRET)
  async function hashCode(code) {
    const enc  = new TextEncoder();
    const data = enc.encode(code.trim() + APP_SECRET);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ── Generate a random ID ─────────────────────────────────
  function generateId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  return { encrypt, decrypt, hashCode, generateId };
})();
