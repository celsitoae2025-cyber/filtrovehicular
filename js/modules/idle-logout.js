/* ============================================================
   CIERRE DE SESIÓN POR INACTIVIDAD — 5 minutos

   Pasados 5 minutos sin actividad la sesión se cierra por
   completo. Se aplica igual en la app y en el panel de
   administrador; ambos cargan este módulo.

   El instante de la última actividad se guarda en localStorage,
   no en una variable, por dos motivos:

     - Vale entre pestañas: si estás trabajando en otra pestaña,
       esta no te echa. Cualquiera de las dos "renueva" a las dos.
     - Sobrevive a un refresco: si la pestaña estuvo cerrada más
       del límite, al volver se cierra la sesión de inmediato en
       vez de regalar otros 5 minutos.

   Convive con "Recordarme", que decide dónde viven los tokens
   (ver js/shared/auth.js). Recordarme evita volver a escribir la
   contraseña tras cerrar el navegador; esto cierra la sesión
   cuando el equipo queda desatendido.
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};

  var LIMITE_MS   = 5 * 60 * 1000;   // 5 minutos sin actividad
  var REVISION_MS = 15 * 1000;       // cada cuánto se comprueba
  var GUARDA_MS   = 5 * 1000;        // no se escribe más seguido que esto
  var CLAVE       = 'consultia_ultima_actividad';

  var ultimaEscritura = 0;
  var timer = null;
  var cerrando = false;

  function sb() {
    return window.Consultia && window.Consultia.supabase;
  }

  function marcar(forzar) {
    var t = Date.now();
    // Escribir en cada mousemove sería absurdo: se limita a uno cada 5 s.
    if (!forzar && t - ultimaEscritura < GUARDA_MS) return;
    ultimaEscritura = t;
    try { localStorage.setItem(CLAVE, String(t)); } catch (e) {}
  }

  function ultimaActividad() {
    try {
      var v = parseInt(localStorage.getItem(CLAVE) || '0', 10);
      return isNaN(v) ? 0 : v;
    } catch (e) { return 0; }
  }

  async function haySesion() {
    var c = sb();
    if (!c) return false;
    try {
      var r = await c.auth.getSession();
      return !!(r && r.data && r.data.session);
    } catch (e) { return false; }
  }

  async function cerrar() {
    if (cerrando) return;
    cerrando = true;
    try { localStorage.removeItem(CLAVE); } catch (e) {}
    try {
      if (window.Consultia.Auth && Consultia.Auth.signOut) {
        await Consultia.Auth.signOut();
      } else if (sb()) {
        await sb().auth.signOut();
      }
    } catch (e) {
      console.warn('[inactividad] no se pudo cerrar la sesión:', e);
    }
    // El aviso va después de cerrar: quien escucha el cambio de sesión
    // (auth-gate en la app, admin/auth en el panel) ya habrá mostrado el
    // acceso, y el mensaje explica por qué.
    try {
      if (window.Consultia.toast) {
        Consultia.toast({
          type: 'info',
          title: 'Sesión cerrada',
          message: 'Se cerró por 5 minutos de inactividad.'
        });
      }
    } catch (e) {}
    cerrando = false;
  }

  async function revisar() {
    var ultima = ultimaActividad();
    if (!ultima) return;                       // sin marca aún, nada que medir
    if (Date.now() - ultima < LIMITE_MS) return;
    if (!(await haySesion())) return;          // sin sesión no hay nada que cerrar
    await cerrar();
  }

  function iniciar() {
    // Solo se arranca el reloj si hay sesión; si no, la marca no sirve.
    haySesion().then(function (hay) {
      if (hay) marcar(true);
    });

    // Cualquiera de estos gestos cuenta como actividad.
    var eventos = ['mousemove', 'mousedown', 'keydown', 'wheel',
                   'touchstart', 'scroll', 'click'];
    eventos.forEach(function (ev) {
      window.addEventListener(ev, function () { marcar(false); },
                              { passive: true });
    });

    // Volver a la pestaña cuenta como actividad, pero antes se comprueba:
    // si estuvo en segundo plano más del límite, toca cerrar.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      revisar().then(function () { if (!cerrando) marcar(true); });
    });

    // Al iniciar sesión se reinicia la cuenta desde cero.
    if (window.Consultia.Auth && Consultia.Auth.onAuthChange) {
      Consultia.Auth.onAuthChange(function (event, session) {
        if (session && session.user) marcar(true);
      });
    }

    revisar();                                  // por si la pestaña volvió tarde
    timer = setInterval(revisar, REVISION_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  Consultia.IdleLogout = {
    check: revisar,
    touch: function () { marcar(true); },
    limitMs: LIMITE_MS
  };
})();
