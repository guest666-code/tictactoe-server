const CACHE_NAME = 'xox-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// Dosyaları önbelleğe al (Hızlı açılması için)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});

// Bildirim tetiklendiğinde ekranda gösterilecek yapı
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATIONS') {
    const notifications = [
      "⚔️ Meydan okuma zamanı! Odalar seni bekliyor.",
      "🧠 Yapay zeka seni özledi, bir el XOX atalım mı?",
      "🔥 Lig kızışıyor! Arkadaşlarına şifreyi gönder.",
      "🚀 Giriş ödülün hazır! Hemen oyuna gel.",
      "⚡ Reflekslerini taze tut, Siber XOX seni çağırıyor!",
      "🏆 Günün son şansı! Skorunu katlamak için tıkla."
    ];

    // 4 saat arayla (4 * 60 * 60 * 1000 milisaniye) 6 bildirimi zamanla
    const FOUR_HOURS = 4 * 60 * 60 * 1000;

    notifications.forEach((message, index) => {
      setTimeout(() => {
        self.registration.showNotification('Siber Tic Tac Toe', {
          body: message,
          icon: 'https://cdn-icons-png.flaticon.com/512/1023/1023656.png',
          vibrate: [200, 100, 200],
          badge: 'https://cdn-icons-png.flaticon.com/512/1023/1023656.png'
        });
      }, (index + 1) * FOUR_HOURS);
    });
  }
});

