/* ============================================================
   ADMIN — INGRESOS DEL MES (detalle)
   Vista que se abre al hacer clic en el KPI "Ingresos (mes)"
   del dashboard. Lista TODAS las transacciones del mes:
     - payments_mp (status='approved')   â†’ Mercado Pago
     - transactions con amount_pen != null â†’ ventas manuales / suscripciones

   KPIs: total, MP, manual, suscripciones.
   Tabla: fecha+hora, usuario, origen, tipo, descripción, monto.
   Filtros: todos / MP / manual / subscription.
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  function getSB() {
    return (window.Consultia && window.Consultia.supabase) || null;
  }

  var allRows = [];   // filas combinadas y ordenadas por fecha desc
  var currentFilter = 'all';

  // ---------- Helpers ----------
  function startOfMonthISO() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }

  function fmtMoney(n) {
    n = Number(n) || 0;
    return 'S/ ' + n.toFixed(2);
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return d.toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return iso; }
  }

  var escapeHtml = Consultia.Utils.escapeHtml;

  // ---------- Carga ----------
  async function loadRevenue() {
    var sb = getSB();
    if (!sb) return [];
    var monthStart = startOfMonthISO();

    var qMP = sb.from('payments_mp')
      .select('id, user_id, amount, status, created_at, payment_id, plan_id')
      .eq('status', 'approved')
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false });

    var qManual = sb.from('transactions')
      .select('id, user_id, type, amount, amount_pen, payment_method, description, reference, created_at')
      .not('amount_pen', 'is', null)
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false });

    var qUsers = sb.rpc('admin_list_users');

    var [mp, manual, users] = await Promise.all([qMP, qManual, qUsers]);

    var usersMap = {};
    if (!users.error && Array.isArray(users.data)) {
      users.data.forEach(function (u) { usersMap[u.id] = u; });
    }

    var rows = [];

    if (!mp.error && mp.data) {
      mp.data.forEach(function (r) {
        var u = usersMap[r.user_id] || {};
        rows.push({
          source: 'mp',
          kind: r.plan_id ? 'subscription' : 'credits',
          created_at: r.created_at,
          email: u.email || '—',
          name: u.full_name || '',
          amount: parseFloat(r.amount) || 0,
          method: 'Mercado Pago',
          description: r.plan_id ? ('Plan ' + r.plan_id) : ('Pago MP #' + (r.payment_id || r.id)),
          ref: r.payment_id || r.id
        });
      });
    }

    if (!manual.error && manual.data) {
      manual.data.forEach(function (r) {
        var u = usersMap[r.user_id] || {};
        var kind = (r.description || '').toLowerCase().indexOf('suscrip') >= 0
          ? 'subscription' : 'credits';
        rows.push({
          source: 'manual',
          kind: kind,
          created_at: r.created_at,
          email: u.email || '—',
          name: u.full_name || '',
          amount: parseFloat(r.amount_pen) || 0,
          method: r.payment_method === 'whatsapp' ? 'WhatsApp/Yape'
                 : r.payment_method === 'manual'   ? 'Ajuste manual'
                 : (r.payment_method || 'Manual'),
          description: r.description || '—',
          ref: r.reference || ''
        });
      });
    }

    rows.sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return rows;
  }

  // ---------- Render ----------
  function renderKpis(rows) {
    var total = 0, mpSum = 0, manualSum = 0, subsSum = 0;
    var mpCnt = 0, manualCnt = 0, subsCnt = 0;
    rows.forEach(function (r) {
      total += r.amount;
      if (r.source === 'mp')     { mpSum += r.amount;     mpCnt++; }
      if (r.source === 'manual') { manualSum += r.amount; manualCnt++; }
      if (r.kind === 'subscription') { subsSum += r.amount; subsCnt++; }
    });

    function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
    set('revKpiTotal',       fmtMoney(total));
    set('revKpiCount',       rows.length + (rows.length === 1 ? ' transacción' : ' transacciones'));
    set('revKpiMP',          fmtMoney(mpSum));
    set('revKpiMPCount',     mpCnt + (mpCnt === 1 ? ' pago aprobado' : ' pagos aprobados'));
    set('revKpiManual',      fmtMoney(manualSum));
    set('revKpiManualCount', manualCnt + (manualCnt === 1 ? ' venta WhatsApp/admin' : ' ventas WhatsApp/admin'));
    set('revKpiSubs',        fmtMoney(subsSum));
    set('revKpiSubsCount',   subsCnt + (subsCnt === 1 ? ' plan activado' : ' planes activados'));
  }

  function rowMatchesFilter(r) {
    if (currentFilter === 'all')          return true;
    if (currentFilter === 'mp')           return r.source === 'mp';
    if (currentFilter === 'manual')       return r.source === 'manual';
    if (currentFilter === 'subscription') return r.kind === 'subscription';
    return true;
  }

  function renderTable() {
    var tbody = document.getElementById('revTableBody');
    if (!tbody) return;
    var filtered = allRows.filter(rowMatchesFilter);

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Sin ingresos para el filtro seleccionado.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (r) {
      var sourceBadge = r.source === 'mp'
        ? '<span class="admin-badge" style="background:#f5f5f5;color:#141d1c;border-color:#8fc72e">Mercado Pago</span>'
        : '<span class="admin-badge" style="background:#8fc72e;color:#141d1c;border-color:#8fc72e">' + escapeHtml(r.method) + '</span>';
      var kindLabel = r.kind === 'subscription' ? 'Suscripción' : 'Créditos';
      var userCell = '<strong>' + escapeHtml(r.email) + '</strong>' +
                     (r.name ? '<br><small style="color:#5A6B6A">' + escapeHtml(r.name) + '</small>' : '');
      return (
        '<tr>' +
          '<td>' + fmtDateTime(r.created_at) + '</td>' +
          '<td>' + userCell + '</td>' +
          '<td>' + sourceBadge + '</td>' +
          '<td>' + kindLabel + '</td>' +
          '<td>' + escapeHtml(r.description) + '</td>' +
          '<td style="text-align:right;font-weight:600">' + fmtMoney(r.amount) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  // ---------- Public ----------
  async function renderRevenue() {
    var tbody = document.getElementById('revTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Cargando…</td></tr>';
    try {
      allRows = await loadRevenue();
    } catch (err) {
      console.error('[revenue]', err);
      allRows = [];
    }
    renderKpis(allRows);
    renderTable();
  }

  function initRevenue() {
    var filter = document.getElementById('revFilter');
    if (filter) {
      filter.addEventListener('change', function () {
        currentFilter = filter.value;
        renderTable();
      });
    }
    var refresh = document.getElementById('revRefresh');
    if (refresh) {
      refresh.addEventListener('click', function () { renderRevenue(); });
    }
  }

  A.initRevenue   = initRevenue;
  A.renderRevenue = renderRevenue;
})();
