const CACHE_NAME = 'filtrov2-cache-v25';
const PRECACHE = [
    './index.html',
    './admin.html',
    './panel_cliente.html',
    './assets/media/logopwa.png',
    './assets/media/truecallerm_c3121f0d5280629.mp3',
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

// --- WEB PUSH NOTIFICATIONS ---
self.addEventListener('push', (event) => {
    var data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }

    var title = data.title || 'Filtro Vehicular Plus';
    var options = {
        body: data.body || 'Nueva solicitud pendiente',
        icon: './assets/media/logopwa.png',
        badge: './assets/media/logopwa.png',
        vibrate: [300, 100, 300, 100, 300],
        tag: 'nueva-solicitud',
        renotify: true,
        requireInteraction: true,
        data: { url: './admin.html#requests' }
    };

    event.waitUntil(
        self.registration.showNotification(title, options).then(() => {
            // Badge en el icono de la app
            if (navigator.setAppBadge) navigator.setAppBadge(1);
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // Limpiar badge al hacer clic en la notificación
    if (navigator.clearAppBadge) navigator.clearAppBadge();

    var url = (event.notification.data && event.notification.data.url) || './index.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Si ya hay una ventana admin abierta, enfocarla
            for (var i = 0; i < clientList.length; i++) {
                var c = clientList[i];
                if (c.url.indexOf('admin.html') !== -1 && 'focus' in c) {
                    return c.focus();
                }
            }
            // Si no, abrir nueva ventana
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
