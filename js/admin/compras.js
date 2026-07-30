/* ============================================================
   ADMIN COMPRAS — todas las compras de créditos hechas por usuarios.
   Combina:
     - payments_mp (pagos por Mercado Pago)
     - transactions con type='admin_adjust' y amount > 0 (recargas manuales)
   Realtime: se actualiza al instante.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  function getSB() { return (window.Consultia && window.Consultia.supabase) || null; }

  var METHOD_LABELS = {
    mercadopago: 'Mercado Pago',
    whatsapp: 'WhatsApp (Yape/Plin)',
    manual: 'Ajuste manual',
    yape: 'Yape', plin: 'Plin', visa: 'Visa/Mastercard', transferencia: 'Transferencia'
  };

  var cachedRows = [];
  var realtimeChannel = null;
  var refreshTimer = null;

  async function loadCompras() {
    var sb = getSB();
    if (!sb) return [];

    var qMp = sb.from('payments_mp')
      .select('id, payment_id, user_id, user_email, plan_id, credits, amount, status, type, mp_payment_method, created_at')
      .order('created_at', { ascending: false })
      .limit(300);

    var qManual = sb.from('transactions')
      .select('id, user_id, type, amount, description, payment_method, reference, created_at')
      .eq('type', 'admin_adjust')
      .gt('amount', 0)
      .order('created_at', { ascending: false })
      .limit(200);

    var [mp, manual] = await Promise.all([qMp, qManual]);

    var rows = [];

    (mp.data || []).forEach(function (p) {
      rows.push({
        kind: 'mp',
        id: 'mp-' + p.id,
        created_at: p.created_at,
        user_id: p.user_id,
        user_email: p.user_email,
        credits: p.credits,
        amount: parseFloat(p.amount) || 0,
        method: 'mercadopago',
        method_detail: METHOD_LABELS.mercadopago + (p.mp_payment_method ? ' · ' + p.mp_payment_method : ''),
        status: p.status === 'approved' ? 'completed' : (p.status || 'pending'),
        plan_id: p.plan_id
      });
    });

    (manual.data || []).forEach(function (t) {
      rows.push({
        kind: 'manual',
        id: 'tx-' + t.id,
        created_at: t.created_at,
        user_id: t.user_id,
        user_email: '',
        credits: t.amount,
        amount: 0,
        method: t.payment_method || 'manual',
        method_detail: METHOD_LABELS[t.payment_method] || 'Manual',
        status: 'completed',
        plan_id: t.description || ''
      });
    });

    // Resolver nombres de los user_id que no tengan email
    var ids = {};
    rows.forEach(function (r) { if (r.user_id) ids[r.user_id] = 1; });
    var nameById = {}, emailById = {};
    var userIds = Object.keys(ids);
    if (userIds.length) {
      var prof = await sb.from('profiles').select('id, full_name').in('id', userIds);
      if (prof.data) prof.data.forEach(function (p) { nameById[p.id] = p.full_name || ''; });
      try {
        var ulist = await sb.rpc('admin_list_users');
        if (ulist.data) ulist.data.forEach(function (u) { emailById[u.id] = u.email || ''; });
      } catch (_) {}
    }
    rows.forEach(function (r) {
      r._user_name = nameById[r.user_id] || 'Usuario';
      r._user_email = r.user_email || emailById[r.user_id] || '';
    });

    rows.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
    return rows;
  }

  var escapeHtml = Consultia.Utils.escapeHtml;

  function paint() {
    var search = ((document.getElementById('comprasSearch') || {}).value || '').toLowerCase().trim();
    var method = ((document.getElementById('comprasMethodFilter') || {}).value || 'all');

    var rows = cachedRows.filter(function (c) {
      if (method !== 'all' && c.method !== method) return false;
      if (search) {
        var hay = (c._user_name + ' ' + c._user_email + ' ' + (c.plan_id || '')).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });

    var totalMonto = rows.filter(function (c) { return c.status === 'completed'; })
                         .reduce(function (sum, c) { return sum + (c.amount || 0); }, 0);
    var totalEl = document.getElementById('comprasTotalMonto');
    var countEl = document.getElementById('comprasTotalCount');
    if (totalEl) totalEl.textContent = A.fmtMoney(totalMonto);
    if (countEl) countEl.textContent = rows.length;

    var body = document.getElementById('comprasTableBody');
    var empty = document.getElementById('comprasEmpty');
    var wrap = document.querySelector('#adminView-compras .admin-table-wrap');
    if (!body) return;

    if (!rows.length) {
      body.innerHTML = '';
      if (empty) empty.hidden = false;
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (empty) empty.hidden = true;
    if (wrap) wrap.style.display = '';

    body.innerHTML = rows.map(function (c) {
      var statusChip;
      if (c.status === 'completed') statusChip = '<span class="chip chip-ok">Completada</span>';
      else if (c.status === 'refunded') statusChip = '<span class="chip chip-off">Reembolsada</span>';
      else if (c.status === 'rejected') statusChip = '<span class="chip chip-off">Rechazada</span>';
      else statusChip = '<span class="chip">' + escapeHtml(c.status) + '</span>';

      var userCell = '<div class="cell-user"><span class="avatar">' + escapeHtml(A.userInitials(c._user_name)) + '</span>' +
        '<div class="user-info"><strong>' + escapeHtml(c._user_name) + '</strong><span>' + escapeHtml(c._user_email) + '</span></div></div>';

      var monto = c.amount > 0 ? A.fmtMoney(c.amount) : '—';

      return '<tr>' +
        '<td>' + A.fmtDate(c.created_at) + '</td>' +
        '<td>' + userCell + '</td>' +
        '<td>' + (c.credits || 0) + ' créditos</td>' +
        '<td><strong>' + monto + '</strong></td>' +
        '<td><span class="chip">' + escapeHtml(METHOD_LABELS[c.method] || c.method) + '</span></td>' +
        '<td>' + statusChip + '</td>' +
      '</tr>';
    }).join('');
  }

  function scheduleReload() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async function () {
      cachedRows = await loadCompras();
      paint();
    }, 600);
  }

  function startRealtime() {
    var sb = getSB();
    if (!sb || realtimeChannel) return;
    try {
      realtimeChannel = sb.channel('admin-compras-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments_mp' }, scheduleReload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, scheduleReload)
        .subscribe();
    } catch (e) { console.warn('Compras realtime no disponible:', e); }
  }

  A.renderCompras = async function () {
    cachedRows = await loadCompras();
    paint();
    startRealtime();
  };

  A.initCompras = function () {
    var s = document.getElementById('comprasSearch');
    var m = document.getElementById('comprasMethodFilter');
    if (s) s.addEventListener('input', paint);
    if (m) m.addEventListener('change', paint);
  };
})();
