/* ============================================================
   App Config — Edit popup texts, map icons, notification key
   ============================================================ */
const APP_CONFIG = {

  // ── Welcome popups (shown after intro on every launch) ───
  popups: [
    {
      image:       'assets/banner1.png',   // koyacağın banner resmi
      title:       'Zafer Partisi\'ne Hoş Geldiniz',
      description: 'Güçlü bir Türkiye için birlikte yürüyoruz. Zafer Partisi olarak sizlerin desteğiyle bu ülkeyi daha iyi bir geleceğe taşıyacağız.'
    },
    {
      image:       'assets/ataturk.png',   // Atatürk fotoğrafı buraya
      title:       'İstiklâl Marşı',
      description: 'Korkma, sönmez bu şafaklarda yüzen al sancak;\nSönmeden yurdumun üstünde tüten en son ocak.\nO benim milletimin yıldızıdır, parlayacak;\nO benimdir, o benim milletimindir ancak.'
    }
  ],

  // ── Map pin icon options ──────────────────────────────────
  mapIcons: [
    { id: 'hq',       emoji: '🏛️', label: 'Parti Binası'      },
    { id: 'event',    emoji: '📅', label: 'Etkinlik Yeri'     },
    { id: 'office',   emoji: '🏢', label: 'Ofis / Merkez'     },
    { id: 'meeting',  emoji: '👥', label: 'Toplantı Noktası'  },
    { id: 'announce', emoji: '📢', label: 'Duyuru Noktası'    },
    { id: 'star',     emoji: '⭐', label: 'Özel Nokta'        }
  ],

  // ── FCM Web Push VAPID key ────────────────────────────────
  // Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Key pair
  vapidKey: 'BEbEsZI8r9pmq9215CvX-LiGRqxtSCUutRNDb_oaNNjLHJWhmTyOz2WbXMWXjV0_W_1xjpsFGoBHVpoH9EWZiNE'
};
