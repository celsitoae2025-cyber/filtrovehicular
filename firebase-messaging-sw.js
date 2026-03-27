// Firebase Cloud Messaging Service Worker - Admin Panel
// Maneja notificaciones push cuando la app está en segundo plano o cerrada

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBReBBPABzIAEneLzjjlGYKddRF7WyQxfw",
    authDomain: "filtro2026-d9530.firebaseapp.com",
    projectId: "filtro2026-d9530",
    storageBucket: "filtro2026-d9530.firebasestorage.app",
    messagingSenderId: "472315272675",
    appId: "1:472315272675:web:3389b0bb4c03a4b4ae94d6"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Patrón de vibración ~3 segundos
const VIBRATE_PATTERN = [400, 150, 400, 150, 400, 150, 400, 150, 400, 150, 400];

messaging.onBackgroundMessage((payload) => {
    console.log('[FCM-SW] Notificación en background:', payload);

    const title = payload.notification?.title || '🔔 Nueva Solicitud - Admin';
    const body  = payload.notification?.body  || 'Hay una solicitud pendiente en el panel.';

    const options = {
        body,
        icon:  './assets/media/logopwa.png',
        badge: './logopestañaweb.png',
        tag:   payload.data?.tag || 'admin-alert',
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: VIBRATE_PATTERN,
        data: {
            url: payload.data?.url || './admin.html#requests',
            ...payload.data
        },
        actions: [
            { action: 'open',  title: '👁 Ver panel' },
            { action: 'close', title: 'Cerrar'       }
        ]
    };

    // Notificar a la página para que reproduzca el sonido
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        list.forEach(client => client.postMessage({ type: 'PLAY_ALERT_SOUND' }));
    });

    return self.registration.showNotification(title, options);
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
