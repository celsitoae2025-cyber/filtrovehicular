/**
 * Puerta de acceso al panel admin — sesión en sessionStorage + bloqueo por intentos.
 */
(function () {
    'use strict';

    var SESSION_KEY = 'filtro_admin_auth_v1';
    var LOCK_KEY = 'filtro_admin_lockout_until';
    var FAIL_KEY = 'filtro_admin_fail_count';

    function cfg() {
        return window.FILTRO_ADMIN_CONFIG || {};
    }

    function isLocked() {
        var t = parseInt(localStorage.getItem(LOCK_KEY) || '0', 10);
        if (t > Date.now()) return true;
        if (t) localStorage.removeItem(LOCK_KEY);
        return false;
    }

    function setLock(ms) {
        localStorage.setItem(LOCK_KEY, String(Date.now() + ms));
    }

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
        if (ov) {
            ov.style.display = 'none';
            ov.setAttribute('aria-hidden', 'true');
        }
        if (root) {
            root.style.display = 'flex';
            root.removeAttribute('hidden');
        }
    }

    function applyLockedUI() {
        document.documentElement.classList.remove('admin-session-ok');
        var ov = document.getElementById('loginOverlay');
        var root = document.getElementById('adminAppRoot');
        if (ov) {
            ov.style.display = 'flex';
            ov.setAttribute('aria-hidden', 'false');
        }
        if (root) {
            root.style.display = 'none';
            root.setAttribute('hidden', 'hidden');
        }
    }

    function startNewSession() {
        var hours = Number(cfg().sessionHours) || 8;
        var exp = Date.now() + hours * 3600000;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ exp: exp }));
        sessionStorage.removeItem(FAIL_KEY);
        applyUnlockedUI();
    }

    function showError(msg) {
        var el = document.getElementById('adminLoginError');
        if (el) {
            el.textContent = msg;
            el.style.display = 'block';
        }
    }

    function clearError() {
        var el = document.getElementById('adminLoginError');
        if (el) {
            el.textContent = '';
            el.style.display = 'none';
        }
    }

    function tryLogin() {
        clearError();
        if (isLocked()) {
            showError('Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.');
            return;
        }
        var passEl = document.getElementById('adminPassInput');
        var input = passEl ? String(passEl.value || '').trim().toLowerCase() : '';
        var allowedEmail = 'juandevillar80@gmail.com';

        if (!input) {
            showError('Ingresa tu correo autorizado.');
            return;
        }

        if (input !== allowedEmail) {
            var n = parseInt(sessionStorage.getItem(FAIL_KEY) || '0', 10) + 1;
            sessionStorage.setItem(FAIL_KEY, String(n));
            var maxA = Number(cfg().maxAttempts) || 5;
            if (n >= maxA) {
                var mins = Number(cfg().lockoutMinutes) || 15;
                setLock(mins * 60000);
                sessionStorage.removeItem(FAIL_KEY);
                showError('Acceso bloqueado temporalmente por seguridad.');
                return;
            }
            showError('Correo no autorizado.');
            if (passEl) passEl.value = '';
            return;
        }
        startNewSession();
    }

    window.adminLogout = function () {
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch (e) {}
        window.location.href = 'index.html';
    };

    window.tryAdminLogin = tryLogin;

    function init() {
        if (sessionValid()) {
            applyUnlockedUI();
            return;
        }

        // Auto-login: si el usuario ya está logueado con el correo autorizado
        var allowedEmail = 'juandevillar80@gmail.com';
        if (typeof window.FiltroSession !== 'undefined') {
            var email = window.FiltroSession.getEmail();
            if (email === allowedEmail) {
                startNewSession();
                return;
            }
        }

        // Si no es el correo autorizado, redirigir al sitio
        applyLockedUI();
        var btn = document.getElementById('btnAdminLogin');
        if (btn) btn.addEventListener('click', tryLogin);
        var inp = document.getElementById('adminPassInput');
        if (inp) {
            inp.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') tryLogin();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
