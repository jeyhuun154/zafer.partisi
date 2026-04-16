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
    // Prevent duplicate initialization
    if (firebase.apps?.length) {
      _app = firebase.apps[0];
    } else {
      _app = firebase.initializeApp(config);
    }
    _db = firebase.firestore();
    _st = firebase.storage ? firebase.storage() : null;

    try {
      await _db.enablePersistence({ synchronizeTabs: true });
    } catch (e) {
      if (e.code !== 'failed-precondition' && e.code !== 'unimplemented') {
        console.warn('[Firebase] Persistence:', e.code);
      }
    }

    if (firebase.messaging?.isSupported?.()) {
      try { _msg = firebase.messaging(); } catch {}
    }
  }

  function db()  { return _db; }
  function st()  { return _st; }
  function msg() { return _msg; }

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

  // ── Upload base64 image to Firebase Storage ───────────────
  // Returns download URL or null. Falls back gracefully.
  async function uploadBase64(path, base64) {
    if (!base64 || !base64.includes(',')) return null;
    if (!_st) { console.warn('[Firebase] Storage not initialized'); return null; }

    try {
      const parts    = base64.split(',');
      const mimeMatch = parts[0].match(/data:([^;]+);base64/);
      const mime     = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const dataStr  = parts[1];
      if (!dataStr) return null;

      const ref = _st.ref(path);

      // Convert base64 to Uint8Array for more reliable upload
      const binary = atob(dataStr);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const uploadTask = ref.put(bytes.buffer, { contentType: mime });

      // Wait for upload with timeout
      const snapshot = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Upload timeout')), 30000);
        uploadTask.then(snap => { clearTimeout(timer); resolve(snap); }).catch(err => { clearTimeout(timer); reject(err); });
      });

      return await snapshot.ref.getDownloadURL();
    } catch (err) {
      console.error('[Firebase] Upload error:', err.message || err);
      return null;
    }
  }

  async function deleteFile(path) {
    if (!_st) return;
    try { await _st.ref(path).delete(); } catch {}
  }

  // ── Notification helpers ──────────────────────────────────
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

  // Get absolute icon URL for notifications
  function getNotifIconUrl() {
    try {
      return new URL('/assets/icons/icon-192.png', window.location.href).href;
    } catch {
      return '/assets/icons/icon-192.png';
    }
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
    init, db, st, msg,
    setDoc, getDoc, getDocs, deleteDoc, onSnapshot,
    uploadBase64, deleteFile,
    getFCMToken, saveFCMToken, getNotifIconUrl,
    sendNotification
  };
})();
