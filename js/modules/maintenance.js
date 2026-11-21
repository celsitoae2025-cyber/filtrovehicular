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
    'Estamos realizando mejoras en la plataforma. ' +
    'Las consultas volverán a estar disponibles cuando terminemos.';

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

  function actualizarEstilosAviso() {
    if (navigator.onLine === false) return;
    var link = document.querySelector('link[rel="stylesheet"][href*="css/maintenance.css"]');
    if (!link) return;
    var url = new URL(link.href, window.location.href);
    url.searchParams.set('aviso', String(Date.now()));
    link.href = url.href;
  }

  function mostrarAviso(mensaje) {
    var actual = document.getElementById(OVERLAY_ID);
    if (actual) {
      actual.querySelector('#mntText').textContent = mensaje || MENSAJE_POR_DEFECTO;
      return;
    }
    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'mnt-overlay';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-labelledby', 'mntTitle');
    el.setAttribute('aria-describedby', 'mntText');
    el.innerHTML =
      '<div class="mnt-card">' +
        '<div class="mnt-brand">' +
          '<span class="fv-wordmark" role="img" aria-label="Plataforma Filtro Vehicular+">' +
            '<span class="fv-wordmark-line" aria-hidden="true">Plataforma Filtro</span>' +
            '<span class="fv-wordmark-line" aria-hidden="true">Vehicular<span class="fv-wordmark-plus">+</span></span>' +
          '</span>' +
        '</div>' +
        '<div class="mnt-divider" aria-hidden="true"></div>' +
        '<div class="mnt-status"><span class="mnt-status-dot" aria-hidden="true"></span>' +
          '<span>Mantenimiento en curso</span></div>' +
        '<div class="mnt-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" ' +
               'stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94L14.7 6.3Z"/>' +
          '</svg>' +
        '</div>' +
        '<h1 class="mnt-title" id="mntTitle">Estamos en mantenimiento</h1>' +
        '<p class="mnt-text" id="mntText">' + esc(mensaje || MENSAJE_POR_DEFECTO) + '</p>' +
        '<button type="button" class="mnt-retry" id="mntRetry">' +
          '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
            '<path d="M16.2 8a6.5 6.5 0 0 0-11.6-2L3 8m0 0V4.5M3 8h3.5M3.8 12a6.5 6.5 0 0 0 11.6 2L17 12m0 0v3.5M17 12h-3.5" ' +
              'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
          '<span>Comprobar disponibilidad</span>' +
        '</button>' +
        '<p class="mnt-footer">Esta pantalla comprueba la disponibilidad automáticamente.</p>' +
      '</div>';
    // El aviso permanece legible mientras se renueva una hoja antigua.
    el.style.background = '#f2f3f2';
    el.style.color = '#1b1b1b';
    el.querySelector('.mnt-card').style.background = '#fff';
    el.querySelector('.mnt-brand').style.color = '#202825';
    el.querySelector('.fv-wordmark').style.color = '#202825';
    el.querySelector('.mnt-title').style.color = '#1b1b1b';
    el.querySelector('.mnt-status').style.color = '#636b65';
    el.querySelector('.mnt-icon').style.color = '#5f9937';
    el.querySelector('.mnt-retry').style.background = '#1b1b1b';
    el.querySelector('.mnt-retry').style.color = '#fff';
    document.body.appendChild(el);
    document.documentElement.classList.add('mnt-locked');
    actualizarEstilosAviso();

    var btn = document.getElementById('mntRetry');
    if (btn) btn.addEventListener('click', async function () {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.querySelector('span').textContent = 'Comprobando…';
      try { await check(); }
      finally {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.querySelector('span').textContent = 'Comprobar disponibilidad';
      }
    });
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
    if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (document.getElementById(OVERLAY_ID)) actualizarEstilosAviso();
    });

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
