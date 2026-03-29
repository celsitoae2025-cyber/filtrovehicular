/**
 * Puerta de acceso al panel admin — solo correo autorizado.
 */
(function () {
    'use strict';

    var SESSION_KEY = 'filtro_admin_auth_v1';
    var ALLOWED_EMAIL = 'juandevillar80@gmail.com';

    function sessionValid() {
        try {
            var raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return false;
            var o = JSON.parse(raw);
            return o && typeof o.exp === 'number' && o.exp > Date.now();
        } catch (e) {
            return false;
        }
    }

    function applyUnlockedUI() {
        document.documentElement.classList.add('admin-session-ok');
        var ov = document.getElementById('loginOverlay');
        var root = document.getElementById('adminAppRoot');
        if (ov) { ov.style.display = 'none'; ov.setAttribute('aria-hidden', 'true'); }
        if (root) { root.style.display = 'flex'; root.removeAttribute('hidden'); }
    }

    function startNewSession() {
        var exp = Date.now() + 8 * 3600000; // 8 horas
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ exp: exp }));
        applyUnlockedUI();
    }

    function getLoggedEmail() {
        // Leer de FiltroSession (localStorage)
        if (typeof window.FiltroSession !== 'undefined') {
            var email = window.FiltroSession.getEmail();
            if (email) return email;
        }
        // Fallback: leer directo de localStorage
        try {
            var raw = localStorage.getItem('filtro_user_session');
            if (raw) {
                var u = JSON.parse(raw);
                if (u && u.email) return String(u.email).trim().toLowerCase();
            }
        } catch (e) {}
        return null;
    }

    function init() {
        // 1. Sesión admin ya activa
        if (sessionValid()) {
            applyUnlockedUI();
            return;
        }

        // 2. Verificar si el usuario logueado es el autorizado
        var email = getLoggedEmail();
        if (email === ALLOWED_EMAIL) {
            startNewSession();
            return;
        }

        // 3. No autorizado — redirigir al sitio
        alert('Acceso restringido. Solo el administrador puede ingresar.');
        window.location.href = 'index.html';
    }

    window.adminLogout = function () {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
        window.location.href = 'index.html';
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
