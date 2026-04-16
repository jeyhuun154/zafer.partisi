/* ============================================================
   DB — IndexedDB abstraction
   Stores:
     • session  → { key, data }        (encrypted blobs)
     • users    → { id, ... }          (encrypted individually)
     • people   → { id, order, ... }   (encrypted individually)
     • settings → { key, value }       (plain — non-sensitive)
   ============================================================ */

const DB = (() => {
  const DB_NAME    = 'ZaferPartisiDB';
  const DB_VERSION = 1;
  let _db = null;

  // ── Init ─────────────────────────────────────────────────
  async function init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Encrypted session blobs (key/value pairs)
        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session', { keyPath: 'key' });
        }

        // Encrypted individual user records
        if (!db.objectStoreNames.contains('users')) {
          const users = db.createObjectStore('users', { keyPath: 'id' });
          users.createIndex('nameHash', 'nameHash', { unique: false });
        }

        // Encrypted individual person/member records
        if (!db.objectStoreNames.contains('people')) {
          const people = db.createObjectStore('people', { keyPath: 'id' });
          people.createIndex('order', 'order', { unique: false });
        }

        // Plain settings (theme, etc.)
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Events (admin writes, all read) — stored plain (not sensitive)
        if (!db.objectStoreNames.contains('events')) {
          const events = db.createObjectStore('events', { keyPath: 'id' });
          events.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      req.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  // ── Generic helpers ──────────────────────────────────────
  function _tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx   = _db.transaction(store, mode);
      const obj  = tx.objectStore(store);
      const req  = fn(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async function set(store, value) {
    return _tx(store, 'readwrite', s => s.put(value));
  }

  async function get(store, key) {
    return _tx(store, 'readonly', s => s.get(key));
  }

  async function getAll(store) {
    return _tx(store, 'readonly', s => s.getAll());
  }

  async function remove(store, key) {
    return _tx(store, 'readwrite', s => s.delete(key));
  }

  async function clear(store) {
    return _tx(store, 'readwrite', s => s.clear());
  }

  // ── Settings helpers ─────────────────────────────────────
  async function getSetting(key, defaultValue = null) {
    const row = await get('settings', key);
    return row ? row.value : defaultValue;
  }

  async function setSetting(key, value) {
    return set('settings', { key, value });
  }

  // ── Encrypted people CRUD ────────────────────────────────
  // People are stored as { id, order, _enc: encrypted_blob }
  // This way IDs and order are queryable but content is safe.

  async function savePerson(personData) {
    const encrypted = await CryptoManager.encrypt(personData);
    return set('people', {
      id:    personData.id,
      order: personData.order ?? Date.now(),
      _enc:  encrypted
    });
  }

  async function getAllPeople() {
    const rows = await getAll('people');
    const decrypted = await Promise.all(
      rows.map(async row => {
        try { return await CryptoManager.decrypt(row._enc); }
        catch { return null; }
      })
    );
    return decrypted
      .filter(Boolean)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  async function deletePerson(id) {
    return remove('people', id);
  }

  // ── Encrypted user CRUD ──────────────────────────────────
  async function saveUser(userData) {
    const encrypted = await CryptoManager.encrypt(userData);
    return set('users', {
      id:       userData.id,
      nameHash: userData.nameHash, // for lookup
      _enc:     encrypted
    });
  }

  async function getAllUsers() {
    const rows = await getAll('users');
    const decrypted = await Promise.all(
      rows.map(async row => {
        try { return await CryptoManager.decrypt(row._enc); }
        catch { return null; }
      })
    );
    return decrypted.filter(Boolean);
  }

  async function deleteUser(id) {
    return remove('users', id);
  }

  return {
    init,
    set, get, getAll, remove, clear,
    getSetting, setSetting,
    savePerson, getAllPeople, deletePerson,
    saveUser, getAllUsers, deleteUser,

    // ── Events ──────────────────────────────────────
    async saveEvent(eventData) {
      return set('events', eventData);
    },
    async getAllEvents() {
      const rows = await getAll('events');
      return rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },
    async deleteEvent(id) {
      return remove('events', id);
    }
  };
})();
