/* ============================================================
   Firebase — init, Firestore helpers, Storage upload
   Uses Firebase Compat SDK (global `firebase` object)
   ============================================================ */

const FirebaseService = (() => {
  const config = {
    apiKey:            "AIzaSyBrDdL_1nSZZxVUyAxi2N1dCK7pEEgiLN8",
    authDomain:        "zafer-partisi-a407b.firebaseapp.com",
    projectId:         "zafer-partisi-a407b",
    storageBucket:     "zafer-partisi-a407b.firebasestorage.app",
    messagingSenderId: "107383701317",
    appId:             "1:107383701317:web:0481a586e417d8f187082c"
  };

  let _app = null;
  let _db  = null;
  let _st  = null;
  let _msg = null;

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    if (_app) return;
    _app = firebase.initializeApp(config);
    _db  = firebase.firestore();
    _st  = firebase.storage();

    // Enable offline persistence (Firestore caches to IndexedDB)
    try {
      await _db.enablePersistence({ synchronizeTabs: true });
    } catch (e) {
      if (e.code !== 'failed-precondition' && e.code !== 'unimplemented') {
        console.warn('[Firebase] Persistence:', e);
      }
    }

    // FCM messaging (optional - only if supported)
    if (firebase.messaging.isSupported()) {
      _msg = firebase.messaging();
    }
  }

  function db()  { return _db;  }
  function st()  { return _st;  }
  function msg() { return _msg; }

  // ── Firestore helpers ─────────────────────────────────────
  const col = (name) => _db.collection(name);

  async function setDoc(collection, id, data) {
    return col(collection).doc(id).set(data, { merge: true });
  }

  async function getDoc(collection, id) {
    const snap = await col(collection).doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async function getDocs(collection, ...queries) {
    let ref = col(collection);
    for (const [field, op, val] of queries) ref = ref.where(field, op, val);
    const snap = await ref.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function deleteDoc(collection, id) {
    return col(collection).doc(id).delete();
  }

  function onSnapshot(collection, callback, ...queries) {
    let ref = col(collection);
    for (const [field, op, val] of queries) ref = ref.where(field, op, val);
    return ref.onSnapshot(snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(docs);
    });
  }

  // ── Firebase Storage — upload base64 image ────────────────
  async function uploadBase64(path, base64) {
    if (!base64 || !_st) return null;
    try {
      // Strip data:image/...;base64, prefix
      const clean = base64.split(',')[1];
      if (!clean) return null;
      const mimeMatch = base64.match(/data:([^;]+);base64/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ref = _st.ref(path);
      await ref.putString(clean, 'base64', { contentType: mime });
      return await ref.getDownloadURL();
    } catch (err) {
      console.error('[Firebase] Upload failed:', err);
      return null;
    }
  }

  async function deleteFile(path) {
    try { await _st.ref(path).delete(); } catch {}
  }

  // ── FCM Token management ──────────────────────────────────
  async function getFCMToken() {
    if (!_msg || !APP_CONFIG?.vapidKey || APP_CONFIG.vapidKey === 'YOUR_VAPID_PUBLIC_KEY_HERE') return null;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
      // Register FCM SW
      const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      return await _msg.getToken({ vapidKey: APP_CONFIG.vapidKey, serviceWorkerRegistration: sw });
    } catch (err) {
      console.warn('[FCM] Token error:', err);
      return null;
    }
  }

  async function saveFCMToken(userId, token) {
    if (!token) return;
    await setDoc('fcmTokens', userId, { token, updatedAt: Date.now() });
  }

  async function getAllFCMTokens() {
    try {
      const snap = await col('fcmTokens').get();
      return snap.docs.map(d => d.data().token).filter(Boolean);
    } catch { return []; }
  }

  // ── Send push notification via Firestore trigger ──────────
  // Creates a doc in /notifications; all clients listen via onSnapshot
  // For real background push, Cloud Functions would read this and send FCM
  async function sendNotification({ title, body, iconUrl }) {
    try {
      await col('notifications').add({
        title,
        body,
        iconUrl: iconUrl || 'assets/logo.png',
        createdAt: Date.now()
      });
    } catch (err) {
      console.warn('[Firebase] Notification send failed:', err);
    }
  }

  return {
    init, db, st, msg,
    setDoc, getDoc, getDocs, deleteDoc, onSnapshot,
    uploadBase64, deleteFile,
    getFCMToken, saveFCMToken, getAllFCMTokens,
    sendNotification
  };
})();
