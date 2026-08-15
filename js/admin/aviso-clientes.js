/* ============================================================
   ADMIN — AVISO A LOS CLIENTES

   Interruptor propio para avisar de una incidencia dentro de la
   aplicación. Al encenderlo, todos los clientes ven una cinta con el
   mensaje y un botón para escribir a soporte por WhatsApp.

   NO ES EL MODO MANTENIMIENTO. Aquel apaga la plataforma entera; este
   solo informa y la aplicación sigue funcionando. Son dos interruptores
   distintos: encender uno no toca al otro.

   El estado vive en Supabase (app_settings.aviso_clientes), no en el
   navegador, para que valga para todos los clientes a la vez.
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var estado = { enabled: false, titulo: '', mensaje: '', cta: true, version: null, activado_en: null };

  var MAX_TITULO  = 90;
  var MAX_MENSAJE = 400;

  function sb() { return window.Consultia && window.Consultia.supabase; }
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fechaLegible(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) +
             ' · ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  /* ── Plantillas ──
     Textos ya redactados para los casos que se repiten. Un clic los deja
     puestos y editables: escribir bien y rápido a la vez, que es lo que
     hace falta cuando algo se acaba de caer. */
  // Las OCHO son el MISMO mensaje: "si tuviste un inconveniente con la
  // plataforma, escribe a soporte". Cambia solo la forma de decirlo —más
  // corta, más cercana, más formal— para poder elegir la que mejor suene
  // según el momento. No son ocho situaciones distintas.
  var PLANTILLAS = [
    {
      etiqueta: 'Directa',
      titulo: '¿Tuviste algún inconveniente con la plataforma?',
      mensaje: 'Escríbenos a soporte y lo resolvemos contigo. Estamos atentos.'
    },
    {
      etiqueta: 'Breve',
      titulo: '¿Algún inconveniente?',
      mensaje: 'Escríbenos a soporte y lo vemos ahora mismo.'
    },
    {
      etiqueta: 'Cercana',
      titulo: '¿Algo no te funcionó como esperabas?',
      mensaje: 'No te quedes con el problema: escríbenos a soporte y lo resolvemos ' +
               'juntos. Para eso estamos.'
    },
    {
      etiqueta: 'Pide los datos',
      titulo: '¿Tuviste algún inconveniente con la plataforma?',
      mensaje: 'Escríbenos a soporte contándonos qué intentabas hacer y a qué hora. ' +
               'Con esos dos datos lo ubicamos rápido y te respondemos.'
    },
    {
      etiqueta: 'Formal',
      titulo: 'Atención de incidencias',
      mensaje: 'Si presentaste algún inconveniente con la plataforma, comunícate con ' +
               'nuestro equipo de soporte. Atenderemos tu caso a la brevedad.'
    },
    {
      etiqueta: 'Resolutiva',
      titulo: 'Si algo te falló, lo arreglamos',
      mensaje: 'Cualquier inconveniente con la plataforma tiene solución. Escríbenos a ' +
               'soporte y no lo damos por cerrado hasta que quedes conforme.'
    },
    {
      etiqueta: 'Tranquilizadora',
      titulo: '¿Tuviste algún inconveniente con la plataforma?',
      mensaje: 'No pierdes nada. Escríbenos a soporte, revisamos tu caso y, si hubo ' +
               'créditos de por medio, te los reponemos.'
    },
    {
      etiqueta: 'Estamos atentos',
      titulo: 'Estamos atentos a cualquier inconveniente',
      mensaje: 'Si algo no te funcionó bien en la plataforma, escríbenos a soporte. ' +
               'Preferimos enterarnos y resolverlo que dejarlo pasar.'
    }
  ];

  /* ── Vista previa: la misma cinta que verá el cliente ── */
  function pintarPrevia() {
    var caja = $('avcPreview');
    if (!caja) return;

    var titulo  = (($('avcTitulo')  || {}).value || '').trim();
    var mensaje = (($('avcMensaje') || {}).value || '').trim();
    var conCta  = ($('avcCta') || {}).checked !== false;

    // El mismo cuadro que verá el cliente flotando en su pantalla.
    caja.innerHTML =
      '<div class="avc">' +
        '<span class="avc-cerrar" aria-hidden="true">&times;</span>' +
        '<div class="avc-cab">' +
          '<span class="avc-icono" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                 'stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/>' +
              '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' +
            '</svg>' +
          '</span>' +
          (titulo ? '<h2 class="avc-titulo">' + esc(titulo) + '</h2>' : '') +
        '</div>' +
        '<p class="avc-mensaje">' +
          (mensaje ? esc(mensaje) : 'Escribe el mensaje y aquí verás lo que va a leer el cliente.') +
        '</p>' +
        (conCta
          ? '<span class="avc-cta">' +
              '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
                '<path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.8 14.1c-.2.7-1.2 1.3-1.9 1.4-.5.1-1.1.2-3.6-.8-3-1.3-5-4.4-5.1-4.6-.2-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.5-.3.4c-.1.1-.2.3 0 .6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.8-1c.2-.2.3-.2.6-.1l2 1c.3.1.4.2.5.3.1.2.1.7-.1 1.3z"/>' +
              '</svg>Escribir a soporte</span>'
          : '') +
      '</div>';

    var ct = $('avcTituloCount');
    var cm = $('avcMensajeCount');
    if (ct) ct.textContent = titulo.length + '/' + MAX_TITULO;
    if (cm) cm.textContent = mensaje.length + '/' + MAX_MENSAJE;

    marcarSeleccionada();
  }

  /* ── Pintar el estado ── */
  function pintar() {
    var activo = !!estado.enabled;

    var box   = $('avcStateBox');
    var dot   = $('avcStateDot');
    var tit   = $('avcStateTitle');
    var desc  = $('avcStateDesc');
    var label = $('avcStateLabel');
    var btn   = $('avcToggleBtn');
    var elTit = $('avcTitulo');
    var elMsg = $('avcMensaje');
    var elCta = $('avcCta');

    // Tres estados, no dos. El del medio —mensaje guardado pero apagado—
    // es el que se presta a confusión: se elige una plantilla, se pulsa
    // "Guardar mensaje" y parece que ya está hecho, cuando en realidad no
    // lo ve nadie. Aquí se dice con todas las letras.
    var hayMensaje = !!(estado.mensaje || '').trim();

    if (box) box.classList.toggle('is-on', activo);
    if (box) box.classList.toggle('is-listo', !activo && hayMensaje);
    if (dot) dot.classList.toggle('is-on', activo);
    if (dot) dot.classList.toggle('is-listo', !activo && hayMensaje);

    var rotulo = activo ? 'Aviso encendido' : (hayMensaje ? 'Apagado — nadie lo ve' : 'Sin aviso');
    if (tit)   tit.textContent   = rotulo;
    if (label) label.textContent = rotulo;
    if (desc) {
      desc.textContent = activo
        ? ('Todos los clientes lo están viendo' +
           (estado.activado_en ? '. Desde ' + fechaLegible(estado.activado_en) : '.'))
        : (hayMensaje
            ? 'Tienes un mensaje guardado, pero el aviso está apagado y no lo ve ningún cliente. Pulsa «Encender aviso».'
            : 'Los clientes no ven ningún aviso en la aplicación.');
    }
    if (btn) {
      btn.textContent = activo ? 'Apagar aviso' : 'Encender aviso';
      btn.classList.toggle('btn-primary', !activo);
      btn.classList.toggle('btn-danger', activo);
    }

    // No se pisa lo que el administrador esté escribiendo ahora mismo
    if (elTit && document.activeElement !== elTit) elTit.value = estado.titulo || '';
    if (elMsg && document.activeElement !== elMsg) elMsg.value = estado.mensaje || '';
    if (elCta) elCta.checked = estado.cta !== false;

    // Interruptor de la barra superior (visible en todas las secciones)
    var bar = $('avcBarBtn');
    if (bar) {
      bar.classList.toggle('is-on', activo);
      bar.setAttribute('aria-checked', activo ? 'true' : 'false');
      bar.title = activo
        ? 'Aviso encendido — pulsa para apagarlo'
        : (estado.mensaje
            ? 'Aviso apagado — pulsa para encenderlo'
            : 'Aviso a los clientes — falta escribir el mensaje');
    }

    pintarPrevia();
  }

  async function cargar() {
    var c = sb();
    if (!c) return;
    try {
      var res = await c.rpc('get_aviso_clientes');
      if (res.error) throw res.error;
      estado = res.data || estado;
      pintar();
    } catch (e) {
      console.warn('[admin/aviso] no se pudo leer el estado:', e.message || e);
      var desc = $('avcStateDesc');
      if (desc) {
        desc.textContent = 'No se pudo leer el estado. Falta ejecutar la migración ' +
                           'supabase/migrations/20260815120000_aviso_clientes.sql.';
      }
    }
  }

  async function guardar(enabled, titulo, mensaje, cta) {
    var c = sb();
    if (!c) throw new Error('Supabase no disponible');
    var res = await c.rpc('set_aviso_clientes', {
      enabled_in: enabled,
      titulo_in:  titulo  || null,
      mensaje_in: mensaje || null,
      cta_in:     cta !== false
    });
    if (res.error) throw res.error;
    estado = res.data || estado;
    pintar();
    return true;
  }

  function aviso(tipo, titulo, mensaje) {
    if (window.Consultia.toast) {
      Consultia.toast({ type: tipo, title: titulo, message: mensaje });
    }
  }

  function leerFormulario() {
    return {
      titulo:  (($('avcTitulo')  || {}).value || '').trim(),
      mensaje: (($('avcMensaje') || {}).value || '').trim(),
      cta:     ($('avcCta') || {}).checked !== false
    };
  }

  function mostrarError(texto) {
    var box = $('avcError');
    if (!box) return;
    if (!texto) { box.hidden = true; return; }
    box.textContent = texto;
    box.hidden = false;
  }

  /* ── Encender / apagar ── */
  async function alternar() {
    var f = leerFormulario();
    var encender = !estado.enabled;
    mostrarError('');

    if (encender && !f.mensaje) {
      // Sin mensaje no se publica nada: se lleva al administrador a
      // escribirlo. Encender una cinta vacía en la aplicación de todos
      // los clientes sería peor que no encender nada.
      mostrarError('Escribe el mensaje antes de encender el aviso.');
      if (A.irAConfiguracion) A.irAConfiguracion();
      var elMsg = $('avcMensaje');
      if (elMsg) { elMsg.scrollIntoView({ block: 'center' }); elMsg.focus(); }
      aviso('info', 'Falta el mensaje',
            'Elige una plantilla o escribe el aviso, y vuelve a encenderlo.');
      return;
    }

    if (encender && Consultia.confirm) {
      var ok = await Consultia.confirm({
        title: 'Encender el aviso',
        message: 'Todos los clientes verán esta cinta al abrir la aplicación:<br><br>' +
                 '<strong>' + esc(f.titulo || '(sin título)') + '</strong><br>' +
                 esc(f.mensaje) + '<br><br>' +
                 'La aplicación seguirá funcionando con normalidad. ¿Lo enciendes?',
        confirmText: 'Encender',
        cancelText: 'Cancelar'
      });
      if (!ok) return;
    }

    // Se bloquean los dos mandos: son el mismo interruptor en dos sitios
    var btn = $('avcToggleBtn');
    var bar = $('avcBarBtn');
    if (btn) btn.disabled = true;
    if (bar) bar.disabled = true;
    try {
      await guardar(encender, f.titulo, f.mensaje, f.cta);
      if (A.logAudit) {
        A.logAudit('aviso.' + (encender ? 'on' : 'off'), 'Aviso a clientes',
                   encender ? f.mensaje.slice(0, 80) : 'apagado');
      }
      aviso('success',
            encender ? 'Aviso encendido' : 'Aviso apagado',
            encender ? 'Los clientes ya lo están viendo.' : 'La cinta desapareció de la aplicación.');
    } catch (e) {
      var msg = (e && e.message) || 'Intenta de nuevo.';
      if (/does not exist|not find|PGRST202/i.test(msg)) {
        msg = 'Falta ejecutar la migración 20260815120000_aviso_clientes.sql en Supabase.';
      } else if (/Solo un administrador/i.test(msg)) {
        msg = 'Tu usuario no tiene permisos de administrador.';
      }
      mostrarError(msg);
      aviso('error', 'No se pudo cambiar el aviso', msg);
    } finally {
      if (btn) btn.disabled = false;
      if (bar) bar.disabled = false;
    }
  }

  /* ── Guardar el texto sin tocar el interruptor ── */
  async function guardarTexto() {
    var f = leerFormulario();
    mostrarError('');

    if (estado.enabled && !f.mensaje) {
      mostrarError('El aviso está encendido: no puede quedarse sin mensaje.');
      return;
    }

    var btn = $('avcSaveBtn');
    if (btn) btn.disabled = true;
    try {
      await guardar(estado.enabled, f.titulo, f.mensaje, f.cta);
      aviso(estado.enabled ? 'success' : 'info',
            estado.enabled ? 'Mensaje guardado' : 'Guardado, pero el aviso sigue APAGADO',
            estado.enabled
              ? 'Los clientes ya ven el texto nuevo.'
              : 'Todavía no lo ve ningún cliente. Pulsa «Encender aviso» para publicarlo.');
    } catch (e) {
      var msg = (e && e.message) || 'Intenta de nuevo.';
      mostrarError(msg);
      aviso('error', 'No se pudo guardar', msg);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ── Plantillas ── */
  // Se pinta el TEXTO COMPLETO de cada plantilla, no solo su nombre: con
  // un rótulo suelto ("Directa", "Formal") no hay forma de elegir sin ir
  // probando una por una a ciegas.
  function pintarPlantillas() {
    var cont = $('avcPlantillas');
    if (!cont) return;
    cont.innerHTML = PLANTILLAS.map(function (p, i) {
      return '<button type="button" class="avc-plantilla" data-i="' + i + '">' +
               '<span class="avc-plantilla-etq">' + esc(p.etiqueta) + '</span>' +
               '<strong class="avc-plantilla-tit">' + esc(p.titulo) + '</strong>' +
               '<span class="avc-plantilla-msg">' + esc(p.mensaje) + '</span>' +
             '</button>';
    }).join('');

    cont.addEventListener('click', function (e) {
      var b = e.target.closest('.avc-plantilla');
      if (!b) return;
      var p = PLANTILLAS[Number(b.dataset.i)];
      if (!p) return;
      var elTit = $('avcTitulo');
      var elMsg = $('avcMensaje');
      if (elTit) elTit.value = p.titulo;
      if (elMsg) elMsg.value = p.mensaje;
      marcarSeleccionada();
      mostrarError('');
      pintarPrevia();
    });
  }

  // Resalta la plantilla que coincide con lo que hay ahora en el
  // formulario, para no perder de vista cuál está puesta.
  function marcarSeleccionada() {
    var tit = (($('avcTitulo')  || {}).value || '').trim();
    var msg = (($('avcMensaje') || {}).value || '').trim();
    var cont = $('avcPlantillas');
    if (!cont) return;
    [].forEach.call(cont.querySelectorAll('.avc-plantilla'), function (b) {
      var p = PLANTILLAS[Number(b.dataset.i)];
      b.classList.toggle('is-sel', !!p && p.titulo === tit && p.mensaje === msg);
    });
  }

  A.renderAvisoClientes = cargar;

  A.initAvisoClientes = function () {
    pintarPlantillas();

    var elTit = $('avcTitulo');
    var elMsg = $('avcMensaje');
    var elCta = $('avcCta');
    if (elTit) elTit.addEventListener('input', pintarPrevia);
    if (elMsg) elMsg.addEventListener('input', pintarPrevia);
    if (elCta) elCta.addEventListener('change', pintarPrevia);

    var btn = $('avcToggleBtn');
    if (btn) btn.addEventListener('click', alternar);
    var save = $('avcSaveBtn');
    if (save) save.addEventListener('click', guardarTexto);
    // Mismo interruptor desde la barra superior
    var bar = $('avcBarBtn');
    if (bar) bar.addEventListener('click', alternar);

    cargar();
  };
})();
