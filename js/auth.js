/* ============================================================
   Auth — Login, session persistence, admin detection
   
   Flow:
   1. First launch: admin (Ceyhun Karaarslan) enters name + code
      → account is created & stored encrypted, session saved
   2. Other users: admin adds them via manage-users panel
      → they log in with name + code on their own device
   3. On subsequent launches: session is auto-restored
   ============================================================ */

const Auth = (() => {
  // The one and only admin identifier (name-based detection)
  const ADMIN_FIRST = 'ceyhun';
  const ADMIN_LAST  = 'karaarslan';

  let _currentUser = null;

  // ── Build a nameHash for indexing ─────────────────────────
  function _nameHash(first, last) {
    return (first.trim().toLowerCase() + '|' + last.trim().toLowerCase());
  }

  // ── Init: try to restore session ─────────────────────────
  async function init() {
    try {
      const sessionRow = await DB.get('session', 'current');
      if (!sessionRow) return null;

      const user = await CryptoManager.decrypt(sessionRow._enc);
      _currentUser = user;
      return user;
    } catch {
      // Corrupted or missing session
      await DB.remove('session', 'current');
      return null;
    }
  }

  // ── Login ─────────────────────────────────────────────────
  async function login(firstName, lastName, code) {
    const fTrimmed = firstName.trim();
    const lTrimmed = lastName.trim();
    const codeHash = await CryptoManager.hashCode(code);
    const nameHash = _nameHash(fTrimmed, lTrimmed);
    const isAdminAttempt = (
      fTrimmed.toLowerCase() === ADMIN_FIRST &&
      lTrimmed.toLowerCase() === ADMIN_LAST
    );

    // Fetch all users
    const users = await DB.getAllUsers();

    // Look for a matching user
    let matched = users.find(u =>
      u.nameHash === nameHash && u.codeHash === codeHash
    );

    // First-ever launch: no users exist → admin auto-creates account
    if (!matched && users.length === 0 && isAdminAttempt) {
      const newAdmin = {
        id:        CryptoManager.generateId(),
        firstName: fTrimmed,
        lastName:  lTrimmed,
        nameHash,
        codeHash,
        isAdmin:   true,
        createdAt: Date.now()
      };
      await DB.saveUser(newAdmin);
      matched = newAdmin;
    }

    if (!matched) {
      return { success: false, error: 'Ad, soyad veya kod hatalı. Lütfen tekrar deneyin.' };
    }

    // Save encrypted session
    await _saveSession(matched);
    _currentUser = matched;
    return { success: true, user: matched };
  }

  // ── Logout ────────────────────────────────────────────────
  async function logout() {
    _currentUser = null;
    await DB.remove('session', 'current');
  }

  // ── Save session ──────────────────────────────────────────
  async function _saveSession(user) {
    const encrypted = await CryptoManager.encrypt(user);
    await DB.set('session', { key: 'current', _enc: encrypted });
  }

  // ── Add a new user (admin only) ───────────────────────────
  async function addUser(firstName, lastName, code) {
    if (!isAdmin()) return { success: false, error: 'Yetkisiz işlem.' };

    const fTrimmed = firstName.trim();
    const lTrimmed = lastName.trim();
    if (!fTrimmed || !lTrimmed || !code.trim()) {
      return { success: false, error: 'Tüm alanları doldurun.' };
    }

    const nameHash = _nameHash(fTrimmed, lTrimmed);
    const codeHash = await CryptoManager.hashCode(code);

    // Check duplicate
    const existing = await DB.getAllUsers();
    if (existing.some(u => u.nameHash === nameHash)) {
      return { success: false, error: 'Bu isimde bir kullanıcı zaten var.' };
    }

    const newUser = {
      id:        CryptoManager.generateId(),
      firstName: fTrimmed,
      lastName:  lTrimmed,
      nameHash,
      codeHash,
      isAdmin:   false,
      createdAt: Date.now()
    };

    await DB.saveUser(newUser);
    return { success: true, user: newUser };
  }

  // ── Delete a user (admin only, can't delete self) ─────────
  async function deleteUser(userId) {
    if (!isAdmin()) return false;
    if (_currentUser && _currentUser.id === userId) return false; // can't delete self
    await DB.deleteUser(userId);
    return true;
  }

  // ── Getters ───────────────────────────────────────────────
  function getUser()  { return _currentUser; }
  function isAdmin()  { return _currentUser?.isAdmin === true; }
  function isLoggedIn() { return _currentUser !== null; }

  async function getAllUsers() {
    if (!isAdmin()) return [];
    return DB.getAllUsers();
  }

  return {
    init, login, logout,
    addUser, deleteUser, getAllUsers,
    getUser, isAdmin, isLoggedIn
  };
})();
