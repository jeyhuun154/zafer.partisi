/* ============================================================
   Auth — Login, registration, session, admin management
   Uses Firebase Firestore for user storage (real-time sync).
   Local IndexedDB only for encrypted session token.
   ============================================================ */

const Auth = (() => {
  const ADMIN_FIRST = 'ceyhun';
  const ADMIN_LAST  = 'karaarslan';

  let _currentUser = null;

  function _nameHash(first, last) {
    return (first.trim().toLowerCase() + '|' + last.trim().toLowerCase());
  }

  // ── Init: restore session ────────────────────────────────
  async function init() {
    try {
      const row = await DB.get('session', 'current');
      if (!row) return null;
      const user = await CryptoManager.decrypt(row._enc);
      try {
        const fresh = await FirebaseService.getDoc('users', user.id);
        if (fresh) { _currentUser = fresh; await _saveSession(fresh); return fresh; }
      } catch {}
      _currentUser = user;
      return user;
    } catch {
      await DB.remove('session', 'current');
      return null;
    }
  }

  // ── Login ────────────────────────────────────────────────
  async function login(firstName, lastName, code) {
    const fT = firstName.trim(), lT = lastName.trim();
    if (!fT || !lT || !code.trim()) return { success: false, error: 'Lütfen tüm alanları doldurun.' };

    const codeHash = await CryptoManager.hashCode(code);
    const nameHash = _nameHash(fT, lT);
    const isAdminAttempt = fT.toLowerCase() === ADMIN_FIRST && lT.toLowerCase() === ADMIN_LAST;

    let users = [];
    try { users = await FirebaseService.getDocs('users', ['nameHash', '==', nameHash]); }
    catch { users = (await DB.getAllUsers()).filter(u => u.nameHash === nameHash); }

    let matched = users.find(u => u.codeHash === codeHash);

    if (!matched && isAdminAttempt) {
      let total = 0;
      try { total = (await FirebaseService.getDocs('users')).length; }
      catch { total = (await DB.getAllUsers()).length; }
      if (total === 0) matched = await _createUser({ firstName: fT, lastName: lT, codeHash, nameHash, isAdmin: true });
    }

    if (!matched) return { success: false, error: 'Ad, soyad veya kod hatalı.' };

    await _saveSession(matched);
    _currentUser = matched;
    return { success: true, user: matched };
  }

  // ── Self-registration ────────────────────────────────────
  async function register(data) {
    const { firstName, lastName, code, birthDate, gender, profession, bloodType } = data;
    if (!firstName?.trim() || !lastName?.trim() || !code?.trim() || !birthDate || !gender || !profession?.trim())
      return { success: false, error: 'Zorunlu alanları doldurun.' };

    const fT = firstName.trim(), lT = lastName.trim();
    const nameHash = _nameHash(fT, lT);
    let existing = [];
    try { existing = await FirebaseService.getDocs('users', ['nameHash', '==', nameHash]); }
    catch { existing = (await DB.getAllUsers()).filter(u => u.nameHash === nameHash); }
    if (existing.length > 0) return { success: false, error: 'Bu isimde bir hesap zaten mevcut.' };

    const user = await _createUser({
      firstName: fT, lastName: lT, nameHash,
      codeHash: await CryptoManager.hashCode(code),
      birthDate, gender, profession: profession.trim(),
      bloodType: bloodType || null, isAdmin: false
    });
    await _saveSession(user);
    _currentUser = user;
    return { success: true, user };
  }

  // ── Guest login ──────────────────────────────────────────
  async function loginAsGuest() {
    _currentUser = { id: 'guest', guest: true, isAdmin: false };
    return _currentUser;
  }

  // ── Logout ───────────────────────────────────────────────
  async function logout() {
    _currentUser = null;
    await DB.remove('session', 'current');
  }

  async function _createUser(fields) {
    const user = { id: CryptoManager.generateId(), createdAt: Date.now(), isAdmin: false, ...fields };
    await FirebaseService.setDoc('users', user.id, user);
    await DB.saveUser(user);
    return user;
  }

  async function _saveSession(user) {
    const enc = await CryptoManager.encrypt(user);
    await DB.set('session', { key: 'current', _enc: enc });
  }

  // ── Admin ops ─────────────────────────────────────────────
  async function getAllUsers() {
    if (!isAdmin()) return [];
    try { return await FirebaseService.getDocs('users'); }
    catch { return DB.getAllUsers(); }
  }

  async function addUser(firstName, lastName, code) {
    if (!isAdmin()) return { success: false, error: 'Yetkisiz.' };
    const fT = firstName.trim(), lT = lastName.trim();
    if (!fT || !lT || !code.trim()) return { success: false, error: 'Tüm alanları doldurun.' };
    const nameHash = _nameHash(fT, lT);
    let existing = [];
    try { existing = await FirebaseService.getDocs('users', ['nameHash', '==', nameHash]); } catch {}
    if (existing.length > 0) return { success: false, error: 'Bu isimde kullanıcı zaten var.' };
    const user = await _createUser({ firstName: fT, lastName: lT, nameHash, codeHash: await CryptoManager.hashCode(code), isAdmin: false });
    return { success: true, user };
  }

  async function deleteUser(userId) {
    if (!isAdmin() || userId === _currentUser?.id) return false;
    await FirebaseService.deleteDoc('users', userId);
    await DB.deleteUser(userId).catch(() => {});
    return true;
  }

  async function setAdminStatus(userId, adminVal) {
    if (!_currentUser?.isAdmin) return false;
    await FirebaseService.setDoc('users', userId, { isAdmin: adminVal });
    return true;
  }

  async function resetUserCode(userId, newCode) {
    if (!isAdmin()) return false;
    await FirebaseService.setDoc('users', userId, { codeHash: await CryptoManager.hashCode(newCode.trim()) });
    return true;
  }

  function getUser()    { return _currentUser; }
  function isAdmin()    { return _currentUser?.isAdmin === true; }
  function isLoggedIn() { return _currentUser !== null; }
  function isGuest()    { return _currentUser?.guest === true; }

  return { init, login, register, logout, loginAsGuest, addUser, deleteUser, setAdminStatus, resetUserCode, getAllUsers, getUser, isAdmin, isLoggedIn, isGuest };
})();
