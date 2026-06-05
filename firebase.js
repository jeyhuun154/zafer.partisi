/* ============================================================
   Firebase — init, Firestore, Storage helpers
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

  let _app = null, _db = null, _st = null, _msg = null;

  async function init() {
    if (_app) return;
    _app = firebase.apps?.length ? firebase.apps[0] : firebase.initializeApp(config);
    _db  = firebase.firestore();
    _st  = firebase.storage ? firebase.storage() : null;

    try {
      await _db.enableMultiTabIndexedDbPersistence();
    } catch (e) {
      if (e.code !== 'failed-precondition' && e.code !== 'unimplemented') {
        console.warn('[Firebase] Persistence:', e.code);
      }
    }

    if (firebase.messaging?.isSupported?.()) {
      try { _msg = firebase.messaging(); } catch {}
    }
  }

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
    return ref.onSnapshot(
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.warn('[Firebase] onSnapshot error:', err)
    );
  }

  async function deleteFile(path) {
    if (!_st) return;
    try { await _st.ref(path).delete(); } catch {}
  }

  // ── FCM / Notifications ───────────────────────────────────
  async function getFCMToken() {
    if (!_msg || !APP_CONFIG?.vapidKey || APP_CONFIG.vapidKey === 'YOUR_VAPID_PUBLIC_KEY_HERE') return null;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
      const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      return await _msg.getToken({ vapidKey: APP_CONFIG.vapidKey, serviceWorkerRegistration: sw });
    } catch (err) {
      console.warn('[FCM] Token error:', err.message);
      return null;
    }
  }

  async function saveFCMToken(userId, token) {
    if (!token) return;
    return setDoc('fcmTokens', userId, { token, updatedAt: Date.now() });
  }

  function getNotifIconUrl() {
    try { return new URL('/assets/icons/icon-192.png', window.location.href).href; }
    catch { return '/assets/icons/icon-192.png'; }
  }

  async function sendNotification({ title, body, iconUrl }) {
    try {
      return col('notifications').add({
        title,
        body:      body || '',
        iconUrl:   iconUrl || getNotifIconUrl(),
        createdAt: Date.now()
      });
    } catch (err) {
      console.warn('[Firebase] Notification send failed:', err.message);
    }
  }

  return {
    init,
    setDoc, getDoc, getDocs, deleteDoc, onSnapshot,
    deleteFile,
    getFCMToken, saveFCMToken, getNotifIconUrl,
    sendNotification
  };
})();
