const CACHE_NAME = 'filtrov2-cache-v7';
const PRECACHE = [
    './index.html',
    './admin.html',
    './panel_cliente.html',
    './assets/media/logopwa.png',
    './assets/media/logo_circular.png',
    './assets/js/supabase-config.js',
    './assets/js/session.js',
    './assets/js/auth.js',
    './assets/js/app-alert.js',
    './assets/css/components.css',
    './assets/css/index.css',
    './assets/css/admin.css',
    './assets/css/panel_cliente.css',
    './assets/js/index.js',
    './assets/js/admin.js',
    './assets/js/panel_cliente.js'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                PRECACHE.map((url) => cache.add(url).catch(() => {}))
            );
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
        fetch(e.request, { signal: AbortSignal.timeout(8000) }).catch(() => {
            return caches.match(e.request, { ignoreSearch: true });
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data === 'keepAlive') {
        event.waitUntil(Promise.resolve());
    }
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
