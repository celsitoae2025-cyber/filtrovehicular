/* ============================================================
   ADMIN AUTH — comprueba la sesión de Supabase e `is_admin`

   El panel NO tiene pantalla de acceso propia. Quien llegue sin sesión,
   sin perfil o sin permiso de administrador va al acceso de app.html.
   La ruta directa permite iniciar sesión durante el mantenimiento;
   solo el rol de administrador validado puede abrir la plataforma.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var cachedSession = null;
  var cachedLoggedIn = false;

  A.isLoggedIn = function () { return cachedLoggedIn; };
  A.getSession = function () { return cachedSession; };

  A.userInitials = function (name) {
    if (!name) return '??';
    var parts = String(name).trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : '';
    var b = parts[1] ? parts[1][0] : '';
    return ((a + b) || name[0]).toUpperCase();
  };

  A.logout = async function () {
    try {
      if (window.Consultia && window.Consultia.Auth) {
        await window.Consultia.Auth.signOut();
      }
    } catch (e) {
      console.error('Error signing out:', e);
    }
    cachedSession = null;
    cachedLoggedIn = false;
    window.location.replace('app.html');
  };

  /* Fuera del panel. El motivo no se le dice a nadie: quien no tiene
     permiso no tiene por qué saber si falló la sesión o el rol. */
  function alAcceso() {
    window.location.replace('app.html?acceso=administrador');
  }

  A.initAuth = async function (onLoginSuccess) {
    var app = document.getElementById('adminApp');

    if (!window.Consultia || !window.Consultia.Auth) {
      console.error('Consultia.Auth no disponible');
      alAcceso();
      return;
    }

    try {
      var user = await window.Consultia.Auth.getUser();
      if (!user) { alAcceso(); return; }

      var profile = await window.Consultia.Auth.getProfile();
      if (!profile) { alAcceso(); return; }

      if (!profile.is_admin) {
        // No es una cuenta de administrador: se la devuelve a la app sin
        // cerrarle la sesión, que es suya y no molesta a nadie.
        alAcceso();
        return;
      }

      cachedSession = {
        email: user.email,
        name: profile.full_name || user.email,
        user_id: user.id,
        logged_at: new Date().toISOString()
      };
      cachedLoggedIn = true;

      if (app) app.hidden = false;

      var nameEl = document.getElementById('adminUserName');
      var avatarEl = document.getElementById('adminAvatar');
      if (nameEl) nameEl.textContent = cachedSession.name;
      if (avatarEl) avatarEl.textContent = A.userInitials(cachedSession.name);

      // Los oyentes se conectan una sola vez, por si initAuth llegara a
      // ejecutarse de nuevo sobre la misma página.
      var logoutBtn = document.getElementById('adminLogout');
      if (logoutBtn && !logoutBtn.dataset.wired) {
        logoutBtn.dataset.wired = '1';
        logoutBtn.addEventListener('click', A.logout);
      }

      if (!A._authChangeWired) {
        A._authChangeWired = true;
        // Si cierra sesión en otra pestaña, aquí no se queda nada abierto.
        window.Consultia.Auth.onAuthChange(function (event) {
          if (event === 'SIGNED_OUT') {
            cachedSession = null;
            cachedLoggedIn = false;
            alAcceso();
          }
        });
      }

      if (typeof onLoginSuccess === 'function') onLoginSuccess();
    } catch (err) {
      console.error('Admin auth error:', err);
      alAcceso();
    }
  };
})();
