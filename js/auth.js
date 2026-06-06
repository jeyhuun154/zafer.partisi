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
      // Session exists but Firebase unreachable — still use cached session
      _currentUser = user;
      return user;
    } catch {
      await DB.remove('session', 'current').catch(() => {});
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
    try {
      users = await FirebaseService.getDocs('users', ['nameHash', '==', nameHash]);
    } catch (e) {
      return { success: false, error: 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.' };
    }

    let matched = users.find(u => u.codeHash === codeHash);

    // First ever launch: create super admin account
    if (!matched && isSuperAttempt) {
      let total = 0;
      try { total = (await FirebaseService.getDocs('users')).length; } catch {}
      if (total === 0) {
        matched = await _createUser({ firstName: fT, lastName: lT, codeHash, nameHash, isAdmin: true, isSuperAdmin: true });
      }
    }

    if (!matched) return { success: false, error: 'Ad, soyad veya kod hatalı.' };

    // ── Check for any pending deletion actions ──
    const pending = await _checkPendingAction(matched.id);
    if (pending && pending.type === 'delete') {
      return {
        success: false,
        error: `Hesabınız ${pending.requesterName || 'bir yetkili'} tarafından silinmek üzere işaretlendi. Üst yetkili onayı bekleniyor.`
      };
    }

    await _saveSession(matched);
    _currentUser = matched;
    return { success: true, user: matched };
  }

  // ── Check pending deletion for a user (kept for _getPendingDeletionUserIds) ────────────────────
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

    // Block self-registration under the reserved super admin name
    if (fT.toLowerCase() === SUPER_FIRST && lT.toLowerCase() === SUPER_LAST) {
      return { success: false, error: 'Bu isimle kayıt olunamaz.' };
    }

    const nameHash = _nameHash(fT, lT);
    let existing = [];
    try {
      existing = await FirebaseService.getDocs('users', ['nameHash', '==', nameHash]);
    } catch (e) {
      return { success: false, error: 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.' };
    }
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
    await DB.remove('session', 'current').catch(() => {});
  }

  // ── Internal helpers ──────────────────────────────────────
  async function _createUser(fields) {
    const user = { id: CryptoManager.generateId(), createdAt: Date.now(), isAdmin: false, isSuperAdmin: false, ...fields };
    await FirebaseService.setDoc('users', user.id, user);
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
      const pendingDelIds = await _getPendingDeletionUserIds();
      return all.filter(u => !pendingDelIds.has(u.id));
    } catch { return []; }
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
    if (!isAdmin()) return false;
    if (userId === _currentUser?.id) return false;
    const target = await FirebaseService.getDoc('users', userId).catch(() => null);
    if (!target) return false;
    if (target.isSuperAdmin) return false;
    // Super admin can hard-delete directly; regular admins must go through approval workflow
    if (isSuperAdmin()) {
      await FirebaseService.deleteDoc('users', userId);
      return true;
    }
    // Regular admins: use approval workflow
    const result = await requestDeleteUser(userId);
    return result.success;
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
  async function requestDeleteUser(targetUserId) {
    if (!isAdmin()) return { success: false, error: 'Yetkisiz.' };
    if (targetUserId === _currentUser?.id) return { success: false, error: 'Kendinizi silemezsiniz.' };
    const target = await FirebaseService.getDoc('users', targetUserId).catch(() => null);
    if (!target) return { success: false, error: 'Kullanıcı bulunamadı.' };
    if (target.isSuperAdmin) return { success: false, error: 'Üst yetkili silinemez.' };

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
  async function approveAction(actionId) {
    if (!isSuperAdmin()) return { success: false, error: 'Yetkisiz.' };
    const action = await FirebaseService.getDoc('pendingActions', actionId).catch(() => null);
    if (!action) return { success: false, error: 'İşlem bulunamadı.' };

    if (action.type === 'delete') {
      // Attempt deletion — if it fails, return error immediately (don't mark as approved)
      try {
        await FirebaseService.deleteDoc('users', action.targetUserId);
      } catch (e) {
        console.error('[Auth] approveAction delete failed:', e);
        return { success: false, error: 'Kullanıcı silinemedi: ' + (e.message || 'Firebase izin hatası. Firestore kurallarını kontrol edin.') };
      }
      // Also clean up any FCM tokens for this user
      try { await FirebaseService.deleteDoc('fcmTokens', action.targetUserId); } catch {}
    } else if (action.type === 'delete_book') {
      try {
        await FirebaseService.deleteDoc('library', action.targetBookId);
      } catch (e) {
        return { success: false, error: 'Kitap silinemedi: ' + (e.message || '') };
      }
    } else if (action.type === 'promote') {
      try {
        await FirebaseService.setDoc('users', action.targetUserId, { isAdmin: true });
      } catch (e) {
        return { success: false, error: 'Admin yetkisi verilemedi: ' + (e.message || '') };
      }
      // Refresh session if current user was promoted
      if (action.targetUserId === _currentUser?.id) {
        const updated = { ..._currentUser, isAdmin: true };
        _currentUser = updated;
        await _saveSession(updated);
      }
    }

    // Mark action as approved only after the main operation succeeded
    await FirebaseService.setDoc('pendingActions', actionId, {
      status: 'approved',
      resolvedAt: Date.now(),
      resolverId: _currentUser.id,
      resolverName: `${_currentUser.firstName} ${_currentUser.lastName}`
    });

    await _logAction({
      type: action.type === 'delete' ? 'deletion_approved'
          : action.type === 'delete_book' ? 'book_deletion_approved'
          : 'promotion_approved',
      targetUserId:   action.targetUserId,
      targetUserName: action.targetUserName || action.targetBookTitle,
      actorId:        _currentUser.id,
      actorName:      `${_currentUser.firstName} ${_currentUser.lastName}`,
      actionId,
      originalRequesterId:   action.requesterId,
      originalRequesterName: action.requesterName
    });

    try {
      const typeLabel = action.type === 'delete' ? 'silindi'
                      : action.type === 'delete_book' ? 'kitap silindi'
                      : 'admin yapıldı';
      const targetName = action.targetUserName || action.targetBookTitle || '';
      await FirebaseService.sendNotification({
        title: `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}: ${targetName}`,
        body:  `Talep eden: ${action.requesterName} · Onaylayan: ${_currentUser.firstName} ${_currentUser.lastName}`
      });
    } catch {}

    return { success: true };
  }

  // ── Reject action (Super Admin only) ──────────────────────
  async function rejectAction(actionId) {
    if (!isSuperAdmin()) return { success: false, error: 'Yetkisiz.' };
    const action = await FirebaseService.getDoc('pendingActions', actionId).catch(() => null);
    if (!action) return { success: false, error: 'İşlem bulunamadı.' };

    await FirebaseService.setDoc('pendingActions', actionId, {
      status: 'rejected',
      resolvedAt: Date.now(),
      resolverId: _currentUser.id,
      resolverName: `${_currentUser.firstName} ${_currentUser.lastName}`
    });

    await _logAction({
      type: action.type === 'delete' ? 'deletion_rejected'
          : action.type === 'delete_book' ? 'book_deletion_rejected'
          : 'promotion_rejected',
      targetUserId:   action.targetUserId,
      targetUserName: action.targetUserName || action.targetBookTitle,
      actorId:        _currentUser.id,
      actorName:      `${_currentUser.firstName} ${_currentUser.lastName}`,
      actionId,
      originalRequesterId:   action.requesterId,
      originalRequesterName: action.requesterName
    });

    try {
      const typeLabel = action.type === 'delete' ? 'silme'
                      : action.type === 'delete_book' ? 'kitap silme'
                      : 'admin terfisi';
      const targetName = action.targetUserName || action.targetBookTitle || '';
      await FirebaseService.sendNotification({
        title: `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} talebi reddedildi: ${targetName}`,
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
    getUser, isAdmin, isSuperAdmin, isLoggedIn, isGuest,
    // Expose _nameHash for potential debug (no sensitive data)
  };
})();
