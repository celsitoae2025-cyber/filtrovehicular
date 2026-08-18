/* ============================================================
   SOCIO AUTH — acceso al panel del socio
   ------------------------------------------------------------
   Mismo guion que el del administrador, pero mirando otra marca:
   `profiles.is_socio`. Un administrador NO entra aquí por ser
   administrador; si además es socio, entra como socio.

   El acceso se pide en esta misma página, igual que en el panel
   del dueño: con el modo mantenimiento encendido, el aviso de la
   app tapa su formulario de entrada.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Socio = window.Consultia.Socio || {};
  var S = window.Consultia.Socio;

  var sesion = null;

  S.getSession = function () { return sesion; };

  S.iniciales = function (nombre) {
    if (!nombre) return '??';
    var partes = String(nombre).trim().split(/\s+/);
    var a = partes[0] ? partes[0][0] : '';
    var b = partes[1] ? partes[1][0] : '';
    return ((a + b) || nombre[0]).toUpperCase();
  };

  S.logout = async function () {
    try {
      if (window.Consultia.Auth) await window.Consultia.Auth.signOut();
    } catch (e) {
      console.error('Error cerrando sesión:', e);
    }
    sesion = null;
    window.location.reload();
  };

  function mostrarError(texto) {
    var err = document.getElementById('socioLoginError');
    if (!err) return;
    if (!texto) { err.hidden = true; err.textContent = ''; return; }
    err.textContent = texto;
    err.hidden = false;
  }

  function mostrarLogin(mensaje) {
    var pantalla = document.getElementById('socioLogin');
    var app = document.getElementById('socioApp');
    if (app) app.hidden = true;
    if (!pantalla) { window.location.href = 'app.html'; return; }
    pantalla.hidden = false;
    // El widget se monta con la pantalla ya visible: Turnstile no
    // resuelve el reto dentro de un elemento oculto.
    if (window.Consultia.Turnstile) window.Consultia.Turnstile.render('tsSocioLogin');
    if (mensaje) mostrarError(mensaje);
    var email = document.getElementById('socioLoginEmail');
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
      return 'No se pudo completar la verificación de seguridad. Recarga la página.';
    }
    return m || 'No se pudo iniciar sesión.';
  }

  S.initAuth = async function (alEntrar) {
    var pantalla = document.getElementById('socioLogin');
    var app = document.getElementById('socioApp');
    if (pantalla) pantalla.hidden = true;

    if (!window.Consultia.Auth) {
      console.error('Consultia.Auth no disponible');
      window.location.href = 'app.html';
      return;
    }

    var form = document.getElementById('socioLoginForm');
    if (form && !form.dataset.wired) {
      form.dataset.wired = '1';
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        mostrarError('');
        var email = (document.getElementById('socioLoginEmail') || {}).value || '';
        var pass  = (document.getElementById('socioLoginPass')  || {}).value || '';
        var btn   = document.getElementById('socioLoginBtn');
        if (!email.trim() || !pass) {
          mostrarError('Escribe tu correo y tu contraseña.');
          return;
        }
        if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }
        try {
          var captchaToken = null;
          if (window.Consultia.Turnstile) {
            captchaToken = await window.Consultia.Turnstile.getToken('tsSocioLogin');
          }
          var res = await window.Consultia.Auth.signIn(email.trim(), pass, true, captchaToken);
          if (window.Consultia.Turnstile) window.Consultia.Turnstile.reset('tsSocioLogin');
          if (res && res.error) throw res.error;
          // Se recarga en vez de montar el panel aquí mismo: así los
          // oyentes se conectan una sola vez, igual que en una visita
          // normal con la sesión ya abierta.
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
      if (!user) { mostrarLogin(''); return; }

      var perfil = await window.Consultia.Auth.getProfile();
      if (!perfil) { mostrarLogin('No se pudo leer tu perfil. Intenta de nuevo.'); return; }

      if (!perfil.is_socio) {
        // Se cierra la sesión recién abierta: esta cuenta no es de socio.
        try { await window.Consultia.Auth.signOut(); } catch (e) {}
        mostrarLogin('Esa cuenta no está habilitada como socio.');
        return;
      }
      if (perfil.status === 'suspended') {
        try { await window.Consultia.Auth.signOut(); } catch (e) {}
        mostrarLogin('Tu cuenta está suspendida. Habla con el administrador.');
        return;
      }

      if (pantalla) pantalla.hidden = true;
      mostrarError('');

      sesion = {
        user_id: user.id,
        email: user.email,
        nombre: perfil.full_name || user.email
      };

      if (app) app.hidden = false;

      var nombreEl = document.getElementById('socioUserName');
      var avatarEl = document.getElementById('socioAvatar');
      if (nombreEl) nombreEl.textContent = sesion.nombre;
      if (avatarEl) avatarEl.textContent = S.iniciales(sesion.nombre);

      var salir = document.getElementById('socioLogout');
      if (salir && !salir.dataset.wired) {
        salir.dataset.wired = '1';
        salir.addEventListener('click', S.logout);
      }

      if (!S._authChangeWired) {
        S._authChangeWired = true;
        window.Consultia.Auth.onAuthChange(function (evento) {
          if (evento === 'SIGNED_OUT') {
            sesion = null;
            mostrarLogin('Tu sesión se cerró. Vuelve a entrar.');
          }
        });
      }

      if (typeof alEntrar === 'function') alEntrar();
    } catch (err) {
      console.error('Error verificando el acceso de socio:', err);
      mostrarLogin('No se pudo verificar tu acceso. Intenta de nuevo.');
    }
  };
})();
