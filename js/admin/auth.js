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
    // Se queda en el acceso del panel. Mandar a app.html seria un problema
    // con el mantenimiento encendido: alli el aviso tapa el login.
    window.location.reload();
  };

  function redirectToLanding(reason) {
    window.location.href = 'app.html';
  }

  // Pide las credenciales aquí en vez de mandar a app.html. Con el modo
  // mantenimiento encendido, alli el aviso tapa el login y el
  // administrador se quedaba sin forma de entrar ni de apagarlo.
  function mostrarLogin(mensaje) {
    var pantalla = document.getElementById('adminLogin');
    var app = document.getElementById('adminApp');
    if (app) app.hidden = true;
    if (!pantalla) { redirectToLanding('sin pantalla de acceso'); return; }
    pantalla.hidden = false;
    // El widget se monta recién ahora, con la pantalla ya visible:
    // Turnstile no resuelve el reto dentro de un elemento oculto.
    if (window.Consultia && window.Consultia.Turnstile) {
      window.Consultia.Turnstile.render('tsAdminLogin');
    }
    if (mensaje) mostrarError(mensaje);
    var email = document.getElementById('adminLoginEmail');
    if (email) email.focus();
  }

  // Supabase responde en inglés; aquí se lee en español.
  function enEspanol(mensaje) {
    var m = String(mensaje || '');
    if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/email not confirmed/i.test(m))       return 'Tu correo aún no está confirmado.';
    if (/too many requests|rate limit/i.test(m)) {
      return 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.';
    }
    if (/network|failed to fetch/i.test(m))   return 'Sin conexión con el servidor. Revisa tu internet.';
    if (/captcha/i.test(m)) {
      return 'No se pudo completar la verificación de seguridad. Recarga la página; si usas un bloqueador de anuncios, desactívalo para este sitio.';
    }
    return m || 'No se pudo iniciar sesión.';
  }

  function mostrarError(texto) {
    var err = document.getElementById('adminLoginError');
    if (!err) return;
    if (!texto) { err.hidden = true; err.textContent = ''; return; }
    err.textContent = texto;
    err.hidden = false;
  }

  A.initAuth = async function (onLoginSuccess) {
    var loginScreen = document.getElementById('adminLogin');
    var app = document.getElementById('adminApp');

    if (loginScreen) loginScreen.hidden = true;

    if (!window.Consultia || !window.Consultia.Auth) {
      console.error('Consultia.Auth no disponible');
      redirectToLanding('auth no cargado');
      return;
    }

    // Envío del formulario de acceso. Solo se conecta una vez.
    var form = document.getElementById('adminLoginForm');
    if (form && !form.dataset.wired) {
      form.dataset.wired = '1';
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        mostrarError('');
        var email = (document.getElementById('adminLoginEmail') || {}).value || '';
        var pass  = (document.getElementById('adminLoginPass')  || {}).value || '';
        var btn   = document.getElementById('adminLoginBtn');
        if (!email.trim() || !pass) {
          mostrarError('Escribe tu correo y tu contraseña.');
          return;
        }
        if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }
        try {
          var captchaToken = null;
          if (window.Consultia.Turnstile) {
            captchaToken = await window.Consultia.Turnstile.getToken('tsAdminLogin');
          }
          var res = await window.Consultia.Auth.signIn(email.trim(), pass, true, captchaToken);
          // El token es de un solo uso: se quema aunque el acceso falle.
          if (window.Consultia.Turnstile) window.Consultia.Turnstile.reset('tsAdminLogin');
          if (res && res.error) throw res.error;
          // Se recarga en vez de re-inicializar aquí mismo. onLoginSuccess
          // monta quince módulos con sus oyentes y sus suscripciones;
          // volver a ejecutarlo sobre la misma página los dejaría por
          // duplicado y cada clic acabaría disparando dos veces. Con la
          // recarga el panel se monta una sola vez, exactamente igual que
          // en una visita normal con la sesión ya abierta.
          window.location.reload();
          return;
        } catch (err) {
          mostrarError(enEspanol(err && err.message));
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        }
      });
    }

    try {
      var user = await window.Consultia.Auth.getUser();
      if (!user) {
        mostrarLogin('');
        return;
      }

      var profile = await window.Consultia.Auth.getProfile();
      if (!profile) {
        mostrarLogin('No se pudo leer tu perfil. Intenta de nuevo.');
        return;
      }

      if (!profile.is_admin) {
        // Se cierra la sesión recién abierta: no es una cuenta de admin.
        try { await window.Consultia.Auth.signOut(); } catch (e) {}
        mostrarLogin('Esa cuenta no tiene permisos de administrador.');
        return;
      }

      if (loginScreen) loginScreen.hidden = true;
      mostrarError('');

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
        // Si cierra sesión en otra pestaña, se vuelve al acceso de aquí y
        // no a la app: con el mantenimiento encendido, alli no podria entrar.
        window.Consultia.Auth.onAuthChange(function (event) {
          if (event === 'SIGNED_OUT') {
            cachedSession = null;
            cachedLoggedIn = false;
            mostrarLogin('Tu sesión se cerró. Vuelve a entrar.');
          }
        });
      }

      if (typeof onLoginSuccess === 'function') onLoginSuccess();
    } catch (err) {
      console.error('Admin auth error:', err);
      mostrarLogin('Ocurrió un error al validar tu acceso. Intenta de nuevo.');
    }
  };
})();
