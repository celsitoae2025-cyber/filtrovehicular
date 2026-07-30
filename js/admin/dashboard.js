/* ============================================================
   ADMIN DASHBOARD — KPIs + módulos más usados + actividad reciente
   Lee directo de Supabase (profiles, consultas, payments_mp,
   transactions). Realtime: se suscribe a cambios y refresca debounced.
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

  function startOfMonthISO() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }

  function startOfDayISO() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  }

  // ---------- Carga de datos ----------
  async function fetchKpis() {
    var sb = getSB();
    if (!sb) return null;

    var monthStart = startOfMonthISO();
    var dayStart = startOfDayISO();

    var qUsers = sb.from('profiles').select('id', { count: 'exact', head: true });
    var qNewMonth = sb.from('profiles').select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart);
    var qConsultas = sb.from('consultas').select('id', { count: 'exact', head: true });
    // Ingresos del mes = pagos MP aprobados + ventas manuales (transactions.amount_pen)
    var qIngresosMes = sb.from('payments_mp')
      .select('amount')
      .eq('status', 'approved')
      .gte('created_at', monthStart);

    var qIngresosManual = sb.from('transactions')
      .select('amount_pen')
      .not('amount_pen', 'is', null)
      .gte('created_at', monthStart);

    // Activos hoy: usuarios con al menos una consulta hoy
    var qActivosHoy = sb.from('consultas')
      .select('user_id')
      .gte('created_at', dayStart);

    var [users, newMonth, consultas, ingresos, ingresosManual, activos] = await Promise.all([
      qUsers, qNewMonth, qConsultas, qIngresosMes, qIngresosManual, qActivosHoy
    ]);

    var ingresosTotal = 0;
    if (ingresos.data) ingresos.data.forEach(function (r) { ingresosTotal += parseFloat(r.amount) || 0; });
    if (ingresosManual.data) ingresosManual.data.forEach(function (r) { ingresosTotal += parseFloat(r.amount_pen) || 0; });

    var activosUnicos = 0;
    if (activos.data) {
      var seen = {};
      activos.data.forEach(function (r) { if (r.user_id && !seen[r.user_id]) { seen[r.user_id] = 1; activosUnicos++; } });
    }

    return {
      totalUsers: users.count || 0,
      newThisMonth: newMonth.count || 0,
      totalConsultas: consultas.count || 0,
      ingresosMes: ingresosTotal,
      activosHoy: activosUnicos
    };
  }

  // Top módulos: cuenta consultas agrupadas por module (últimas 1000 para no traer todo)
  async function fetchTopModules() {
    var sb = getSB();
    if (!sb) return [];
    var res = await sb.from('consultas').select('module').order('created_at', { ascending: false }).limit(1000);
    if (res.error || !res.data) return [];
    var counts = {};
    res.data.forEach(function (q) { counts[q.module] = (counts[q.module] || 0) + 1; });
    return Object.keys(counts).map(function (k) { return { key: k, count: counts[k] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 5);
  }

  // Actividad reciente: mezcla consultas + transactions (purchase, admin_adjust, refund)
  async function fetchRecentActivity() {
    var sb = getSB();
    if (!sb) return [];

    var qConsultas = sb.from('consultas')
      .select('id, user_id, module, type, cost, status, created_at')
      .order('created_at', { ascending: false })
      .limit(15);
    var qTrans = sb.from('transactions')
      .select('id, user_id, type, amount, description, created_at')
      .in('type', ['purchase', 'admin_adjust', 'subscription', 'refund', 'welcome'])
      .order('created_at', { ascending: false })
      .limit(15);

    var [c, t] = await Promise.all([qConsultas, qTrans]);

    // Necesitamos resolver user_id → nombre. Tomamos los ids únicos y consultamos profiles.
    var ids = {};
    (c.data || []).forEach(function (r) { ids[r.user_id] = 1; });
    (t.data || []).forEach(function (r) { ids[r.user_id] = 1; });
    var userIds = Object.keys(ids);
    var nameById = {};
    if (userIds.length) {
      var prof = await sb.from('profiles').select('id, full_name').in('id', userIds);
      if (prof.data) prof.data.forEach(function (p) { nameById[p.id] = p.full_name || ''; });
    }

    var events = [];
    (c.data || []).forEach(function (q) {
      var name = nameById[q.user_id] || 'Usuario';
      var costoTxt = q.cost > 0 ? (q.cost + ' cr') : 'gratis';
      var modLabel = MODULE_LABELS[q.module] || q.module;
      events.push({
        when: q.created_at,
        text: '<strong>' + escapeHtml(name) + '</strong> consultó <span>' + escapeHtml(modLabel) + ' · ' + escapeHtml(q.type || '') + ' (' + costoTxt + ')</span>'
      });
    });
    (t.data || []).forEach(function (r) {
      var name = nameById[r.user_id] || 'Usuario';
      var verb = '';
      if (r.type === 'purchase') verb = 'compró';
      else if (r.type === 'admin_adjust') verb = (r.amount > 0 ? 'recibió (admin)' : 'ajuste (admin)');
      else if (r.type === 'subscription') verb = 'activó suscripción';
      else if (r.type === 'refund') verb = 'reembolsado';
      else if (r.type === 'welcome') verb = 'recibió de bienvenida';
      events.push({
        when: r.created_at,
        text: '<strong>' + escapeHtml(name) + '</strong> ' + verb + ' <span>' +
          (r.amount >= 0 ? '+' : '') + r.amount + ' cr · ' + escapeHtml(r.description || '') + '</span>'
      });
    });

    events.sort(function (a, b) { return (b.when || '').localeCompare(a.when || ''); });
    return events.slice(0, 10);
  }

  var escapeHtml = Consultia.Utils.escapeHtml;

  // ---------- Render ----------
  function fmtMoney(n) {
    if (typeof A.fmtMoney === 'function') return A.fmtMoney(n);
    return 'S/ ' + (parseFloat(n) || 0).toFixed(2);
  }
  function relativeTime(iso) {
    if (typeof A.relativeTime === 'function') return A.relativeTime(iso);
    return iso || '';
  }
  function exactTime(iso) {
    if (typeof A.exactTime === 'function') return A.exactTime(iso);
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) + ' · ' +
           d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  async function render() {
    var sb = getSB();
    if (!sb) return;

    var [kpis, topModules, recent] = await Promise.all([
      fetchKpis(), fetchTopModules(), fetchRecentActivity()
    ]);

    if (kpis) {
      setText('kpiUsers', kpis.totalUsers);
      setText('kpiUsersTrend', '+' + kpis.newThisMonth + ' este mes');
      setText('kpiActive', kpis.activosHoy);
      setText('kpiRevenue', fmtMoney(kpis.ingresosMes));
      setText('kpiQueries', kpis.totalConsultas);
    }

    var topEl = document.getElementById('topModules');
    if (topEl) {
      var max = (topModules[0] && topModules[0].count) || 1;
      topEl.innerHTML = topModules.map(function (e) {
        var pct = Math.round((e.count / max) * 100);
        return '<div class="bar-row">' +
          '<div class="bar-row-head"><strong>' + (MODULE_LABELS[e.key] || e.key) + '</strong><span>' + e.count + ' consultas</span></div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '</div>';
      }).join('') || '<p style="color:var(--c-muted);font-size:13px">Sin datos todavía.</p>';
    }

    var actEl = document.getElementById('recentActivity');
    if (actEl) {
      actEl.innerHTML = recent.map(function (e) {
        var rel = relativeTime(e.when);
        var exact = exactTime(e.when);
        return '<li>' +
          '<div class="activity-dot"></div>' +
          '<div class="activity-text">' + e.text + '</div>' +
          '<span class="activity-time" title="' + escapeHtml(exact) + '">' +
            '<strong>' + rel + '</strong>' +
            (exact ? '<small>' + exact + '</small>' : '') +
          '</span>' +
        '</li>';
      }).join('') || '<li style="color:var(--c-muted);font-size:13px;border:none">Sin actividad aún.</li>';
    }
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // ---------- Realtime ----------
  var realtimeChannel = null;
  var refreshTimer = null;
  function scheduleRender() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(render, 800);
  }
  function startRealtime() {
    var sb = getSB();
    if (!sb || realtimeChannel) return;
    try {
      realtimeChannel = sb.channel('admin-dashboard-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleRender)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'consultas' }, scheduleRender)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, scheduleRender)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments_mp' }, scheduleRender)
        .subscribe();
    } catch (e) { console.warn('Dashboard realtime no disponible:', e); }
  }

  A.renderDashboard = function () {
    render();
    startRealtime();
  };
})();
