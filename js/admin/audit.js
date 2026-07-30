/* ============================================================
   ADMIN AUDIT — log de acciones administrativas, leído de la tabla
   `admin_audit` en Supabase (global, persistente, multi-admin).
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  function getSB() { return (window.Consultia && window.Consultia.supabase) || null; }

  var cachedRows = [];
  var realtimeChannel = null;
  var refreshTimer = null;

  function actionPrefix(action) {
    var dot = (action || '').indexOf('.');
    return dot > -1 ? action.slice(0, dot) : (action || '');
  }

  var escapeHtml = Consultia.Utils.escapeHtml;

  async function loadAudit() {
    var sb = getSB();
    if (!sb) return [];
    var res = await sb.from('admin_audit')
      .select('id, admin_id, admin_name, admin_email, action, target, meta, ip, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (res.error) {
      console.error('admin_audit load error:', res.error);
      return [];
    }
    return res.data || [];
  }

  function paint() {
    var search = ((document.getElementById('auditSearch') || {}).value || '').toLowerCase().trim();
    var cat = ((document.getElementById('auditActionFilter') || {}).value || 'all');

    var rows = cachedRows.filter(function (l) {
      var prefix = actionPrefix(l.action);
      if (cat !== 'all' && cat !== prefix) return false;
      if (search) {
        var hay = ((l.action || '') + ' ' + (l.target || '') + ' ' + (l.meta || '') + ' ' + (l.admin_name || '') + ' ' + (l.admin_email || '')).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });

    var body = document.getElementById('auditTableBody');
    var empty = document.getElementById('auditEmpty');
    var wrap = document.querySelector('#adminView-audit .admin-table-wrap');
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = '';
      if (empty) empty.hidden = false;
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (empty) empty.hidden = true;
    if (wrap) wrap.style.display = '';

    body.innerHTML = rows.slice(0, 200).map(function (l) {
      return '<tr>' +
        '<td>' + A.fmtDate(l.created_at) + '</td>' +
        '<td>' + escapeHtml(l.admin_name || l.admin_email || 'Sistema') + '</td>' +
        '<td style="font-family:monospace;font-size:12px">' + escapeHtml(l.action) + '</td>' +
        '<td>' + escapeHtml(l.target || '—') + '</td>' +
        '<td style="color:var(--c-muted);font-size:12px">' + escapeHtml(l.meta || '—') + '</td>' +
        '<td style="font-family:monospace;font-size:11.5px;color:var(--c-muted)">' + escapeHtml(l.ip || '—') + '</td>' +
      '</tr>';
    }).join('');
  }

  function scheduleReload() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async function () {
      cachedRows = await loadAudit();
      paint();
    }, 500);
  }

  function startRealtime() {
    var sb = getSB();
    if (!sb || realtimeChannel) return;
    try {
      realtimeChannel = sb.channel('admin-audit-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_audit' }, scheduleReload)
        .subscribe();
    } catch (e) { console.warn('Audit realtime no disponible:', e); }
  }

  A.renderAudit = async function () {
    cachedRows = await loadAudit();
    paint();
    startRealtime();
  };

  A.initAudit = function () {
    var s = document.getElementById('auditSearch');
    var f = document.getElementById('auditActionFilter');
    if (s) s.addEventListener('input', paint);
    if (f) f.addEventListener('change', paint);
    var exp = document.getElementById('auditExport');
    if (exp) exp.addEventListener('click', function () {
      A.exportCSV('auditoria.csv',
        ['Fecha', 'Admin', 'Acción', 'Target', 'Detalle', 'IP'],
        cachedRows.map(function (l) {
          return [l.created_at, l.admin_name || l.admin_email || '', l.action, l.target, l.meta, l.ip];
        })
      );
      if (window.Consultia.toast) Consultia.toast({ type:'success', title:'Exportado', message:'Log descargado.' });
    });
  };
})();
