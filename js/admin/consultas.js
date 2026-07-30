/* ============================================================
   ADMIN CONSULTAS — historial global de consultas (Supabase + Realtime)
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

  var cachedRows = [];      // últimas N consultas con datos de usuario embebidos
  var realtimeChannel = null;
  var refreshTimer = null;

  async function loadConsultas() {
    var sb = getSB();
    if (!sb) return [];
    // Traemos las últimas 500 consultas, ordenadas DESC.
    var res = await sb.from('consultas')
      .select('id, user_id, module, type, input, cost, status, created_at')
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
        '<td>' + A.fmtDate(q.created_at) + '</td>' +
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
    }, 600);
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
  };

  A.initConsultas = function () {
    var s = document.getElementById('consultasSearch');
    var m = document.getElementById('consultasModuleFilter');
    if (s) s.addEventListener('input', paint);
    if (m) m.addEventListener('change', paint);
  };
})();
