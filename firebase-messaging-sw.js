// Service Worker - Web Push nativo (VAPID)
// Maneja notificaciones push en background sin Firebase

const VIBRATE_PATTERN = [400, 150, 400, 150, 400, 150, 400, 150, 400, 150, 400];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Manejar push nativo
self.addEventListener('push', (event) => {
    console.log('[SW] Push recibido');

    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch(e) {
        data = { title: '🔔 Nueva Solicitud', body: event.data ? event.data.text() : 'Revisa el panel de administración.' };
    }

    const title   = data.title   || '🔔 Nueva Solicitud - Admin';
    const body    = data.body    || 'Hay una solicitud pendiente en el panel.';
    const iconUrl = data.icon    || './assets/media/logopwa.png';
    const pageUrl = (data.data && data.data.url) || './admin.html#requests';

    const options = {
        body,
        icon:  iconUrl,
        badge: './logopestañaweb.png',
        tag:   'admin-push',
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: VIBRATE_PATTERN,
        data: { url: pageUrl },
        actions: [
            { action: 'open',  title: '👁 Ver panel' },
            { action: 'close', title: 'Cerrar'       }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(title, options).then(() => {
            // Avisar a la página abierta para reproducir sonido
            return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
                list.forEach(client => client.postMessage({ type: 'PLAY_ALERT_SOUND' }));
            });
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'close') return;

    const urlToOpen = event.notification.data?.url || './admin.html#requests';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            for (const client of list) {
                if (client.url.includes('admin.html') && 'focus' in client) {
                    client.postMessage({ type: 'NOTIFICATION_CLICK', url: urlToOpen });
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});
