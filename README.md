# Zafer Partisi PWA — Kurulum Rehberi v2

## 📁 Dosya Yapısı

```
zaferpartisi/
├── index.html
├── manifest.json
├── sw.js                        ← Service Worker
├── firebase-messaging-sw.js     ← Push bildirim SW
├── firestore.rules              ← Firebase güvenlik kuralları
├── assets/
│   ├── intro.mp4               ← SENİN EKLEYECEĞİN (açılış videosu)
│   ├── logo.png                ← SENİN EKLEYECEĞİN (logo)
│   ├── banner1.png             ← SENİN EKLEYECEĞİN (1. popup banner)
│   ├── ataturk.png             ← SENİN EKLEYECEĞİN (2. popup Atatürk)
│   └── icons/                  ← PWA ikonları (realfavicongenerator.net)
├── css/
│   ├── base.css
│   ├── themes.css
│   ├── animations.css
│   └── components.css
└── js/
    ├── config.js               ← POPUP METİNLERİ + HARİTA İKONLARI BURAYA
    ├── crypto.js
    ├── db.js
    ├── firebase.js
    ├── auth.js
    ├── notifications.js
    ├── ui.js
    ├── people.js
    ├── sync.js
    ├── app.js
    └── devtools.js
```

---

## 🚀 Deploy

1. [Netlify](https://netlify.com) veya [Vercel](https://vercel.com)'e klasörü sürükle-bırak
2. **HTTPS zorunlu** — Service Worker ve Push notifications HTTPS olmadan çalışmaz
3. `firestore.rules` dosyasını Firebase Console → Firestore → Rules kısmına yapıştır

---

## 🔥 Firebase Kurulumu

### Firestore
Firebase Console → Firestore Database → "Production mode" ile oluştur → Rules tab → `firestore.rules` içeriğini yapıştır → Publish

### Firebase Storage
Firebase Console → Storage → "Start in production mode" → Rules:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if true;  // tighten after Firebase Auth
    }
  }
}
```

### Push Notifications (FCM)
1. Firebase Console → Project Settings → Cloud Messaging → **Web Push certificates** → **Generate key pair**
2. Kopyala → `js/config.js` içinde `vapidKey: 'YOUR_VAPID_PUBLIC_KEY_HERE'` satırını güncelle

---

## 🎬 Asset Ekle

| Dosya | Ne |
|---|---|
| `assets/intro.mp4` | Açılış videosu (kısa, <5MB) |
| `assets/logo.png` | Ana logo (512×512, şeffaf arka plan) |
| `assets/banner1.png` | 1. hoşgeldin popup görseli |
| `assets/ataturk.png` | 2. popup görseli (Atatürk fotoğrafı) |

PWA ikonları: [realfavicongenerator.net](https://realfavicongenerator.net) → logodan oluştur → `assets/icons/` klasörüne koy

---

## 📝 Popup Metinlerini Düzenle

`js/config.js` dosyasını aç → `popups` dizisindeki `title` ve `description` alanlarını değiştir:

```js
popups: [
  {
    image:       'assets/banner1.png',
    title:       'Başlık buraya',
    description: 'Açıklama buraya...'
  },
  {
    image:       'assets/ataturk.png',
    title:       'İstiklâl Marşı',
    description: 'İstiklal marşı mısraları...'
  }
]
```

---

## 🗺️ Harita Konumları

Adminler haritaya tıklayarak konum ekleyebilir:
- İkon seçimi (Parti Binası, Etkinlik Yeri, Ofis, vb.)
- **Planlı yayınlama**: "3 gün sonra paylaş", "belirli tarih" seçenekleri
- **Otomatik silme**: "1 hafta sonra sil", "asla silme" vb.

---

## 👤 İlk Kullanım (Admin)

1. Uygulamayı aç → giriş ekranı
2. **Ad:** `Ceyhun` · **Soyad:** `Karaarslan` · **Kod:** istediğin kod
3. İlk kayıt olarak admin hesabı oluşturulur
4. Ayarlar → Kullanıcıları Yönet → kullanıcı ekle / admin yap / kodu sıfırla

---

## 📲 Push Notification

Ayarlar → **Bildirim Gönder** → Tüm kayıtlı kullanıcılara anlık bildirim gider.
Etkinlik eklenince/silinince de **otomatik** bildirim gönderilir.

---

## 🔐 Güvenlik

- Şifreler SHA-256 hash → hiçbir zaman plain text saklanmaz
- AES-256 ile şifreli session (IndexedDB)
- DevTools: F12 / sağ tık / Ctrl+Shift+I bloklanır + boyut tespiti
- Firestore'da tüm veri Firebase Rules ile korunur
