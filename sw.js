const CACHE_NAME = 'filtrov2-cache-v3';
const PRECACHE = [
    './index.html',
    './logopestañaweb.png',
    './assets/js/supabase-config.js',
    './assets/js/session.js',
    './assets/js/auth.js',
    './assets/css/components.css',
    './assets/media/logo_circular.png',
    './assets/media/logo_circularAZUL.png',
    './assets/media/logonegro.png',
    './assets/media/logopwa.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE).catch((err) => {
                console.warn('SW: algunos recursos no se pudieron cachear:', err);
            });
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(
                names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request, { ignoreSearch: true });
        })
    );
});
