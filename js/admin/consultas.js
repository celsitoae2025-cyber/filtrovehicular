/* ============================================================
   ADMIN CONSULTAS — LA ACTIVIDAD DE HOY, EN VIVO

   Esta pantalla es el pulso del día: qué se está consultando ahora
   mismo, de lo más reciente a lo más antiguo. Tres reglas:

     1. Solo HOY. A medianoche se vacía sola y empieza de cero; no hay
        que recargar la página ni tocar nada.
     2. Se refresca cada segundo. Las consultas nuevas entran solas por
        Realtime, y cada segundo se reescribe el «hace cuánto» de cada
        fila — sin volver a pedirle nada a la base.
     3. No se pierde nada. Esto es la pizarra del día; el historial
        completo de cada cliente sigue en su ficha, en Usuarios, y en la
        base de datos, que aquí no se borra ni una fila.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  function getSB() { return (window.Consultia && window.Consultia.supabase) || null; }

  var MODULE_LABELS = {
    vehiculos: 'Vehículos', sunarp: 'Sunarp', reniec: 'Reniec', sunat: 'Sunat',
    financiero: 'Financiero', facial: 'Facial', telefonia: 'Telefonía',
    familiares: 'Familiares', certificados: 'Certificados', delitos: 'Delitos',
    migraciones: 'Migraciones', estudios: 'Estudios', extras: 'Extras',
    laboral: 'Laboral', actas: 'Actas', filter: 'Consulta de placa'
  };

  var cachedRows = [];      // la actividad de hoy, con el usuario resuelto
  var realtimeChannel = null;
  var refreshTimer = null;
  var relojTimer = null;
  var diaCargado = null;    // el día que hay pintado, para detectar la medianoche

  function inicioDeHoy() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function claveDelDia() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* «hace 3 s», «hace 12 min». Lo que se mira en una pantalla en vivo no
     es la fecha —son todas de hoy— sino cuánto hace. */
  function haceCuanto(iso) {
    if (!iso) return '—';
    var seg = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (!isFinite(seg)) return '—';
    if (seg < 5)    return 'ahora mismo';
    if (seg < 60)   return 'hace ' + seg + ' s';
    var min = Math.floor(seg / 60);
    if (min < 60)   return 'hace ' + min + ' min';
    var h = Math.floor(min / 60);
    return 'hace ' + h + ' h ' + (min % 60) + ' min';
  }

  function horaExacta(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  async function loadConsultas() {
    var sb = getSB();
    if (!sb) return [];
    diaCargado = claveDelDia();
    // Solo lo de hoy, de lo más nuevo a lo más viejo.
    var res = await sb.from('consultas')
      .select('id, user_id, module, type, input, cost, status, created_at')
      .gte('created_at', inicioDeHoy().toISOString())
      .order('created_at', { ascending: false })
      .limit(500);
    if (res.error) {
      console.error('consultas load error:', res.error);
      return [];
    }
    var rows = res.data || [];

    // Resolver nombres de usuarios
    var ids = {};
    rows.forEach(function (r) { if (r.user_id) ids[r.user_id] = 1; });
    var userIds = Object.keys(ids);
    var nameById = {}, emailById = {};
    if (userIds.length) {
      var prof = await sb.from('profiles').select('id, full_name').in('id', userIds);
      if (prof.data) prof.data.forEach(function (p) { nameById[p.id] = p.full_name || ''; });
      // emails están en auth.users; los resolvemos vía admin_list_users (cache si existe)
      try {
        var ulist = await sb.rpc('admin_list_users');
        if (ulist.data) ulist.data.forEach(function (u) { emailById[u.id] = u.email || ''; });
      } catch (_) {}
    }
    rows.forEach(function (r) {
      r._user_name = nameById[r.user_id] || 'Usuario eliminado';
      r._user_email = emailById[r.user_id] || '';
    });
    return rows;
  }

  var escapeHtml = Consultia.Utils.escapeHtml;

  function paint() {
    var search = ((document.getElementById('consultasSearch') || {}).value || '').toLowerCase().trim();
    var module = ((document.getElementById('consultasModuleFilter') || {}).value || 'all');

    var rows = cachedRows.filter(function (q) {
      if (module !== 'all' && q.module !== module) return false;
      if (search) {
        var hay = (q._user_name + ' ' + q._user_email + ' ' + (q.input || '') + ' ' + (q.type || '')).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });

    var totalCredits = rows.reduce(function (sum, q) { return sum + (q.cost || 0); }, 0);
    var creditsEl = document.getElementById('consultasCredits');
    var countEl = document.getElementById('consultasCount');
    if (creditsEl) creditsEl.textContent = totalCredits;
    if (countEl) countEl.textContent = rows.length;

    var body = document.getElementById('consultasTableBody');
    var empty = document.getElementById('consultasEmpty');
    var wrap = document.querySelector('#adminView-consultas .admin-table-wrap');
    if (!body) return;

    if (!rows.length) {
      body.innerHTML = '';
      if (empty) empty.hidden = false;
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (empty) empty.hidden = true;
    if (wrap) wrap.style.display = '';

    body.innerHTML = rows.slice(0, 200).map(function (q) {
      var statusChip;
      if (q.status === 'success')      statusChip = '<span class="chip chip-ok">Exitosa</span>';
      else if (q.status === 'error')   statusChip = '<span class="chip chip-off">Fallida</span>';
      else if (q.status === 'pending') statusChip = '<span class="chip">Pendiente</span>';
      else                             statusChip = '<span class="chip">' + escapeHtml(q.status || '—') + '</span>';

      var userCell = '<div class="cell-user"><span class="avatar">' + escapeHtml(A.userInitials(q._user_name)) + '</span>' +
        '<div class="user-info"><strong>' + escapeHtml(q._user_name) + '</strong><span>' + escapeHtml(q._user_email) + '</span></div></div>';

      return '<tr>' +
        '<td><span class="ad-hace" data-iso="' + escapeHtml(q.created_at || '') + '">' + haceCuanto(q.created_at) + '</span>' +
          '<small class="ad-sub">' + horaExacta(q.created_at) + '</small></td>' +
        '<td>' + userCell + '</td>' +
        '<td><span class="chip chip-accent">' + escapeHtml(MODULE_LABELS[q.module] || q.module) + '</span></td>' +
        '<td>' + escapeHtml(q.type || '—') + '</td>' +
        '<td style="font-family:monospace;font-size:12px">' + escapeHtml(q.input || '') + '</td>' +
        '<td><strong>' + (q.cost || 0) + '</strong> cr.</td>' +
        '<td>' + statusChip + '</td>' +
      '</tr>';
    }).join('');
  }

  function scheduleReload() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async function () {
      cachedRows = await loadConsultas();
      paint();
    }, 250);
  }

  /* EL SEGUNDERO
     Cada segundo reescribe el «hace cuánto» de las filas que ya están en
     pantalla. No pide nada a la base: las consultas nuevas llegan solas
     por Realtime. Y comprueba si cambió el día: a las 00:00 la pizarra
     se vacía sola, sin recargar la página. */
  function arrancarReloj() {
    if (relojTimer) return;
    relojTimer = setInterval(function () {
      if (diaCargado && diaCargado !== claveDelDia()) {
        cachedRows = [];
        paint();
        scheduleReload();
        return;
      }
      var celdas = document.querySelectorAll('#consultasTableBody .ad-hace');
      for (var i = 0; i < celdas.length; i++) {
        celdas[i].textContent = haceCuanto(celdas[i].dataset.iso);
      }
    }, 1000);
  }

  function startRealtime() {
    var sb = getSB();
    if (!sb || realtimeChannel) return;
    try {
      realtimeChannel = sb.channel('admin-consultas-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'consultas' }, scheduleReload)
        .subscribe();
    } catch (e) { console.warn('Consultas realtime no disponible:', e); }
  }

  A.renderConsultas = async function () {
    cachedRows = await loadConsultas();
    paint();
    startRealtime();
    arrancarReloj();
  };

  A.initConsultas = function () {
    var s = document.getElementById('consultasSearch');
    var m = document.getElementById('consultasModuleFilter');
    if (s) s.addEventListener('input', paint);
    if (m) m.addEventListener('change', paint);
  };
})();
