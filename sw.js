const CACHE_NAME = 'bismillah-cache-v3'; // ⚠️ প্রতিবার আপডেটে শুধু এই সংখ্যা বাড়াবেন (v4, v5...)

// নতুন Service Worker ইনস্টল হওয়ার সাথে সাথেই সক্রিয় (skipWaiting)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/bt/', '/bt/index.html']))
  );
});

// নতুন Service Worker সক্রিয় হওয়ার সাথে সাথেই সব ট্যাবের নিয়ন্ত্রণ নেয় (clients.claim)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // পুরোনো ক্যাশ মুছে ফেলে
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First: প্রথমে সার্ভার থেকে নতুন ফাইল খোঁজে, ব্যর্থ হলে ক্যাশ থেকে দেখায়
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone); // নতুন ফাইল ক্যাশে সেভ করে
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request); // নেট না থাকলে ক্যাশ থেকে দেয়
      })
  );
});
