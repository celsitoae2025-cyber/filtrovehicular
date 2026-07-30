/* ============================================================
   ADMIN MERCADO PAGO — transacciones reales desde `payments_mp`
   con suscripción Realtime para verlas aparecer al instante
   cuando el webhook procesa un pago.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  function getSB() { return (window.Consultia && window.Consultia.supabase) || null; }

  var STATUS_CHIP = {
    approved:   { cls: 'chip-ok',  label: 'Aprobada' },
    pending:    { cls: 'chip',     label: 'Pendiente' },
    in_process: { cls: 'chip',     label: 'En proceso' },
    rejected:   { cls: 'chip-off', label: 'Rechazada' },
    refunded:   { cls: 'chip-off', label: 'Reembolsada' }
  };

  var cachedRows = [];
  var realtimeChannel = null;
  var refreshTimer = null;

  async function loadPayments() {
    var sb = getSB();
    if (!sb) return [];
    var res = await sb.from('payments_mp')
      .select('id, payment_id, user_id, user_email, plan_id, credits, amount, status, type, mp_payer_email, mp_payment_method, mp_date_approved, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (res.error) {
      console.error('payments_mp load error:', res.error);
      return [];
    }
    var rows = res.data || [];
    var ids = {};
    rows.forEach(function (r) { if (r.user_id) ids[r.user_id] = 1; });
    var nameById = {};
    var userIds = Object.keys(ids);
    if (userIds.length) {
      var prof = await sb.from('profiles').select('id, full_name').in('id', userIds);
      if (prof.data) prof.data.forEach(function (p) { nameById[p.id] = p.full_name || ''; });
    }
    rows.forEach(function (r) { r._user_name = nameById[r.user_id] || (r.user_email || 'Usuario'); });
    return rows;
  }

  var escapeHtml = Consultia.Utils.escapeHtml;

  function renderStats(rows) {
    var stats = { approved: 0, pending: 0, rejected: 0, refunded: 0, total: 0 };
    rows.forEach(function (t) {
      if (t.status === 'approved')   { stats.approved++;  stats.total += parseFloat(t.amount) || 0; }
      if (t.status === 'pending' || t.status === 'in_process') stats.pending++;
      if (t.status === 'rejected')   stats.rejected++;
      if (t.status === 'refunded')   stats.refunded++;
    });
    setText('mpStatApproved', stats.approved);
    setText('mpStatPending', stats.pending);
    setText('mpStatRejected', stats.rejected);
    setText('mpStatRefunded', stats.refunded);
    setText('mpStatTotal', A.fmtMoney(stats.total));
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderConnection() {
    // Indicador simple: si tenemos al menos una transacción, hay conexión real.
    var status = document.getElementById('mpConnStatus');
    if (!status) return;
    if (cachedRows.length > 0) {
      status.className = 'chip chip-ok';
      status.textContent = 'Conectado · Producción';
    } else {
      status.className = 'chip';
      status.textContent = 'Sin transacciones aún';
    }
  }

  function paint() {
    var search = ((document.getElementById('mpSearch') || {}).value || '').toLowerCase().trim();
    var statusFilter = ((document.getElementById('mpStatusFilter') || {}).value || 'all');

    renderStats(cachedRows);
    renderConnection();

    var rows = cachedRows.filter(function (t) {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (search) {
        var hay = ((t._user_name || '') + ' ' + (t.user_email || '') + ' ' + (t.payment_id || '')).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });

    var body = document.getElementById('mpTableBody');
    var empty = document.getElementById('mpEmpty');
    var wrap = document.querySelector('#adminView-mercadopago .admin-table-wrap');
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = '';
      if (empty) empty.hidden = false;
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (empty) empty.hidden = true;
    if (wrap) wrap.style.display = '';

    body.innerHTML = rows.map(function (t) {
      var chip = STATUS_CHIP[t.status] || { cls: 'chip', label: t.status };
      var userCell = '<div class="cell-user"><span class="avatar">' + escapeHtml(A.userInitials(t._user_name)) + '</span>' +
        '<div class="user-info"><strong>' + escapeHtml(t._user_name) + '</strong><span>' + escapeHtml(t.user_email || '') + '</span></div></div>';
      var method = t.mp_payment_method || '—';

      return '<tr>' +
        '<td>' + A.fmtDate(t.created_at) + '</td>' +
        '<td style="font-family:monospace;font-size:12px">' + escapeHtml(t.payment_id || '') + '</td>' +
        '<td>' + userCell + '</td>' +
        '<td><strong>' + A.fmtMoney(parseFloat(t.amount) || 0) + '</strong></td>' +
        '<td>' + escapeHtml(method) + '</td>' +
        '<td><span class="chip ' + chip.cls + '">' + escapeHtml(chip.label) + '</span></td>' +
        '<td><div class="cell-actions">' +
          '<button class="table-btn" data-mp-action="detail" data-id="' + escapeHtml(t.payment_id || '') + '">Detalle</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  function showDetail(paymentId) {
    var t = cachedRows.find(function (x) { return String(x.payment_id) === String(paymentId); });
    if (!t) return;
    if (window.Consultia.toast) Consultia.toast({
      type: 'info',
      title: 'MP ID ' + paymentId,
      message: (t._user_name || '') + ' · ' + A.fmtMoney(parseFloat(t.amount) || 0) + ' · ' + (t.mp_payment_method || '—')
    });
  }

  function scheduleReload() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async function () {
      cachedRows = await loadPayments();
      paint();
    }, 500);
  }

  function startRealtime() {
    var sb = getSB();
    if (!sb || realtimeChannel) return;
    try {
      realtimeChannel = sb.channel('admin-mp-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments_mp' }, scheduleReload)
        .subscribe();
    } catch (e) { console.warn('MP realtime no disponible:', e); }
  }

  A.renderMercadoPago = async function () {
    cachedRows = await loadPayments();
    paint();
    startRealtime();
  };

  A.initMercadoPago = function () {
    var s = document.getElementById('mpSearch');
    var st = document.getElementById('mpStatusFilter');
    if (s) s.addEventListener('input', paint);
    if (st) st.addEventListener('change', paint);
    var configBtn = document.getElementById('mpConfigBtn');
    if (configBtn) configBtn.addEventListener('click', function () {
      var nav = document.querySelector('[data-admin-view="settings"]');
      if (nav) nav.click();
    });
    var body = document.getElementById('mpTableBody');
    if (body) body.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-mp-action]');
      if (!btn) return;
      if (btn.dataset.mpAction === 'detail') showDetail(btn.dataset.id);
    });
  };
})();
