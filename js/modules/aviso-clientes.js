/* ============================================================
   AVISO A LOS CLIENTES — cinta informativa dentro de la aplicación.

   Lee el interruptor global (app_settings.aviso_clientes) y, si está
   encendido, coloca una cinta arriba del contenido con el mensaje que
   escribió el administrador y un botón para escribir a soporte.

   NO BLOQUEA NADA. La aplicación sigue funcionando igual: es un aviso,
   no un muro. (El muro es el modo mantenimiento, que es otro
   interruptor distinto y vive en js/modules/maintenance.js.)

   El cliente puede cerrarla. Se recuerda cerrada mientras el aviso sea
   EL MISMO: en cuanto el administrador cambia el texto o vuelve a
   encenderlo, la versión cambia y la cinta reaparece — si no, un aviso
   nuevo se perdería para todo el que cerró el anterior.

   Se revisa al cargar y cada 60 s, para que quien ya tenía la página
   abierta también se entere.

   Expone:
     Consultia.AvisoClientes.check()         — fuerza una revisión
     Consultia.AvisoClientes.applyState(est) — pinta un estado dado
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};

  var CINTA_ID  = 'avisoClientes';
  var POLL_MS   = 60000;
  var LS_KEY    = 'fv_aviso_cerrado';   // guarda la versión que el cliente ya descartó

  function sb() {
    return window.Consultia && window.Consultia.supabase;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Enlace a soporte ──
     Reutiliza el botón de WhatsApp que ya existe: se manda la frase que
     activa al bot más la opción 6 (hablar con un asesor), así el cliente
     cae directo con una persona en vez de tener que recorrer el menú. */
  function enlaceSoporte() {
    try {
      if (!Consultia.WHATSAPP_NUMBER) return null;
      var saludo = (typeof Consultia.greeting === 'function') ? Consultia.greeting() : 'Hola';
      var msg = saludo + ', estoy en Filtro Vehicular+ y quiero hablar con un asesor.';
      return 'https://wa.me/' + Consultia.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
    } catch (e) {
      return null;
    }
  }

  /* ── ¿Este cliente ya cerró ESTA versión del aviso? ── */
  function yaCerrado(version) {
    try {
      return !!version && window.localStorage.getItem(LS_KEY) === String(version);
    } catch (e) {
      return false;   // sin localStorage se muestra siempre; mejor de más que de menos
    }
  }

  function marcarCerrado(version) {
    try {
      if (version) window.localStorage.setItem(LS_KEY, String(version));
    } catch (e) {}
  }

  function quitar() {
    var el = document.getElementById(CINTA_ID);
    if (el) el.remove();
    document.documentElement.classList.remove('avc-abierto');
    document.removeEventListener('keydown', alPulsarTecla);
  }

  function alPulsarTecla(e) {
    if (e.key === 'Escape') {
      var el = document.getElementById(CINTA_ID);
      if (el) cerrarYRecordar(el.dataset.version);
    }
  }

  // Cerrar = recordar que este cliente ya vio ESTA versión + devolverle
  // la aplicación. Todo lo que cierra el cuadro pasa por aquí.
  function cerrarYRecordar(version) {
    marcarCerrado(version);
    quitar();
  }

  /* ── ¿El cliente ya entró a su cuenta? ──
     El cuadro tapa la pantalla, así que NO puede salir sobre el login:
     dejaría al cliente sin poder entrar. Se espera a que haya sesión. */
  function haySesion() {
    return !document.body.classList.contains('auth-locked');
  }

  /* ── Pintar el cuadro ── */
  function mostrar(estado) {
    var existente = document.getElementById(CINTA_ID);
    // Si ya está puesto y es la misma versión, no se toca: repintarlo en
    // cada sondeo lo haría parpadear cada minuto.
    if (existente && existente.dataset.version === String(estado.version || '')) return;
    if (existente) existente.remove();

    var titulo  = (estado.titulo  || '').trim();
    var mensaje = (estado.mensaje || '').trim();
    var url     = estado.cta === false ? null : enlaceSoporte();

    var el = document.createElement('div');
    el.id = CINTA_ID;
    el.className = 'avc-fondo';
    el.dataset.version = String(estado.version || '');
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-live', 'assertive');
    if (titulo) el.setAttribute('aria-label', titulo);

    el.innerHTML =
      '<div class="avc">' +
        '<button type="button" class="avc-cerrar" aria-label="Cerrar aviso">&times;</button>' +
        (titulo ? '<h2 class="avc-titulo">' + esc(titulo) + '</h2>' : '') +
        '<p class="avc-mensaje">' + esc(mensaje) + '</p>' +
        (url
          ? '<span class="avc-manos" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
                   'stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="m11 17 2 2a1 1 0 1 0 3-3"/>' +
                '<path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/>' +
                '<path d="m21 3 1 11h-2"/>' +
                '<path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/>' +
                '<path d="M3 4h8"/>' +
              '</svg>' +
            '</span>' +
            '<a class="avc-cta" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
              'Escribir a soporte' +
            '</a>'
          : '') +
      '</div>';

    document.body.appendChild(el);
    document.documentElement.classList.add('avc-abierto');

    var version = estado.version;
    var cerrar = el.querySelector('.avc-cerrar');
    cerrar.addEventListener('click', function () { cerrarYRecordar(version); });
    // Un clic fuera del cuadro también cierra
    el.addEventListener('click', function (e) {
      if (e.target === el) cerrarYRecordar(version);
    });
    document.addEventListener('keydown', alPulsarTecla);

    // El foco va a la equis: quien navegue con teclado sale de aquí con
    // una pulsación, sin tener que buscar.
    try { cerrar.focus(); } catch (e) {}
  }

  /* ── Pintar un estado ── */
  function applyState(estado) {
    var activo = !!(estado && estado.enabled);
    if (!activo || !(estado.mensaje || '').trim()) { quitar(); return; }
    if (yaCerrado(estado.version)) { quitar(); return; }
    // Sin sesión no se muestra: taparía el login y el cliente no podría
    // ni entrar. Se pinta en cuanto entre (ver onAuthStateChange).
    if (!haySesion()) { quitar(); return; }
    mostrar(estado);
  }

  /* ── Consultar el interruptor ── */
  var enVuelo = false;   // evita solaparse consigo mismo
  var apagado = false;   // deja de insistir si la RPC no existe
  var timer = null;

  async function check() {
    if (apagado || enVuelo) return;
    var c = sb();
    if (!c) return;
    enVuelo = true;
    try {
      var res = await c.rpc('get_aviso_clientes');
      if (res.error) throw res.error;
      applyState(res.data || null);
    } catch (e) {
      // Si la función todavía no está creada, no tiene sentido seguir
      // preguntando cada minuto: la aplicación sigue igual de bien.
      var msg = (e && e.message) || '';
      if (/not find|does not exist|404|PGRST202/i.test(msg)) {
        apagado = true;
        if (timer) { clearInterval(timer); timer = null; }
        console.info('[aviso] inactivo: falta ejecutar la migración ' +
                     'supabase/migrations/20260815120000_aviso_clientes.sql');
      } else {
        console.warn('[aviso] no se pudo leer el estado:', msg || e);
      }
    } finally {
      enVuelo = false;
    }
  }

  function iniciar() {
    check();
    timer = setInterval(check, POLL_MS);
    // Al volver a la pestaña conviene revisar de inmediato: puede haberse
    // encendido un aviso mientras el cliente estaba en otra ventana.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) check();
    });
    // Y en cuanto el cliente entra a su cuenta, sin esperar al siguiente
    // sondeo: el aviso tiene que recibirle al entrar, no un minuto
    // después de que ya se puso a trabajar.
    try {
      var c = sb();
      if (c && c.auth && c.auth.onAuthStateChange) {
        c.auth.onAuthStateChange(function () { setTimeout(check, 400); });
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  Consultia.AvisoClientes = { check: check, applyState: applyState };
})();
