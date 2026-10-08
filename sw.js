const CACHE_NAME = 'bismillah-cache-v2'; // প্রতিবার ওয়েবসাইট আপডেট করার সময় এই সংখ্যাটি বাড়াবেন (v3, v4...)
const urlsToCache = ['/bt/', '/bt/index.html'];

// নতুন Service Worker ইনস্টল হওয়ার সাথে সাথেই সক্রিয় করে দেয়
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// নতুন Service Worker সক্রিয় হওয়ার সাথে সাথেই সমস্ত ট্যাব/অ্যাপের নিয়ন্ত্রণ নেয়
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First স্ট্র্যাটেজি: প্রথমে নেটওয়ার্ক থেকে নতুন ফাইল আনে, ব্যর্থ হলে ক্যাশ থেকে আনে
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // নেটওয়ার্ক থেকে সফলভাবে ফাইল এলে ক্যাশে সংরক্ষণ করে
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // নেটওয়ার্ক ব্যর্থ হলে ক্যাশ থেকে ফাইল ফেরত দেয়
        return caches.match(event.request);
      })
  );
});
