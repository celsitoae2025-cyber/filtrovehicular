const CACHE_NAME = 'filtrov2-cache-v1';
const PRECACHE = ['./index.html', './assets/js/supabase-config.js', './assets/js/session.js', './assets/js/auth.js'];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE).catch(() => {});
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request, { ignoreSearch: true }).then((response) => {
            return response || fetch(e.request);
        })
    );
});
