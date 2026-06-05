/* ============================================================
   Auth — Login, registration, session
   Super admin: Ceyhun Karaarslan (first registered)
   Super admin can: grant/revoke admin from anyone, transfer super admin
   Regular admin can: only grant admin (not revoke)

   Deletion workflow:
     • Regular admin  → requestDeleteUser()  → creates pendingAction{type:'delete'}
                       → target user enters pendingDeletion state (hidden + blocked)
     • Super admin    → approveAction()       → permanent delete
                       → rejectAction()       → full restore, as if never requested
   ============================================================ */

const Auth = (() => {
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

    // ── Check for pending deletion ────────────────────────
    const pendingDeletion = await _checkPendingDeletion(matched.id);
    if (pendingDeletion) {
      return {
        success: false,
        error: `Hesabınız şu anda silme incelemesinde. Talebi başlatan: ${pendingDeletion.requesterName}. Üst yetkili onayı bekleniyor.`
      };
    }

    // ── Check other pending actions ───────────────────────
    const pending = await _checkPendingAction(matched.id);
    if (pending && pending.type === 'delete') {
      return {
        success: false,
        error: `Hesabınız ${pending.requesterName} tarafından silinmek üzere işaretlendi. Durum: ${_formatStatus(pending.status)}. Üst yetkili onayına sunulmuştur.`
      };
    }

    await _saveSession(matched);
    _currentUser = matched;
    return { success: true, user: matched };
  }

  // ── Check pending deletion for a user ────────────────────
  async function _checkPendingDeletion(userId) {
    try {
      const docs = await FirebaseService.getDocs('pendingActions',
        ['targetUserId', '==', userId],
        ['status', '==', 'pending']
      );
      return docs.find(d => d.type === 'delete') || null;
    } catch { return null; }
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
    try {
      const all = await FirebaseService.getDocs('users');
      // Filter out users with pending deletion so they don't appear in public list
      const pendingDelIds = await _getPendingDeletionUserIds();
      return all.filter(u => !pendingDelIds.has(u.id));
    }
    catch { return DB.getAllUsers(); }
  }

  // Returns Set of userIds currently under pending deletion
  async function _getPendingDeletionUserIds() {
    try {
      const docs = await FirebaseService.getDocs('pendingActions', ['status', '==', 'pending']);
      const delDocs = docs.filter(d => d.type === 'delete');
      return new Set(delDocs.map(d => d.targetUserId));
    } catch { return new Set(); }
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
    const target = await FirebaseService.getDoc('users', userId).catch(() => null);
    if (target?.isAdmin && !isSuperAdmin()) return false;
    await FirebaseService.deleteDoc('users', userId);
    await DB.deleteUser(userId).catch(() => {});
    return true;
  }

  async function setAdminStatus(userId, grantAdmin) {
    if (!isAdmin()) return { success: false, error: 'Yetkisiz.' };
    if (!grantAdmin && !isSuperAdmin()) {
      return { success: false, error: 'Adminliği sadece üst düzey admin alabilir.' };
    }
    const target = await FirebaseService.getDoc('users', userId).catch(() => null);
    if (target?.isSuperAdmin && !grantAdmin) {
      return { success: false, error: 'Üst düzey adminlik transferi kullanın.' };
    }
    await FirebaseService.setDoc('users', userId, { isAdmin: grantAdmin });
    return { success: true };
  }

  async function transferSuperAdmin(targetUserId) {
    if (!isSuperAdmin()) return { success: false, error: 'Sadece üst düzey admin transfer yapabilir.' };
    if (targetUserId === _currentUser?.id) return { success: false, error: 'Kendinize transfer yapamazsınız.' };
    await FirebaseService.setDoc('users', targetUserId, { isAdmin: true, isSuperAdmin: true });
    await FirebaseService.setDoc('users', _currentUser.id, { isSuperAdmin: false });
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

  // ── Pending Actions ───────────────────────────────────────
  async function _checkPendingAction(userId) {
    try {
      const docs = await FirebaseService.getDocs('pendingActions', ['targetUserId', '==', userId]);
      return docs.find(d => d.status === 'pending');
    } catch { return null; }
  }

  function _formatStatus(s) {
    return s === 'pending' ? 'Bekliyor' : s === 'approved' ? 'Onaylandı' : s === 'rejected' ? 'Reddedildi' : s;
  }

  // ── Request user deletion (standard admin) ────────────────
  // Creates a pendingAction; user becomes inaccessible immediately (hidden from lists, blocked from login)
  async function requestDeleteUser(targetUserId) {
    if (!isAdmin()) return { success: false, error: 'Yetkisiz.' };
    if (targetUserId === _currentUser?.id) return { success: false, error: 'Kendinizi silemezsiniz.' };
    const target = await FirebaseService.getDoc('users', targetUserId).catch(() => null);
    if (!target) return { success: false, error: 'Kullanıcı bulunamadı.' };
    if (target.isSuperAdmin) return { success: false, error: 'Üst yetkili silinemez.' };

    // Check no duplicate pending deletion already exists
    const existing = await _checkPendingDeletion(targetUserId);
    if (existing) return { success: false, error: 'Bu kullanıcı için zaten bekleyen bir silme talebi var.' };

    const actionId = CryptoManager.generateId();
    await FirebaseService.setDoc('pendingActions', actionId, {
      id: actionId,
      type: 'delete',
      targetUserId,
      targetUserName: `${target.firstName} ${target.lastName}`,
      requesterId: _currentUser.id,
      requesterName: `${_currentUser.firstName} ${_currentUser.lastName}`,
      status: 'pending',
      createdAt: Date.now()
    });

    // Log the action
    await _logAction({
      type: 'deletion_requested',
      targetUserId,
      targetUserName: `${target.firstName} ${target.lastName}`,
      actorId: _currentUser.id,
      actorName: `${_currentUser.firstName} ${_currentUser.lastName}`,
      actionId
    });

    return { success: true };
  }

  async function requestPromoteUser(targetUserId) {
    if (!isAdmin()) return { success: false, error: 'Yetkisiz.' };
    const target = await FirebaseService.getDoc('users', targetUserId).catch(() => null);
    if (!target) return { success: false, error: 'Kullanıcı bulunamadı.' };
    if (target.isAdmin) return { success: false, error: 'Kullanıcı zaten admin.' };

    const actionId = CryptoManager.generateId();
    await FirebaseService.setDoc('pendingActions', actionId, {
      id: actionId,
      type: 'promote',
      targetUserId,
      targetUserName: `${target.firstName} ${target.lastName}`,
      requesterId: _currentUser.id,
      requesterName: `${_currentUser.firstName} ${_currentUser.lastName}`,
      status: 'pending',
      createdAt: Date.now()
    });

    await _logAction({
      type: 'promotion_requested',
      targetUserId,
      targetUserName: `${target.firstName} ${target.lastName}`,
      actorId: _currentUser.id,
      actorName: `${_currentUser.firstName} ${_currentUser.lastName}`,
      actionId
    });

    return { success: true };
  }

  async function getPendingActions() {
    if (!isSuperAdmin()) return [];
    try {
      return await FirebaseService.getDocs('pendingActions', ['status', '==', 'pending']);
    } catch { return []; }
  }

  // ── Approve action (Super Admin only) ─────────────────────
  // delete  → permanently removes user from Firestore + IDB
  // promote → grants admin immediately
  async function approveAction(actionId) {
    if (!isSuperAdmin()) return { success: false, error: 'Yetkisiz.' };
    const action = await FirebaseService.getDoc('pendingActions', actionId).catch(() => null);
    if (!action) return { success: false, error: 'İşlem bulunamadı.' };

    if (action.type === 'delete') {
      // Permanent deletion
      await FirebaseService.deleteDoc('users', action.targetUserId);
      await DB.deleteUser(action.targetUserId).catch(() => {});
    } else if (action.type === 'promote') {
      await FirebaseService.setDoc('users', action.targetUserId, { isAdmin: true });
    }

    await FirebaseService.setDoc('pendingActions', actionId, {
      status: 'approved',
      resolvedAt: Date.now(),
      resolverId: _currentUser.id,
      resolverName: `${_currentUser.firstName} ${_currentUser.lastName}`
    });

    // Log the approval
    await _logAction({
      type: action.type === 'delete' ? 'deletion_approved' : 'promotion_approved',
      targetUserId:   action.targetUserId,
      targetUserName: action.targetUserName,
      actorId:        _currentUser.id,
      actorName:      `${_currentUser.firstName} ${_currentUser.lastName}`,
      actionId,
      originalRequesterId:   action.requesterId,
      originalRequesterName: action.requesterName
    });

    // Broadcast a notification so all users see the outcome
    try {
      const typeLabel = action.type === 'delete' ? 'silindi' : 'admin yapıldı';
      await FirebaseService.sendNotification({
        title: `Kullanıcı ${typeLabel}: ${action.targetUserName}`,
        body:  `Talep eden: ${action.requesterName} · Onaylayan: ${_currentUser.firstName} ${_currentUser.lastName}`
      });
    } catch {}

    return { success: true };
  }

  // ── Reject action (Super Admin only) ──────────────────────
  // delete  → fully restores user (account is accessible again)
  // promote → request simply discarded; no state change
  async function rejectAction(actionId) {
    if (!isSuperAdmin()) return { success: false, error: 'Yetkisiz.' };
    const action = await FirebaseService.getDoc('pendingActions', actionId).catch(() => null);
    if (!action) return { success: false, error: 'İşlem bulunamadı.' };

    // For deletion rejections: user is fully restored — they were only "hidden",
    // their Firestore document was never touched, so no extra restore step needed.
    // We simply mark the pendingAction as rejected.

    await FirebaseService.setDoc('pendingActions', actionId, {
      status: 'rejected',
      resolvedAt: Date.now(),
      resolverId: _currentUser.id,
      resolverName: `${_currentUser.firstName} ${_currentUser.lastName}`
    });

    // Log the rejection
    await _logAction({
      type: action.type === 'delete' ? 'deletion_rejected' : 'promotion_rejected',
      targetUserId:   action.targetUserId,
      targetUserName: action.targetUserName,
      actorId:        _currentUser.id,
      actorName:      `${_currentUser.firstName} ${_currentUser.lastName}`,
      actionId,
      originalRequesterId:   action.requesterId,
      originalRequesterName: action.requesterName
    });

    // Broadcast rejection notification
    try {
      const typeLabel = action.type === 'delete' ? 'silme' : 'admin terfisi';
      await FirebaseService.sendNotification({
        title: `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} talebi reddedildi: ${action.targetUserName}`,
        body:  `Talep eden: ${action.requesterName} · Reddeden: ${_currentUser.firstName} ${_currentUser.lastName}`
      });
    } catch {}

    return { success: true };
  }

  // ── Audit log ─────────────────────────────────────────────
  async function _logAction(data) {
    try {
      const logId = CryptoManager.generateId();
      await FirebaseService.setDoc('actionLogs', logId, {
        id: logId,
        ...data,
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn('[Auth] Audit log failed:', e.message);
    }
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
    requestDeleteUser, requestPromoteUser, getPendingActions, approveAction, rejectAction,
    getUser, isAdmin, isSuperAdmin, isLoggedIn, isGuest
  };
})();
