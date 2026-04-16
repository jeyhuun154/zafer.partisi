/* ============================================================
   Auth — Login, registration, session
   Super admin: Ceyhun Karaarslan (first registered)
   Super admin can: grant/revoke admin from anyone, transfer super admin
   Regular admin can: only grant admin (not revoke)
   ============================================================ */

const Auth = (() => {
  // Super admin identity — stored as isSuperAdmin:true in Firestore
  // Displayed as normal "Admin" to everyone
  const SUPER_FIRST = 'ceyhun';
  const SUPER_LAST  = 'karaarslan';

  let _currentUser = null;

  function _nameHash(first, last) {
    return (first.trim().toLowerCase() + '|' + last.trim().toLowerCase());
  }

  // ── Init ─────────────────────────────────────────────────
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

  // ── Login ─────────────────────────────────────────────────
  async function login(firstName, lastName, code) {
    const fT = firstName.trim(), lT = lastName.trim();
    if (!fT || !lT || !code.trim()) return { success: false, error: 'Lütfen tüm alanları doldurun.' };

    const codeHash = await CryptoManager.hashCode(code);
    const nameHash = _nameHash(fT, lT);
    const isSuperAttempt = fT.toLowerCase() === SUPER_FIRST && lT.toLowerCase() === SUPER_LAST;

    let users = [];
    try { users = await FirebaseService.getDocs('users', ['nameHash', '==', nameHash]); }
    catch { users = (await DB.getAllUsers()).filter(u => u.nameHash === nameHash); }

    let matched = users.find(u => u.codeHash === codeHash);

    // First ever launch: create super admin account
    if (!matched && isSuperAttempt) {
      let total = 0;
      try { total = (await FirebaseService.getDocs('users')).length; } catch { total = (await DB.getAllUsers()).length; }
      if (total === 0) {
        matched = await _createUser({ firstName: fT, lastName: lT, codeHash, nameHash, isAdmin: true, isSuperAdmin: true });
      }
    }

    if (!matched) return { success: false, error: 'Ad, soyad veya kod hatalı.' };

    await _saveSession(matched);
    _currentUser = matched;
    return { success: true, user: matched };
  }

  // ── Self-registration ─────────────────────────────────────
  async function register(data) {
    const { firstName, lastName, code, birthDate, gender, profession, bloodType } = data;
    const fT = (firstName || '').trim(), lT = (lastName || '').trim();
    if (!fT || !lT || !code?.trim() || !birthDate || !gender || !(profession || '').trim())
      return { success: false, error: 'Zorunlu alanları doldurun.' };

    const nameHash = _nameHash(fT, lT);
    let existing = [];
    try { existing = await FirebaseService.getDocs('users', ['nameHash', '==', nameHash]); }
    catch { existing = (await DB.getAllUsers()).filter(u => u.nameHash === nameHash); }
    if (existing.length > 0) return { success: false, error: 'Bu isimde bir hesap zaten mevcut.' };

    const user = await _createUser({
      firstName: fT, lastName: lT, nameHash,
      codeHash: await CryptoManager.hashCode(code.trim()),
      birthDate, gender, profession: profession.trim(),
      bloodType: bloodType || null,
      isAdmin: false, isSuperAdmin: false
    });
    await _saveSession(user);
    _currentUser = user;
    return { success: true, user };
  }

  // ── Guest login ────────────────────────────────────────────
  async function loginAsGuest() {
    _currentUser = { id: 'guest', guest: true, isAdmin: false, isSuperAdmin: false };
    return _currentUser;
  }

  // ── Logout ────────────────────────────────────────────────
  async function logout() {
    _currentUser = null;
    await DB.remove('session', 'current');
  }

  // ── Internal helpers ──────────────────────────────────────
  async function _createUser(fields) {
    const user = { id: CryptoManager.generateId(), createdAt: Date.now(), isAdmin: false, isSuperAdmin: false, ...fields };
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
    // Only super admin can delete other admins
    const target = await FirebaseService.getDoc('users', userId).catch(() => null);
    if (target?.isAdmin && !isSuperAdmin()) return false;
    await FirebaseService.deleteDoc('users', userId);
    await DB.deleteUser(userId).catch(() => {});
    return true;
  }

  // Grant admin: any admin can grant
  // Revoke admin: only super admin can revoke
  async function setAdminStatus(userId, grantAdmin) {
    if (!isAdmin()) return { success: false, error: 'Yetkisiz.' };
    if (!grantAdmin && !isSuperAdmin()) {
      return { success: false, error: 'Adminliği sadece üst düzey admin alabilir.' };
    }
    // Can't remove super admin's admin via this function
    const target = await FirebaseService.getDoc('users', userId).catch(() => null);
    if (target?.isSuperAdmin && !grantAdmin) {
      return { success: false, error: 'Üst düzey adminlik transferi kullanın.' };
    }
    await FirebaseService.setDoc('users', userId, { isAdmin: grantAdmin });
    return { success: true };
  }

  // Transfer super admin status to another user (Ceyhun only)
  async function transferSuperAdmin(targetUserId) {
    if (!isSuperAdmin()) return { success: false, error: 'Sadece üst düzey admin transfer yapabilir.' };
    if (targetUserId === _currentUser?.id) return { success: false, error: 'Kendinize transfer yapamazsınız.' };

    // Grant new super admin
    await FirebaseService.setDoc('users', targetUserId, { isAdmin: true, isSuperAdmin: true });
    // Remove super admin from current user (stays regular admin)
    await FirebaseService.setDoc('users', _currentUser.id, { isSuperAdmin: false });
    // Update local session
    const updated = { ..._currentUser, isSuperAdmin: false };
    _currentUser = updated;
    await _saveSession(updated);
    return { success: true };
  }

  async function resetUserCode(userId, newCode) {
    if (!isAdmin()) return false;
    await FirebaseService.setDoc('users', userId, { codeHash: await CryptoManager.hashCode(newCode.trim()) });
    return true;
  }

  // ── Getters ───────────────────────────────────────────────
  function getUser()       { return _currentUser; }
  function isAdmin()       { return _currentUser?.isAdmin === true; }
  function isSuperAdmin()  { return _currentUser?.isSuperAdmin === true; }
  function isLoggedIn()    { return _currentUser !== null; }
  function isGuest()       { return _currentUser?.guest === true; }

  return {
    init, login, register, logout, loginAsGuest,
    addUser, deleteUser, setAdminStatus, transferSuperAdmin, resetUserCode, getAllUsers,
    getUser, isAdmin, isSuperAdmin, isLoggedIn, isGuest
  };
})();
