/* ============================================================
   ADMIN AUTH — comprueba la sesión de Supabase e `is_admin`

   El formulario propio permanece disponible durante el mantenimiento.
   Solo una sesión y un perfil administrador validados abren el panel.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var cachedSession = null;
  var cachedLoggedIn = false;
  var validationId = 0;

  function esperar(promesa) {
    var timer;
    return Promise.race([promesa, new Promise(function (_, reject) {
      timer = setTimeout(function () { reject(new Error('Tiempo de espera agotado. Inténtalo nuevamente.')); }, 12000);
    })]).finally(function () { clearTimeout(timer); });
  }

  function errorAcceso(mensaje) {
    var el = document.getElementById('adminLoginError');
    if (el) { el.textContent = mensaje || ''; el.hidden = !mensaje; }
  }

  function conectarAcceso(onLoginSuccess) {
    var form = document.getElementById('adminLoginForm');
    if (!form || form.dataset.wired) return;
    form.dataset.wired = '1';
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var btn = document.getElementById('adminLoginSubmit');
      if (btn.disabled) return;
      validationId++;
      errorAcceso('');
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Entrando…';
      try {
        var C = window.Consultia;
        var token = C.Turnstile && await esperar(C.Turnstile.getToken('adminTsAcceso'));
        if (!token) throw new Error('Completa la verificación de seguridad para continuar.');
        var res = await esperar(C.Auth.signIn(
          document.getElementById('adminLoginEmail').value.trim(),
          document.getElementById('adminLoginPassword').value,
          document.getElementById('adminLoginRemember').checked,
          token
        ));
        if (res.error) throw res.error;
        document.getElementById('adminLoginPassword').value = '';
        await A.initAuth(onLoginSuccess);
      } catch (err) {
        var mensaje = String(err && err.message || 'No se pudo iniciar sesión. Inténtalo nuevamente.');
        if (/invalid login|invalid credentials/i.test(mensaje)) mensaje = 'El correo o la contraseña no son correctos.';
        if (/captcha/i.test(mensaje)) mensaje = 'Completa de nuevo la verificación de seguridad.';
        errorAcceso(mensaje);
      } finally {
        if (window.Consultia.Turnstile) window.Consultia.Turnstile.reset('adminTsAcceso');
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.textContent = 'Iniciar sesión';
      }
    });
  }

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
    alAcceso();
  };

  /* El formulario local permanece disponible sin depender de /app. */
  function alAcceso(mensaje) {
    validationId++;
    cachedSession = null;
    cachedLoggedIn = false;
    var app = document.getElementById('adminApp');
    var login = document.getElementById('adminLogin');
    if (app) app.hidden = true;
    if (login) login.hidden = false;
    errorAcceso(mensaje);
    if (window.Consultia.Turnstile) window.Consultia.Turnstile.render('adminTsAcceso');
  }

  A.initAuth = async function (onLoginSuccess) {
    var comprobacion = ++validationId;
    var app = document.getElementById('adminApp');
    conectarAcceso(onLoginSuccess);

    if (!window.Consultia || !window.Consultia.Auth) {
      console.error('Consultia.Auth no disponible');
      alAcceso();
      return;
    }

    try {
      var user = await esperar(window.Consultia.Auth.getUser());
      if (comprobacion !== validationId) return;
      if (!user) { alAcceso(); return; }

      var profile = await esperar(window.Consultia.Auth.getProfile(user));
      if (comprobacion !== validationId) return;
      if (!profile) { alAcceso('No se pudo comprobar tu cuenta. Inicia sesión nuevamente.'); return; }

      if (profile.id !== user.id || profile.is_admin !== true) {
        // No es una cuenta de administrador: se la devuelve a la app sin
        // cerrarle la sesión, que es suya y no molesta a nadie.
        alAcceso('Esta cuenta no tiene permiso de administrador. Ingresa con la cuenta correcta.');
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
      var login = document.getElementById('adminLogin');
      if (login) login.hidden = true;
      errorAcceso('');

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

      if (!A._panelInicializado && typeof onLoginSuccess === 'function') {
        A._panelInicializado = true;
        onLoginSuccess();
      }
    } catch (err) {
      console.error('Admin auth error:', err);
      if (comprobacion === validationId) alAcceso('No se pudo comprobar la sesión. Puedes iniciar sesión nuevamente.');
    }
  };
})();
