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
  var PLANTILLAS = [
    {
      etiqueta: 'Incidencia en el servicio',
      titulo: '¿Tuviste algún problema con una consulta?',
      mensaje: 'Estamos al tanto de una incidencia que afectó a algunas consultas. ' +
               'Si la tuya no devolvió resultado o los créditos no se te acreditaron, ' +
               'escríbenos a soporte y lo resolvemos. Ten a la mano la placa o el DNI ' +
               'que consultaste y la hora aproximada.'
    },
    {
      etiqueta: 'Servicio restablecido',
      titulo: 'Servicio restablecido',
      mensaje: 'Ya está todo funcionando con normalidad. Si tu consulta sigue fallando ' +
               'o notas créditos descontados sin resultado, escríbenos a soporte y lo ' +
               'revisamos contigo.'
    },
    {
      etiqueta: 'Lentitud puntual',
      titulo: 'Las consultas pueden tardar más de lo normal',
      mensaje: 'Las fuentes oficiales están respondiendo con lentitud, así que algunas ' +
               'consultas pueden demorar más de lo habitual. No repitas la consulta: ' +
               'si no obtienes resultado, no se te cobran créditos.'
    },
    {
      etiqueta: 'Mantenimiento programado',
      titulo: 'Mantenimiento programado esta noche',
      mensaje: 'Hoy de 11:00 p. m. a 1:00 a. m. haremos mejoras en la plataforma. ' +
               'Durante ese rato el servicio puede interrumpirse por momentos. ' +
               'Cualquier problema, escríbenos a soporte.'
    }
  ];

  /* ── Vista previa: la misma cinta que verá el cliente ── */
  function pintarPrevia() {
    var caja = $('avcPreview');
    if (!caja) return;

    var titulo  = (($('avcTitulo')  || {}).value || '').trim();
    var mensaje = (($('avcMensaje') || {}).value || '').trim();
    var conCta  = ($('avcCta') || {}).checked !== false;

    caja.innerHTML =
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
          '<p class="avc-mensaje">' +
            (mensaje ? esc(mensaje) : 'Escribe el mensaje y aquí verás lo que va a leer el cliente.') +
          '</p>' +
        '</div>' +
        (conCta
          ? '<span class="avc-cta">' +
              '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
                '<path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.8 14.1c-.2.7-1.2 1.3-1.9 1.4-.5.1-1.1.2-3.6-.8-3-1.3-5-4.4-5.1-4.6-.2-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.5-.3.4c-.1.1-.2.3 0 .6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.8-1c.2-.2.3-.2.6-.1l2 1c.3.1.4.2.5.3.1.2.1.7-.1 1.3z"/>' +
              '</svg>Escribir a soporte</span>'
          : '') +
        '<span class="avc-cerrar" aria-hidden="true">&times;</span>' +
      '</div>';

    var ct = $('avcTituloCount');
    var cm = $('avcMensajeCount');
    if (ct) ct.textContent = titulo.length + '/' + MAX_TITULO;
    if (cm) cm.textContent = mensaje.length + '/' + MAX_MENSAJE;
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

    if (box) box.classList.toggle('is-on', activo);
    if (dot) dot.classList.toggle('is-on', activo);

    if (tit)   tit.textContent   = activo ? 'Aviso encendido' : 'Sin aviso';
    if (label) label.textContent = activo ? 'Aviso encendido' : 'Sin aviso';
    if (desc) {
      desc.textContent = activo
        ? ('Todos los clientes lo están viendo' +
           (estado.activado_en ? '. Desde ' + fechaLegible(estado.activado_en) : '.'))
        : 'Los clientes no ven ninguna cinta en la aplicación.';
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
      mostrarError('Escribe el mensaje antes de encender el aviso.');
      var elMsg = $('avcMensaje');
      if (elMsg) elMsg.focus();
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

    var btn = $('avcToggleBtn');
    if (btn) btn.disabled = true;
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
      aviso('success', 'Mensaje guardado',
            estado.enabled
              ? 'Los clientes ya ven el texto nuevo.'
              : 'Se usará cuando enciendas el aviso.');
    } catch (e) {
      var msg = (e && e.message) || 'Intenta de nuevo.';
      mostrarError(msg);
      aviso('error', 'No se pudo guardar', msg);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ── Plantillas ── */
  function pintarPlantillas() {
    var cont = $('avcPlantillas');
    if (!cont) return;
    cont.innerHTML = PLANTILLAS.map(function (p, i) {
      return '<button type="button" class="avc-plantilla" data-i="' + i + '">' +
             esc(p.etiqueta) + '</button>';
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
      mostrarError('');
      pintarPrevia();
      if (elMsg) elMsg.focus();
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

    cargar();
  };
})();
