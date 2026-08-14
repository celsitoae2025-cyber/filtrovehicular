/* ============================================================
   ADMIN — MODO MANTENIMIENTO

   Interruptor global: al activarlo, los usuarios ven un aviso a
   pantalla completa y no pueden operar; los administradores siguen
   trabajando. El estado vive en Supabase (app_settings.maintenance),
   no en el navegador, para que valga para todos.

   Activar es una acción de impacto, así que se pide confirmación.
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var estado = { enabled: false, message: '', started_at: null };

  function sb() { return window.Consultia && window.Consultia.supabase; }
  function $(id) { return document.getElementById(id); }

  function fechaLegible(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) +
             ' · ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function pintar() {
    var activo = !!estado.enabled;
    var box   = $('mntStateBox');
    var dot   = $('mntStateDot');
    var tit   = $('mntStateTitle');
    var desc  = $('mntStateDesc');
    var label = $('mntStateLabel');
    var btn   = $('mntToggleBtn');
    var msg   = $('mntMessage');

    if (box) box.classList.toggle('is-on', activo);
    if (dot) dot.classList.toggle('is-on', activo);

    if (tit) tit.textContent = activo ? 'Mantenimiento activo' : 'Servicio operativo';
    if (label) label.textContent = activo ? 'Mantenimiento activo' : 'Servicio operativo';
    if (desc) {
      desc.textContent = activo
        ? ('Los usuarios ven el aviso y no pueden consultar' +
           (estado.started_at ? '. Desde ' + fechaLegible(estado.started_at) : '.'))
        : 'Los usuarios pueden consultar con normalidad.';
    }
    if (btn) {
      btn.textContent = activo ? 'Desactivar mantenimiento' : 'Activar mantenimiento';
      btn.classList.toggle('btn-primary', !activo);
      btn.classList.toggle('btn-danger', activo);
    }
    // No se pisa lo que el admin esté escribiendo
    if (msg && document.activeElement !== msg) msg.value = estado.message || '';

    // Interruptor de la barra superior (visible en todas las secciones).
    // Sin textos: verde encendido, rojo apagado. El title y el aria
    // cuentan el estado a quien pasa el ratón y a los lectores.
    var bar = $('mntBarBtn');
    if (bar) {
      bar.classList.toggle('is-on', activo);
      bar.setAttribute('aria-checked', activo ? 'true' : 'false');
      bar.title = activo
        ? 'Mantenimiento activo — pulsa para desactivarlo'
        : 'Servicio operativo — pulsa para activar el mantenimiento';
    }
  }

  async function cargar() {
    var c = sb();
    if (!c) return;
    try {
      var res = await c.rpc('get_maintenance');
      if (res.error) throw res.error;
      estado = res.data || estado;
      pintar();
    } catch (e) {
      console.warn('[admin/mantenimiento] no se pudo leer el estado:', e.message || e);
      var desc = $('mntStateDesc');
      if (desc) {
        desc.textContent = 'No se pudo leer el estado. Falta ejecutar ' +
                           'supabase/admin/maintenance_mode.sql.';
      }
    }
  }

  async function guardar(enabled, message) {
    var c = sb();
    if (!c) return false;
    var res = await c.rpc('set_maintenance', {
      enabled_in: enabled,
      message_in: message || null
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

  async function alternar() {
    var msg = $('mntMessage');
    var texto = msg ? msg.value.trim() : '';
    var activar = !estado.enabled;

    if (activar) {
      var ok = true;
      if (Consultia.confirm) {
        ok = await Consultia.confirm({
          title: 'Activar modo mantenimiento',
          message: 'Los usuarios dejarán de poder consultar y verán un aviso ' +
                   'a pantalla completa. Tú podrás seguir operando.<br><br>' +
                   '¿Confirmas activarlo?',
          confirmText: 'Activar',
          cancelText: 'Cancelar'
        });
      }
      if (!ok) return;
    }

    // Se bloquean los dos mandos: son el mismo interruptor en dos sitios
    var btn = $('mntToggleBtn');
    var bar = $('mntBarBtn');
    if (btn) btn.disabled = true;
    if (bar) bar.disabled = true;
    try {
      await guardar(activar, texto);
      if (A.logAudit) {
        A.logAudit('maintenance.' + (activar ? 'on' : 'off'), 'Mantenimiento',
                   activar ? (texto || 'mensaje por defecto') : 'desactivado');
      }
      aviso('success',
            activar ? 'Mantenimiento activado' : 'Mantenimiento desactivado',
            activar ? 'Los usuarios ven el aviso.' : 'El servicio quedó operativo.');
    } catch (e) {
      aviso('error', 'No se pudo cambiar el estado',
            (e && e.message) || 'Revisa que la migración esté ejecutada.');
    } finally {
      if (btn) btn.disabled = false;
      if (bar) bar.disabled = false;
    }
  }

  async function guardarMensaje() {
    var msg = $('mntMessage');
    var texto = msg ? msg.value.trim() : '';
    try {
      await guardar(estado.enabled, texto);
      aviso('success', 'Mensaje guardado',
            estado.enabled ? 'Los usuarios ya lo ven.' : 'Se usará al activar el mantenimiento.');
    } catch (e) {
      aviso('error', 'No se pudo guardar', (e && e.message) || 'Intenta de nuevo.');
    }
  }

  A.renderMaintenance = cargar;

  A.initMaintenance = function () {
    var btn = $('mntToggleBtn');
    if (btn) btn.addEventListener('click', alternar);
    var save = $('mntSaveMsgBtn');
    if (save) save.addEventListener('click', guardarMensaje);
    // Mismo interruptor desde la barra superior
    var bar = $('mntBarBtn');
    if (bar) bar.addEventListener('click', alternar);
    cargar();
  };
})();
