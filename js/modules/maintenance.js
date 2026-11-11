/*
 * MODO MANTENIMIENTO — aviso para todos los visitantes de la consulta.
 *
 * Consulta el estado compartido en Supabase al cargar, escucha cambios
 * Realtime y vuelve a consultar cada 5 segundos como respaldo. Este módulo
 * solo se carga en app.html; admin.html permanece accesible para operar.
 */
(function () {
  window.Consultia = window.Consultia || {};

  var OVERLAY_ID = 'maintenanceOverlay';
  var POLL_MS = 5000;
  var MENSAJE_POR_DEFECTO =
    'Estamos realizando tareas de mejora en la plataforma. ' +
    'El servicio se restablecerá en breve.';

  function sb() {
    return window.Consultia && window.Consultia.supabase;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function quitarAviso() {
    var el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
    document.documentElement.classList.remove('mnt-locked');
  }

  function mostrarAviso(mensaje) {
    if (document.getElementById(OVERLAY_ID)) return;
    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'mnt-overlay';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-label', 'Sistema en mantenimiento');
    el.innerHTML =
      '<div class="mnt-card">' +
        '<div class="mnt-mark">' +
          '<span class="mnt-mark-text">Plataforma Filtro Vehicular</span>' +
          '<span class="mnt-mark-plus">+</span>' +
        '</div>' +
        '<div class="mnt-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
               'stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' +
          '</svg>' +
        '</div>' +
        '<h1 class="mnt-title">Sistema en mantenimiento</h1>' +
        '<p class="mnt-text">' + esc(mensaje || MENSAJE_POR_DEFECTO) + '</p>' +
        '<button type="button" class="mnt-retry" id="mntRetry">Reintentar</button>' +
      '</div>';
    document.body.appendChild(el);
    document.documentElement.classList.add('mnt-locked');

    var btn = document.getElementById('mntRetry');
    if (btn) btn.addEventListener('click', function () { window.location.reload(); });
  }

  function applyState(estado) {
    if (!estado || !estado.enabled) {
      quitarAviso();
      return;
    }
    // Todos los visitantes de app.html quedan bloqueados, incluso antes
    // de iniciar sesión o si usan una cuenta administradora. admin.html
    // es independiente y sigue disponible para gestionar el servicio.
    mostrarAviso(estado.message);
  }

  var enVuelo = false;
  var apagado = false;
  var timer = null;

  async function check() {
    if (apagado || enVuelo) return;
    var c = sb();
    if (!c) return;
    enVuelo = true;
    try {
      var res = await c.rpc('get_maintenance');
      if (res.error) throw res.error;
      applyState(res.data || null);
    } catch (e) {
      var msg = (e && e.message) || '';
      if (/not find|does not exist|404|PGRST202/i.test(msg)) {
        apagado = true;
        if (timer) { clearInterval(timer); timer = null; }
        console.info('[mantenimiento] falta ejecutar supabase/admin/maintenance_mode.sql');
      } else {
        console.warn('[mantenimiento] no se pudo leer el estado:', msg || e);
      }
    } finally {
      enVuelo = false;
    }
  }

  function iniciar() {
    check();
    timer = setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) check();
    });
    window.addEventListener('focus', check);

    // Realtime da respuesta inmediata cuando app_settings está publicado;
    // el sondeo de 5 segundos cubre desconexiones o falta de publicación.
    try {
      var c = sb();
      if (c && c.channel) {
        c.channel('fv-maintenance-status')
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'app_settings',
            filter: 'key=eq.maintenance'
          }, check)
          .subscribe();
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  Consultia.Maintenance = { check: check, applyState: applyState };
})();
