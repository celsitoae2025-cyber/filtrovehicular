/* ============================================================
   ADMIN AUTH — verifica sesión de Supabase e `is_admin=true`
   Ya no usa login local: la usuaria se loguea en la landing,
   y si tiene permiso de admin, puede entrar acá sin pedir
   credenciales de nuevo.
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
    window.location.href = 'app.html';
  };

  function redirectToLanding(reason) {
    window.location.href = 'app.html';
  }

  A.initAuth = async function (onLoginSuccess) {
    var loginScreen = document.getElementById('adminLogin');
    var app = document.getElementById('adminApp');

    // El login local ya no se usa — siempre oculto
    if (loginScreen) loginScreen.hidden = true;

    if (!window.Consultia || !window.Consultia.Auth) {
      console.error('Consultia.Auth no disponible');
      redirectToLanding('auth no cargado');
      return;
    }

    try {
      var user = await window.Consultia.Auth.getUser();
      if (!user) {
        redirectToLanding('sin sesión');
        return;
      }

      var profile = await window.Consultia.Auth.getProfile();
      if (!profile) {
        redirectToLanding('perfil no encontrado');
        return;
      }

      if (!profile.is_admin) {
        alert('No tienes permisos de administrador.');
        redirectToLanding('no admin');
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

      var logoutBtn = document.getElementById('adminLogout');
      if (logoutBtn) logoutBtn.addEventListener('click', A.logout);

      // Si cierra sesión en otra pestaña, redirigir
      window.Consultia.Auth.onAuthChange(function (event) {
        if (event === 'SIGNED_OUT') {
          cachedSession = null;
          cachedLoggedIn = false;
          redirectToLanding('signed out');
        }
      });

      if (typeof onLoginSuccess === 'function') onLoginSuccess();
    } catch (err) {
      console.error('Admin auth error:', err);
      redirectToLanding('error inesperado');
    }
  };
})();
