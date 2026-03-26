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

// SOPORTE PARA NOTIFICACIONES PUSH (preparado para Firebase)
self.addEventListener('push', function(event) {
    console.log('[SW] Push notification received');
    
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'Nueva notificación', body: event.data.text() };
        }
    }
    
    const title = data.title || 'Filtro Vehicular Admin';
    const options = {
        body: data.body || 'Tienes una nueva notificación',
        icon: './assets/media/logopwa.png',
        badge: './assets/media/logopwa.png',
        tag: data.tag || 'notification',
        data: {
            url: data.url || './admin.html',
            timestamp: Date.now()
        },
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'close', title: 'Cerrar' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// MANEJAR CLICKS EN NOTIFICACIONES
self.addEventListener('notificationclick', function(event) {
    console.log('[SW] Notification clicked:', event.action);
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    const urlToOpen = event.notification.data.url || './admin.html';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Si ya hay una ventana abierta, enfocarla
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes('admin.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si no hay ventana abierta, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// SINCRONIZACIÓN EN BACKGROUND (opcional, para futuras mejoras)
self.addEventListener('sync', function(event) {
    console.log('[SW] Background sync:', event.tag);
    if (event.tag === 'sync-notifications') {
        event.waitUntil(Promise.resolve());
    }
});
