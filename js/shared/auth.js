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

  // ===== "Recordarme por 30 días" =====
  // Si se marca: guardamos REMEMBER_KEY=1 + timestamp de vencimiento a 30d.
  // Si no: no guardamos nada → Supabase mantiene la sesión con su default
  // (también persiste, pero al menos no expira a los 30d de forma forzada).
  var REMEMBER_KEY = 'consultia_remember';
  var EXPIRES_KEY  = 'consultia_session_exp';
  var THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  function setRememberFlags(remember) {
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, '1');
      localStorage.setItem(EXPIRES_KEY, String(Date.now() + THIRTY_DAYS_MS));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(EXPIRES_KEY);
    }
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

    // ===== Recordarme — aplica solo el vencimiento de 30 días =====
    // Nota: antes tenía lógica de "cerrar sesión si se reabre el navegador"
    // basada en sessionStorage, pero rompía el flujo de abrir admin.html en
    // otra pestaña. Ahora solo forzamos logout cuando la sesión marcada con
    // 'Recordarme 30 días' vence, sin tocar la sesión por defecto.
    enforceRememberMe: async function () {
      var remember = localStorage.getItem(REMEMBER_KEY);
      if (remember !== '1') return;

      var exp = parseInt(localStorage.getItem(EXPIRES_KEY) || '0', 10);
      if (exp && Date.now() > exp) {
        await sb.auth.signOut();
        clearRememberFlags();
      }
    },

    // ===== Registro =====
    signUp: async function (data) {
      // data: { email, password, full_name, phone }
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
          emailRedirectTo: redirectUrl()
        }
      });
      return res; // { data, error }
    },

    // ===== Login =====
    // IMPORTANTE: seteamos el flag remember ANTES de signInWithPassword,
    // así el storage dinámico (supabase-config.js) decide si los tokens van
    // a localStorage (recordar 30d) o a sessionStorage (vive solo mientras
    // el navegador está abierto).
    signIn: async function (email, password, remember) {
      if (remember) {
        setRememberFlags(true);
      } else {
        clearRememberFlags();
      }
      var res = await sb.auth.signInWithPassword({ email: email, password: password });
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
    requestPasswordReset: async function (email) {
      return await sb.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl() + '?recovery=1'
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
    resendVerification: async function (email) {
      return await sb.auth.resend({
        type: 'signup',
        email: email,
        options: { emailRedirectTo: redirectUrl() }
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
