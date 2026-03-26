// Firebase Cloud Messaging Service Worker
// Este archivo maneja las notificaciones push cuando la app está cerrada

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyBReBBPABzIAEneLzjjlGYKddRF7WyQxfw",
    authDomain: "filtro2026-d9530.firebaseapp.com",
    projectId: "filtro2026-d9530",
    storageBucket: "filtro2026-d9530.firebasestorage.app",
    messagingSenderId: "472315272675",
    appId: "1:472315272675:web:3389b0bb4c03a4b4ae94d6"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Obtener instancia de Firebase Messaging
const messaging = firebase.messaging();

// Manejar notificaciones en segundo plano (cuando la app está cerrada)
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Notificación recibida en segundo plano:', payload);
    
    const notificationTitle = payload.notification?.title || 'Filtro Vehicular Admin';
    const notificationOptions = {
        body: payload.notification?.body || 'Nueva notificación',
        icon: './assets/media/logopwa.png',
        badge: './assets/media/logopwa.png',
        tag: payload.data?.tag || 'notification',
        data: {
            url: payload.data?.url || './admin.html',
            timestamp: Date.now(),
            ...payload.data
        },
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: [
            { action: 'open', title: 'Ver' },
            { action: 'close', title: 'Cerrar' }
        ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clicks en las notificaciones
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notificación clickeada:', event.action);
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    const urlToOpen = event.notification.data?.url || './admin.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Buscar si ya hay una ventana del panel admin abierta
            for (const client of clientList) {
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
