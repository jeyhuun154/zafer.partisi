/* ============================================================
   App Config — Edit popup texts, map icons, notification key
   ============================================================ */
const APP_CONFIG = {

  // ── Social Media Links (shown on Home screen) ─────────────
  // Edit these to point to the correct pages
  socialLinks: {
    instagram:   'https://www.instagram.com/zpgenclikdarica/',
    twitter:     'https://x.com/zaferpartisidarica',
    zaferPartisi:'https://www.zaferpartisi.org.tr'
  },

  // ── Welcome popups (shown after intro on every launch) ───
  popups: [
    {
      image:       'assets/banner1.png',
      title:       "Zafer Partisi'ne Hoş Geldiniz",
      description: 'Güçlü bir Türkiye için birlikte yürüyoruz. Zafer Partisi olarak sizlerin desteğiyle bu ülkeyi daha iyi bir geleceğe taşıyacağız.'
    },
    {
      image:       'assets/istiklal.png',
      title:       'İstiklâl Marşı',
      description: `Korkma, sönmez bu şafaklarda yüzen al sancak
Sönmeden yurdumun üstünde tüten en son ocak.
O benim milletimin yıldızıdır parlayacak!
O benimdir, o benim milletimindir ancak!

Çatma, kurban olayım, çehreni ey nazlı hilal!
Kahraman ırkıma bir gül... ne bu şiddet, bu celâl?
Sana olmaz dökülen kanlarımız sonra helal.
Hakkıdır, Hakk'a tapan milletimin istiklal.

Ben ezelden beridir hür yaşadım, hür yaşarım;
Hangi çılgın bana zincir vuracakmış? Şaşarım!
Kükremiş sel gibiyim, bendimi çiğner, aşarım.
Yırtarım dağları, enginlere sığmam, taşarım.

Garbin âfakını sarmışsa çelik zırhlı duvar.
Benim iman dolu göğsüm gibi serhaddim var.
Ulusun, korkma! Nasıl böyle bir imânı boğar,
'Medeniyyet!' dediğin tek dişi kalmış canavar?

Arkadaş, yurduma alçakları uğratma sakın;
Siper et gövdeni, dursun bu hayâsızca akın.
Doğacaktır sana va'dettiği günler Hakk'ın,
Kim bilir, belki yarın, belki yarından da yakın.

Bastığın yerleri 'toprak' diyerek geçme, tanı!
Düşün altındaki binlerce kefensiz yatanı.
Sen şehid oğlusun, incitme, yazıktır, atanı.
Verme, dünyâları alsan da bu cennet vatanı.

Kim bu cennet vatanın uğruna olmaz ki feda?
Şühedâ fışkıracak toprağı sıksan, şühedâ!
Cânı, cânânı, bütün varımı alsın da Hudâ,
Etmesin tek vatanımdan beni dünyâda cüdâ.

Rûhumun senden İlâhî, şudur ancak emeli:
Değmesin ma' bedimin göğsüne nâ-mahrem eli!
Bu ezanlar-ki şehâdetleri dinin temeli-
Ebedî yurdumun üstünde benim inlemeli.

O zaman vecd ile bin secde eder -varsa- taşım.
Her cerîhamdan, İlâhî, boşanıp kanlı yaşım;
Fışkırır rûh-i mücerred gibi yerden na'şım;
O zaman yükselerek arşa değer belki başım!

Dalgalan sen de şafaklar gibi ey şanlı hilâl!
Olsun artık dökülen kanlarımın hepsi helâl.
Ebediyyen sana yok, ırkıma yok izmihlâl;
Hakkıdır, hür yaşamış, bayrağımın hürriyet,
Hakkıdır, Hakk'a tapan milletimin istiklal!`
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
  vapidKey: 'YOUR_VAPID_PUBLIC_KEY_HERE'
};
