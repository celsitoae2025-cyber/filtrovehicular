const CACHE_NAME = 'filtrov2-cache-v4';
const PRECACHE = [
    './index.html',
    './admin.html',
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
    console.log('[SW] Installing...');
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
    console.log('[SW] Activating...');
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

// MANTENER SERVICE WORKER ACTIVO - Evita que la app se cierre
self.addEventListener('message', (event) => {
    if (event.data === 'keepAlive') {
        console.log('[SW] Keep alive ping received');
        event.waitUntil(Promise.resolve());
    }
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

