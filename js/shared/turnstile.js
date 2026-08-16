/* ============================================================
   TURNSTILE — verificación anti-bot de Cloudflare
   Expone: Consultia.Turnstile.render/getToken/reset

   Para qué está: Cloudflare NO ve las peticiones de registro ni de
   login. Esas van directas a kkqpayfyhvxatskkrqdg.supabase.co, que
   está fuera de la zona, así que ni el rate limiting ni Bot Fight Mode
   las tocan. La única forma de frenar el registro masivo y la fuerza
   bruta contra el login es que Supabase Auth exija un token de
   Turnstile: el navegador lo consigue aquí y Supabase lo verifica
   contra Cloudflare antes de crear la cuenta o dar la sesión.

   Se carga en modo explícito (render=explicit) a propósito: los
   formularios viven dentro de modales que se inyectan al arrancar y
   pueden abrirse y cerrarse muchas veces. El renderizado automático
   buscaría los contenedores una sola vez y dejaría widgets muertos.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  // Widget "Filtro Vehicular+ registro y acceso" (modo managed).
  // La clave pública se publica a propósito: va en el HTML. La clave
  // secreta NO vive aquí, vive en el panel de Supabase.
  var SITEKEY = '0x4AAAAAAERUke2Lfxh4Dhjb';

  var SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js' +
                   '?render=explicit&onload=__consultiaTurnstileReady';

  // Cuánto esperamos un token antes de rendirnos y enviar el formulario
  // sin él. Preferimos que Supabase conteste con un error claro a dejar
  // al usuario mirando un botón bloqueado para siempre.
  var TOKEN_TIMEOUT_MS = 8000;

  var scriptPedido = false;
  var apiLista = false;
  var enEspera = [];              // callbacks esperando a que cargue la API
  var widgets = {};               // containerId -> { id, token, waiters }

  // La llama el propio script de Cloudflare cuando la API está lista.
  window.__consultiaTurnstileReady = function () {
    apiLista = true;
    var pendientes = enEspera.splice(0);
    pendientes.forEach(function (fn) {
      try { fn(); } catch (e) { console.error('[Turnstile]', e); }
    });
  };

  function pedirScript() {
    if (scriptPedido) return;
    scriptPedido = true;
    var s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onerror = function () {
      // Bloqueado por un adblocker o sin red. No rompemos nada: los
      // getToken pendientes vencerán por timeout y devolverán null.
      console.warn('[Turnstile] no se pudo cargar el script de Cloudflare');
    };
    document.head.appendChild(s);
  }

  function cuandoEsteLista(cb) {
    if (apiLista) { cb(); return; }
    enEspera.push(cb);
    pedirScript();
  }

  function estado(containerId) {
    if (!widgets[containerId]) {
      widgets[containerId] = { id: null, token: null, waiters: [] };
    }
    return widgets[containerId];
  }

  function entregarToken(containerId, token) {
    var w = estado(containerId);
    w.token = token;
    var waiters = w.waiters.splice(0);
    waiters.forEach(function (resolve) { resolve(token); });
  }

  Consultia.Turnstile = {
    SITEKEY: SITEKEY,

    /* Monta el widget en un contenedor. Es idempotente: llamarlo dos
       veces sobre el mismo contenedor no duplica nada. Conviene llamarlo
       al ABRIR el modal, no antes: el token vence a los 5 minutos y así
       llega fresco al momento de enviar. */
    render: function (containerId) {
      var el = document.getElementById(containerId);
      if (!el) return;
      var w = estado(containerId);
      if (w.id !== null) { this.reset(containerId); return; }

      cuandoEsteLista(function () {
        // Puede haberse montado mientras esperábamos a la API.
        if (w.id !== null) return;
        if (!window.turnstile) return;
        try {
          w.id = window.turnstile.render('#' + containerId, {
            sitekey: SITEKEY,
            theme: 'light',
            language: 'es',
            action: containerId,
            callback: function (token) { entregarToken(containerId, token); },
            'expired-callback': function () {
              w.token = null;
              if (window.turnstile && w.id !== null) window.turnstile.reset(w.id);
            },
            'error-callback': function () {
              // Fallo de red o del reto: liberamos a quien esté esperando
              // con null para que el formulario no se quede colgado.
              entregarToken(containerId, null);
              return true;
            }
          });
        } catch (e) {
          console.error('[Turnstile] render falló:', e);
          entregarToken(containerId, null);
        }
      });
    },

    /* Devuelve una promesa con el token, o null si no hubo forma de
       conseguirlo. Nunca rechaza: quien la llama decide qué hacer. */
    getToken: function (containerId) {
      var w = estado(containerId);
      if (w.token) return Promise.resolve(w.token);

      // Si nadie lo montó todavía (p. ej. el modal se abrió por una vía
      // que no pasa por openModal), lo montamos ahora.
      if (w.id === null) this.render(containerId);

      return new Promise(function (resolve) {
        var resuelto = false;
        function unaVez(token) {
          if (resuelto) return;
          resuelto = true;
          resolve(token || null);
        }
        w.waiters.push(unaVez);
        setTimeout(function () { unaVez(null); }, TOKEN_TIMEOUT_MS);
      });
    },

    /* Los tokens son de un solo uso. Hay que resetear después de cada
       envío, salga bien o mal, o el siguiente intento manda uno gastado
       y Supabase lo rechaza. */
    reset: function (containerId) {
      var w = estado(containerId);
      w.token = null;
      if (window.turnstile && w.id !== null) {
        try { window.turnstile.reset(w.id); } catch (e) { /* widget ya muerto */ }
      }
    }
  };
})();
