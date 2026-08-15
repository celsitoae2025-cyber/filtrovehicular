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
        '<span class="avc-icono" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
               'stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/>' +
            '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' +
          '</svg>' +
        '</span>' +
        '<div class="avc-texto">' +
          (titulo ? '<p class="avc-titulo">' + esc(titulo) + '</p>' : '') +
          '<p class="avc-mensaje">' + esc(mensaje) + '</p>' +
        '</div>' +
        (url
          ? '<a class="avc-cta" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
              '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
                '<path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.8 14.1c-.2.7-1.2 1.3-1.9 1.4-.5.1-1.1.2-3.6-.8-3-1.3-5-4.4-5.1-4.6-.2-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.5-.3.4c-.1.1-.2.3 0 .6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.8-1c.2-.2.3-.2.6-.1l2 1c.3.1.4.2.5.3.1.2.1.7-.1 1.3z"/>' +
              '</svg>' +
              'Escribir a soporte' +
            '</a>'
          : '') +
        '<button type="button" class="avc-cerrar" aria-label="Cerrar aviso">&times;</button>' +
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
