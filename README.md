# Zafer Partisi PWA — Kurulum Rehberi

## 📁 Dosya Yapısı

```
zaferpartisi/
├── index.html
├── manifest.json
├── sw.js
├── assets/
│   ├── intro.mp4          ← SENİN EKLEYECEĞİN (açılış videosu)
│   ├── logo.png           ← SENİN EKLEYECEĞİN (logo)
│   └── icons/
│       ├── icon-72.png    ← PWA ikonları (tüm boyutlar lazım)
│       ├── icon-96.png
│       ├── icon-128.png
│       ├── icon-144.png
│       ├── icon-152.png
│       ├── icon-192.png
│       ├── icon-384.png
│       └── icon-512.png
├── css/
│   ├── base.css
│   ├── themes.css
│   ├── animations.css
│   └── components.css
└── js/
    ├── crypto.js
    ├── db.js
    ├── auth.js
    ├── ui.js
    ├── people.js
    ├── sync.js
    └── app.js
```

---

## 🚀 Deploy Etme

Bu bir **static web uygulaması**. Herhangi bir web sunucusuna yükleyebilirsin:
- GitHub Pages
- Netlify / Vercel (ücretsiz)
- Kendi sunucun (Apache, Nginx)

> ⚠️ **ZORUNLU:** Service Worker çalışması için uygulamanın **HTTPS** üzerinde çalışması şart.  
> `localhost` HTTP'de de çalışır (geliştirme için).

---

## 🎬 Kendi Video & Logonu Ekle

1. `assets/intro.mp4` → açılış videonu koy (MP4 format, kısa tut <5MB önerilir)
2. `assets/logo.png` → logonu koy (tercihen 512x512, şeffaf arka plan)
3. `assets/icons/` → PWA ikonlarını oluştur  
   → [https://realfavicongenerator.net](https://realfavicongenerator.net) sitesinde logondan otomatik oluşturabilirsin

---

## 👤 İlk Kullanım (Admin Kurulumu)

1. Uygulamayı ilk açtığında giriş ekranı gelir
2. **Ad:** `Ceyhun` · **Soyad:** `Karaarslan` yaz  
3. **Özel Kod:** İstediğin kodu belirle (bu ilk girişte admin kodun olarak kaydedilir)
4. Artık admin olarak girişin

> Sonraki açılışlarda aynı bilgilerle giriş yaparsın.

---

## 👥 Kullanıcı Ekleme

1. Giriş yaptıktan sonra sağ üstteki ⚙️ **Ayarlar**'a bas
2. **Kullanıcıları Yönet** seçeneğine bas
3. **+** butonuyla yeni kullanıcı ekle (Ad, Soyad, Kod)
4. Kullanıcıya adını, soyadını ve kodunu söyle

---

## 🌐 Uzaktan Veri Senkronizasyonu (Opsiyonel)

`js/sync.js` dosyasında `SYNC_URL` değişkenini güncelle:

```javascript
const SYNC_URL = 'https://yourdomain.com/data/people.json';
```

JSON formatı:
```json
{
  "people": [
    {
      "id": "unique_id",
      "firstName": "Ad",
      "lastName": "Soyad",
      "description": "Açıklama",
      "photoBase64": "data:image/jpeg;base64,...",
      "order": 1,
      "socials": {
        "instagram": "https://instagram.com/...",
        "twitter": null,
        "linkedin": null,
        "facebook": null,
        "youtube": null
      }
    }
  ]
}
```

---

## 🎨 Temalar

Sağ üstteki ⚙️ Ayarlar'dan 3 tema arasında geçiş yapılabilir:
- **Varsayılan** — Beyaz, Lacivert, Açık Gri
- **Koyu** — Siyah, Koyu Lacivert
- **Açık** — Saf Beyaz, Gri tonlar

---

## 📱 Ana Ekrana Ekleme (PWA Install)

**iOS Safari:**  
Paylaş butonu → "Ana Ekrana Ekle"

**Android Chrome:**  
Otomatik "Uygulamayı Yükle" banner çıkar, yoksa ⋮ menüsü → "Ana ekrana ekle"

---

## 🔐 Güvenlik Notları

- Tüm kullanıcı verileri **AES-256-GCM** ile şifrelenip IndexedDB'ye kaydedilir
- Kodlar **SHA-256** ile hash'lenir, hiçbir zaman plain text saklanmaz
- DevTools'tan localStorage/IndexedDB'ye bakılsa sadece şifreli veri görünür
- Admin paneline sadece Ceyhun Karaarslan hesabından erişilebilir

---

## 🛠️ Geliştirme

Yerel sunucu başlatmak için:
```bash
# Python 3
python -m http.server 8080

# Node.js
npx serve .

# VS Code: Live Server extension
```

Ardından: `http://localhost:8080`
