/* ============================================================
   DB — IndexedDB abstraction (session + settings only)
   Stores:
     • session  → { key, _enc }   (encrypted session blob)
     • settings → { key, value }  (plain — non-sensitive)
   ============================================================ */

const DB = (() => {
  const DB_NAME    = 'ZaferPartisiDB';
  const DB_VERSION = 2;
  let _db = null;

  // ── Init ─────────────────────────────────────────────────
  async function init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Drop legacy stores if they exist
        ['users', 'people'].forEach(name => {
          if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
        });
      };

      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Generic helpers ──────────────────────────────────────
  function _tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx  = _db.transaction(store, mode);
      const obj = tx.objectStore(store);
      const req = fn(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async function set(store, value)  { return _tx(store, 'readwrite', s => s.put(value)); }
  async function get(store, key)    { return _tx(store, 'readonly',  s => s.get(key)); }
  async function remove(store, key) { return _tx(store, 'readwrite', s => s.delete(key)); }

  // ── Settings helpers ─────────────────────────────────────
  async function getSetting(key, defaultValue = null) {
    try {
      const row = await get('settings', key);
      return row ? row.value : defaultValue;
    } catch { return defaultValue; }
  }
  async function setSetting(key, value) {
    try { return set('settings', { key, value }); } catch {}
  }

  return {
    init,
    set, get, remove,
    getSetting, setSetting
  };
})();
