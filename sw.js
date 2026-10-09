/* BT Service Worker — স্থায়ী ও নিরাপদ সংস্করণ
   নিয়ম: ক্যাশ ভার্সন আর হাতে বাড়াতে হবে না। HTML সবসময় আগে সার্ভার থেকে আনে। */
const CACHE_NAME = 'bt-cache-v6';
const SCOPE_PATH = '/bt/';
const PRECACHE = ['/bt/', '/bt/index.html', '/bt/manifest.json', '/bt/icon-192.png', '/bt/icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // একটা ফাইল না থাকলেও ইনস্টল যেন ব্যর্থ না হয়
      Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// শুধু ভালো (200 OK) ও নিজের সাইটের ফাইলই ক্যাশে রাখা হবে
function saveToCache(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
  }
}

// সার্ভার থেকে আনা — ব্রাউজারের HTTP ক্যাশ এড়িয়ে (GitHub Pages ১০ মিনিট পুরনো ফাইল দেয়), সময়সীমা সহ
function fetchFresh(request, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(request, { cache: 'no-cache', signal: ctrl.signal }).finally(() => clearTimeout(t));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ১) Google Apps Script / অন্য সাইট / POST — Service Worker কখনো হাত দেবে না
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;

  // ২) পেজ (HTML): আগে সার্ভার, ব্যর্থ হলে ক্যাশ
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetchFresh(req, 6000)
        .then((res) => { saveToCache(req, res); return res; })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('/bt/index.html') || caches.match('/bt/') ||
            new Response('অফলাইন — ইন্টারনেট চালু করে আবার চেষ্টা করুন', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
        )
    );
    return;
  }

  // ৩) আইকন/ম্যানিফেস্ট ইত্যাদি: ক্যাশ থেকে দ্রুত দেখায়, পেছনে নতুন করে আনে
  event.respondWith(
    caches.match(req).then((cached) => {
      const net = fetchFresh(req, 8000).then((res) => { saveToCache(req, res); return res; }).catch(() => cached);
      return cached || net;
    }).then((r) => r || new Response('', { status: 504 }))
  );
});
