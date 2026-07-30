/* ============================================================
   AUTH GATE — fuerza login al entrar a la app
   - Sin sesión: oculta sidebar/topbar/contenido y muestra el
     modal de login en modo "obligatorio" (no se puede cerrar).
   - Con sesión: comportamiento normal.
   - Después de logout: vuelve al estado bloqueado.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var BODY_LOCKED    = 'auth-locked';     // oculta sidebar/topbar/views vía CSS
  var BODY_MANDATORY = 'auth-mandatory';  // bloquea cierre del modal de login

  function lock() {
    document.body.classList.add(BODY_LOCKED, BODY_MANDATORY);
    // Asegurar que cualquier overlay residual quede limpio antes de abrir
    if (Consultia.AuthModals && Consultia.AuthModals.closeAll) {
      Consultia.AuthModals.closeAll();
    }
    // Determinar qué modal abrir: respetar ?action=signup del landing
    var params = new URLSearchParams(window.location.search);
    var action = params.get('action');
    var openFn = (action === 'signup') ? 'openSignup' : 'openLogin';

    var retries = 0;
    var tryOpen = function () {
      if (Consultia.AuthModals && Consultia.AuthModals[openFn]) {
        Consultia.AuthModals[openFn]();
      } else if (retries < 100) {
        retries++;
        setTimeout(tryOpen, 30);
      }
    };
    tryOpen();
  }

  function unlock() {
    document.body.classList.remove(BODY_LOCKED, BODY_MANDATORY);
  }

  Consultia.initAuthGate = function () {
    if (!Consultia.Auth || !Consultia.Auth.getSession) {
      console.error('[auth-gate] Consultia.Auth no está disponible');
      return;
    }

    // Estado inicial: lee la sesión y bloquea/desbloquea
    Consultia.Auth.getSession().then(function (res) {
      var user = res && res.data && res.data.session && res.data.session.user;
      if (user) unlock();
      else      lock();
    }).catch(function () {
      // Por seguridad, si falla la lectura, bloqueamos
      lock();
    });

    // Reaccionar a cambios de sesión (login, logout, refresh expirado)
    Consultia.Auth.onAuthChange(function (event, session) {
      if (session && session.user) {
        unlock();
      } else {
        // SIGNED_OUT, USER_DELETED, TOKEN_REFRESHED con session=null, etc.
        lock();
      }
    });
  };
})();
