/* BT Service Worker — সম্পূর্ণ ও চূড়ান্ত সংস্করণ
   নিয়ম: HTML সবসময় আগে সার্ভার থেকে আনে, না পেলে ক্যাশ থেকে দেখায়। Pull-to-Refresh সাপোর্টেড। */
const CACHE_NAME = 'bt-cache-v10'; // v8/v9 থেকে v10 করা হলো, যাতে পুরোনো ক্যাশ মুছে যায়
const SCOPE_PATH = '/bt/';
const PRECACHE = ['/bt/', '/bt/index.html', '/bt/manifest.json', '/bt/LOGO-icon-192.png', '/bt/LOGO-icon-512.png'];

// ১. ইনস্টল ইভেন্ট: নতুন ক্যাশ তৈরি করে ফাইল ডাউনলোড করে রাখে
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // একটা ফাইল না থাকলেও ইনস্টল যেন ব্যর্থ না হয়
      Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})))
    )
  );
});

// ২. অ্যাক্টিভেট ইভেন্ট: পুরোনো ক্যাশ মুছে ফেলে এবং সব ট্যাবের নিয়ন্ত্রণ নেয়
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// ৩. ক্যাশে ফাইল সেভ করার হেল্পার ফাংশন
function saveToCache(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
  }
}

// ৪. সার্ভার থেকে ফ্রেশ ফাইল আনার হেল্পার ফাংশন (ব্রাউজারের HTTP ক্যাশ এড়িয়ে)
function fetchFresh(request, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(request, { cache: 'no-cache', signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// ৫. ফ্রন্টএন্ড (index.html) থেকে মেসেজ রিসিভ করা (Pull-to-Refresh এর জন্য)
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'CHECK_FOR_UPDATE' || event.data.type === 'FORCE_REFRESH')) {
    // ক্যাশ bypass করে নতুন ফাইল আনতে বলবে
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.keys().then((keys) => {
          return Promise.all(
            keys.map((request) => {
              return fetch(request, { cache: 'no-cache' })
                .then((response) => {
                  if (response && response.ok) {
                    return cache.put(request, response);
                  }
                })
                .catch(() => {});
            })
          );
        });
      })
    );
  }
});

// ৬. ফেচ ইভেন্ট: রিকোয়েস্ট অনুযায়ী কৌশল নির্ধারণ করে
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Google Apps Script / অন্য সাইট / POST — Service Worker কখনো হাত দেবে না
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;

  // ক) পেজ (HTML): Network-First (আগে সার্ভার থেকে নতুন ফাইল আনে, না পেলে ক্যাশ)
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      try {
        // সার্ভার থেকে নতুন ফাইল আনতে চেষ্টা করবে (সর্বোচ্চ ৫ সেকেন্ড অপেক্ষা করবে)
        const res = await fetchFresh(req, 5000);
        if (res && res.ok && !res.redirected) {
          saveToCache(req, res.clone()); // নতুন ফাইল ক্যাশে সেভ করবে
          return res; // সাথে সাথে নতুন ফাইল দেখাবে
        }
      } catch (error) {
        // নেট না থাকলে বা স্লো হলে নিচের ক্যাশে চলে যাবে
      }

      // সার্ভার থেকে না পেলে ক্যাশ থেকে দেখাবে (অফলাইন সাপোর্ট)
      const cached = (await caches.match(req, { ignoreSearch: true })) ||
                     (await caches.match('/bt/index.html')) ||
                     (await caches.match('/bt/'));
      return cached || new Response('অফলাইন — ইন্টারনেট চালু করে আবার চেষ্টা করুন',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  // খ) আইকন/ম্যানিফেস্ট ইত্যাদি: Stale-While-Revalidate (ক্যাশ থেকে দ্রুত দেখায়, পেছনে নতুন করে আনে)
  event.respondWith(
    caches.match(req).then((cached) => {
      const net = fetchFresh(req, 8000).then((res) => { saveToCache(req, res); return res; }).catch(() => cached);
      return cached || net;
    }).then((r) => r || new Response('', { status: 504 }))
  );
});
