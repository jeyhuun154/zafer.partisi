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
      image:       'istiklal.png',   // Atatürk fotoğrafı buraya
      title:       'İstiklâl Marşı',
      description: ''
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

// ── Darıca sınır koordinatları (varsayılan, admin haritadan değiştirebilir) ──
daricaBoundary: [
   [40.7760, 29.5195],
   [40.7820, 29.5420],
   [40.7790, 29.5680],
   [40.7700, 29.5920],
   [40.7550, 29.6200],
   [40.7350, 29.6280],
   [40.7180, 29.6150],
   [40.7090, 29.5900],
   [40.7050, 29.5580],
   [40.7100, 29.5300],
   [40.7250, 29.5150],
   [40.7480, 29.5120],
   [40.7650, 29.5170],
   [40.7760, 29.5195]
   ]
