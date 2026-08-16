/* ============================================================
   AUTH — API sobre Supabase Auth
   Expone: Consultia.Auth.signUp/signIn/signOut/resetPassword/
   onAuthChange/getUser/getProfile
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  if (!Consultia.supabase) {
    console.error('[Consultia.Auth] Falta Consultia.supabase — cargá supabase-config.js antes');
    return;
  }

  var sb = Consultia.supabase;

  function redirectUrl() {
    // URL de retorno para verificación / reset password
    return window.location.origin + window.location.pathname;
  }

  // ===== "Recordarme" =====
  // Marcado:    los tokens van a localStorage y la sesión sobrevive a
  //             cerrar el navegador.
  // Sin marcar: van a sessionStorage y mueren al cerrarlo.
  // El reparto lo hace supabase-config.js leyendo REMEMBER_KEY.
  //
  // Ya no se fuerza un vencimiento a 30 días: la casilla dice "Recordarme"
  // y eso es lo que hace. Quien cierra la sesión por tiempo es el módulo de
  // inactividad (js/modules/idle-logout.js), a los 30 minutos sin uso.
  var REMEMBER_KEY = 'consultia_remember';
  var EXPIRES_KEY  = 'consultia_session_exp';   // heredado: solo se limpia

  function setRememberFlags(remember) {
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, '1');
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    // Resto de la versión anterior: se borra siempre para no dejar
    // vencimientos viejos capaces de cerrar sesiones sin motivo.
    localStorage.removeItem(EXPIRES_KEY);
  }

  function clearRememberFlags() {
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  }

  Consultia.Auth = {
    // ===== Sesión =====
    getSession: function () { return sb.auth.getSession(); },

    getUser: async function () {
      var res = await sb.auth.getUser();
      return (res && res.data) ? res.data.user : null;
    },

    onAuthChange: function (cb) {
      return sb.auth.onAuthStateChange(function (event, session) {
        cb(event, session);
      });
    },

    // ===== Recordarme =====
    // Ya no vence a los 30 días: "Recordarme" solo decide dónde viven los
    // tokens. Se conserva la función porque auth-ui la llama en cada
    // refresco, y aprovecha para barrer el vencimiento de la versión
    // anterior, que si no seguiría cerrando sesiones por su cuenta.
    enforceRememberMe: async function () {
      localStorage.removeItem(EXPIRES_KEY);
    },

    // ===== Registro =====
    signUp: async function (data) {
      // data: { email, password, full_name, phone, captchaToken }
      // captchaToken: token de Turnstile. Mientras el CAPTCHA esté APAGADO
      // en el panel de Supabase, mandarlo es inofensivo — el servidor lo
      // ignora. Por eso se despliega este código ANTES de encender el
      // interruptor allá: al revés, cada registro fallaría.
      // Anti-abuso: capturamos device_fingerprint (FingerprintJS) y user_agent
      // para que el trigger DB pueda detectar cuentas duplicadas / descartables
      // y otorgar 0 créditos en vez de 5 cuando corresponda.
      var deviceFp = null;
      try {
        if (Consultia.DeviceFingerprint && Consultia.DeviceFingerprint.get) {
          deviceFp = await Consultia.DeviceFingerprint.get();
        }
      } catch (e) { /* sin fingerprint = registro normal */ }

      var res = await sb.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            phone: data.phone,
            device_fingerprint: deviceFp || '',
            user_agent: (navigator && navigator.userAgent) ? navigator.userAgent.slice(0, 500) : ''
          },
          emailRedirectTo: redirectUrl(),
          captchaToken: data.captchaToken || undefined
        }
      });
      return res; // { data, error }
    },

    // ===== Login =====
    // IMPORTANTE: seteamos el flag remember ANTES de signInWithPassword,
    // así el storage dinámico (supabase-config.js) decide si los tokens van
    // a localStorage (recordar 30d) o a sessionStorage (vive solo mientras
    // el navegador está abierto).
    signIn: async function (email, password, remember, captchaToken) {
      if (remember) {
        setRememberFlags(true);
      } else {
        clearRememberFlags();
      }
      var res = await sb.auth.signInWithPassword({
        email: email,
        password: password,
        options: { captchaToken: captchaToken || undefined }
      });
      if (res.error) {
        // Si falló el login, dejamos los flags como estaban antes (limpios)
        if (!remember) clearRememberFlags();
      }
      return res;
    },

    // ===== Logout =====
    signOut: async function () {
      var res = await sb.auth.signOut();
      clearRememberFlags();
      return res;
    },

    // ===== Recuperar contraseña — pide email =====
    requestPasswordReset: async function (email, captchaToken) {
      return await sb.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl() + '?recovery=1',
        captchaToken: captchaToken || undefined
      });
    },

    // ===== Reset contraseña — usuario ya llegó desde el link =====
    updatePassword: async function (newPassword) {
      return await sb.auth.updateUser({ password: newPassword });
    },

    // ===== Verificar OTP de recovery (código de 6 dígitos) =====
    // Flujo principal de "Olvidé contraseña": el usuario recibe un código
    // numérico por email y lo pega en el modal. Esto evita la dependencia
    // del link clickeable, que algunos proveedores SMTP (Brevo, etc.)
    // reescriben para tracking y rompen el token de un solo uso.
    verifyResetOtp: async function (email, token) {
      return await sb.auth.verifyOtp({
        type: 'recovery',
        email: email,
        token: token
      });
    },

    // ===== (Legacy) Verificar token_hash de recovery =====
    // Para mantener compatibilidad con links del flujo viejo (?token_hash=...).
    verifyRecoveryToken: async function (tokenHash) {
      return await sb.auth.verifyOtp({
        type: 'recovery',
        token_hash: tokenHash
      });
    },

    // ===== Reenviar email de verificación =====
    resendVerification: async function (email, captchaToken) {
      return await sb.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: redirectUrl(),
          captchaToken: captchaToken || undefined
        }
      });
    },

    // ===== Verificar cuenta con código OTP =====
    verifyOtp: async function (email, token) {
      return await sb.auth.verifyOtp({
        email: email,
        token: token,
        type: 'email'
      });
    },

    // ===== Perfil =====
    // Acepta opcionalmente:
    //   - un user ya conocido (objeto) para no hacer otro getUser.
    //   - true como bandera de "forzar refresh" (hace getUser desde Supabase).
    //   - cualquier otro valor truthy también fuerza refresh.
    getProfile: async function (userOrFlag) {
      var user = (userOrFlag && typeof userOrFlag === 'object') ? userOrFlag : null;
      if (!user) {
        // Si es force refresh, ir a la red; si no, resolver desde sesión local.
        var forceRefresh = userOrFlag === true;
        if (forceRefresh) {
          var userRes = await sb.auth.getUser();
          user = (userRes && userRes.data) ? userRes.data.user : null;
        } else {
          var sessionRes = await sb.auth.getSession();
          user = sessionRes && sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
        }
      }
      if (!user) return null;
      var res = await sb.from('profiles').select('*').eq('id', user.id).single();
      if (res.error) {
        console.error('[Consultia.Auth] Error leyendo profile:', res.error);
        return null;
      }
      return res.data;
    },

    updateProfile: async function (patch) {
      var user = await Consultia.Auth.getUser();
      if (!user) throw new Error('No hay sesión');
      return await sb.from('profiles').update(patch).eq('id', user.id);
    }
  };
})();
