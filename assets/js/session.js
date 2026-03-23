(function () {
    'use strict';
    var KEY = 'filtro_user_session';

    window.FiltroSession = {
        key: KEY,
        getUser: function () {
            try {
                var raw = localStorage.getItem(KEY);
                if (!raw) return null;
                return JSON.parse(raw);
            } catch (e) {
                console.warn('FiltroSession: sesión inválida, limpiando');
                localStorage.removeItem(KEY);
                return null;
            }
        },
        getEmail: function () {
            var u = this.getUser();
            return u && u.email ? String(u.email).trim().toLowerCase() : null;
        },
        clear: function () {
            localStorage.removeItem(KEY);
        }
    };
})();
