/* ============================================================
   DASHBOARD STATS — calcula y pinta el % de consumo de créditos
   y los conteos de consultas (Hoy / Este mes / Este año) en el
   dashboard, a partir de la tabla `transactions` de Supabase.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  function getSB() { return (window.Consultia && window.Consultia.supabase) || null; }

  // Bug fix #3: cache de promesa para evitar triple llamada a Supabase
  // cuando auth-ui, right-panel y main.js disparan loadStats al mismo tiempo.
  var _statsPromise = null;
  var _statsUserId  = null;
  var _statsTs      = 0;
  var STATS_TTL_MS  = 20000; // 20 s de cache

  function invalidateStatsCache() {
    _statsPromise = null;
    _statsUserId  = null;
    _statsTs      = 0;
  }
  Consultia.invalidateStatsCache = invalidateStatsCache;

  async function loadStats() {
    var sb = getSB();
    if (!sb) return null;
    var user = await Consultia.Auth.getUser();
    if (!user) return null;

    var now = Date.now();
    // Reutiliza la promesa en vuelo si es del mismo usuario y está dentro del TTL
    if (_statsPromise && _statsUserId === user.id && (now - _statsTs) < STATS_TTL_MS) {
      return _statsPromise;
    }
    _statsUserId = user.id;
    _statsTs     = now;
    _statsPromise = _fetchStats(sb, user);
    return _statsPromise;
  }

  async function _fetchStats(sb, user) {

    // 1) Transacciones — fuente autoritativa para consumo total Y para
    //    contar consultas por período (cualquier amount < 0 cuenta como consulta).
    //    Incluimos `reference` para poder mapear consultas viejas (creadas con
    //    admin_adjust_credits que sí guardó la consulta_id en `reference`) a
    //    su categoría vía consultas_catalog.
    var txRes = await sb
      .from('transactions')
      .select('amount, type, created_at, reference')
      .eq('user_id', user.id)
      .limit(5000);
    if (txRes.error) {
      console.error('[dashboard-stats] error cargando transactions:', txRes.error);
    }

    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    var yearStart  = new Date(now.getFullYear(), 0, 1).getTime();

    var totalReceived = 0;
    var totalConsumed = 0;
    var consultasTotal = 0;
    var consultasHoy = 0, consultasMes = 0, consultasAnio = 0;
    var txReferences = []; // ids de consulta de tx viejas, para resolver categoría

    (txRes.data || []).forEach(function (t) {
      var a = parseFloat(t.amount) || 0;
      var ts = t.created_at ? new Date(t.created_at).getTime() : 0;
      var type = t.type;

      if (a > 0) {
        // Bug fix #2: los reembolsos tienen amount > 0 y deben restar del consumido,
        // no sumarse a totalReceived. El return temprano anterior los descartaba.
        if (type === 'refund') {
          totalConsumed -= a;
          if (totalConsumed < 0) totalConsumed = 0;
        } else {
          totalReceived += a;
        }
        return;
      }
      // Solo los consumos reales del usuario (consultas) cuentan en el ring
      // y en los conteos de período. Los ajustes admin negativos
      // (admin_adjust al restar/vaciar) NO son consumos del usuario.
      var isUserConsumption = (a < 0) && (type === 'consumption' || type === 'consultation');
      if (isUserConsumption) {
        totalConsumed += Math.abs(a);
        if (t.reference) txReferences.push(t.reference);
      }
    });

    // 2) Saldo actual del perfil
    var profRes = await sb
      .from('profiles')
      .select('credits_balance')
      .eq('id', user.id)
      .single();
    var saldoActual = (profRes && profRes.data) ? (parseFloat(profRes.data.credits_balance) || 0) : 0;

    // Total histórico = saldo actual + lo ya consumido
    var totalHistorico = saldoActual + totalConsumed;

    var percentRaw = 0;
    var percent = 0;
    if (totalHistorico > 0) {
      percentRaw = (totalConsumed / totalHistorico) * 100;
      if (percentRaw > 100) percentRaw = 100;
      percent = Math.round(percentRaw);
    }

    // 3) Desglose por módulo — combinamos:
    //    a) consultas viejas: tx.reference → consultas_catalog.id → categoria
    //    b) consultas nuevas: tabla `consultas`.module
    var perCategoria = {};

    if (txReferences.length > 0) {
      var uniqRefs = Array.from(new Set(txReferences));
      var catRes = await sb
        .from('consultas_catalog')
        .select('id, categoria')
        .in('id', uniqRefs);
      if (!catRes.error && catRes.data) {
        var refToCat = Object.create(null);
        catRes.data.forEach(function (c) { refToCat[c.id] = c.categoria; });
        // Recorrer transacciones para contar por categoría
        (txRes.data || []).forEach(function (t) {
          var a = parseFloat(t.amount) || 0;
          if (a < 0 && t.reference) {
            var cat = refToCat[t.reference];
            if (cat) perCategoria[cat] = (perCategoria[cat] || 0) + 1;
          }
        });
      }
    }

    var cRes = await sb
      .from('consultas')
      .select('module, created_at, status')
      .eq('user_id', user.id)
      .limit(5000);
    (cRes.data || []).forEach(function (c) {
      if (c.status === 'refunded') return;
      if (c.module) perCategoria[c.module] = (perCategoria[c.module] || 0) + 1;
      // Conteos desde consultas (más fiable que transactions para suscriptores)
      var ts = c.created_at ? new Date(c.created_at).getTime() : 0;
      consultasTotal++;
      if (ts >= todayStart) consultasHoy++;
      if (ts >= monthStart) consultasMes++;
      if (ts >= yearStart)  consultasAnio++;
    });

    // Agrupar consultas por mes (últimos 6 meses) para gráfica real
    var perMes = {};
    var meses6 = [];
    for (var mi = 5; mi >= 0; mi--) {
      var md = new Date(now.getFullYear(), now.getMonth() - mi, 1);
      var key = md.getFullYear() + '-' + String(md.getMonth() + 1).padStart(2, '0');
      meses6.push({ key: key, label: md.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '') });
      perMes[key] = 0;
    }
    (cRes.data || []).forEach(function (c) {
      if (c.status === 'refunded' || !c.created_at) return;
      var d = new Date(c.created_at);
      var k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (k in perMes) perMes[k]++;
    });

    return {
      totalReceived: totalReceived,
      totalConsumed: totalConsumed,
      percent: percent,
      percentRaw: percentRaw,
      consultasTotal: consultasTotal,
      consultasHoy: consultasHoy,
      consultasMes: consultasMes,
      consultasAnio: consultasAnio,
      perCategoria: perCategoria,
      perMes: perMes,
      meses6: meses6,
    };
  }

  async function render() {
    var stats = await loadStats();
    if (!stats) return;

    // Gauge del dashboard (dentro de .credits-ring, para no confundir con
    // el gauge del panel derecho que tiene su propio selector por ID)
    var svg = document.querySelector('.credits-ring .gauge-svg');
    if (svg) {
      svg.dataset.percent = String(stats.percent);
      if (window.Consultia && Consultia.renderGauge) {
        Consultia.renderGauge(svg);
      }
    }

    // Texto del centro del ring ("X%")
    // Si el % es < 1, mostrar con 2 decimales para que se note el avance
    // (ej. 0.06%). Si es >= 1 y < 10, mostrar con 1 decimal. Si >= 10, entero.
    var pr = (typeof stats.percentRaw === 'number') ? stats.percentRaw : stats.percent;
    var pretty;
    if (pr === 0) pretty = '0';
    else if (pr < 1) pretty = pr.toFixed(2).replace(/\.?0+$/, '');
    else if (pr < 10) pretty = pr.toFixed(1).replace(/\.0$/, '');
    else pretty = String(Math.round(pr));
    var ringText = document.querySelector('.credits-ring-text strong');
    if (ringText) ringText.textContent = pretty + '%';

    // Stats periodo (Hoy / Este mes / Este año)
    var cards = document.querySelectorAll('.period-card strong');
    if (cards[0]) cards[0].textContent = String(stats.consultasHoy);
    if (cards[1]) cards[1].textContent = String(stats.consultasMes);
    if (cards[2]) cards[2].textContent = String(stats.consultasAnio);

    // Tarjeta del plan — segunda columna "Consultas realizadas"
    var planStats = document.querySelectorAll('.plan-stats .plan-stat strong');
    if (planStats[1]) planStats[1].textContent = String(stats.consultasTotal);

    // Consumo por módulo — actualiza cada fila que tenga data-categoria
    var per = stats.perCategoria || {};
    var maxCount = 1;
    Object.keys(per).forEach(function (k) { if (per[k] > maxCount) maxCount = per[k]; });
    document.querySelectorAll('.module-row').forEach(function (row) {
      var cat = row.dataset.categoria;
      if (!cat) return;
      var count = per[cat] || 0;
      var countEl = row.querySelector('.module-count');
      var barEl = row.querySelector('.module-bar > span');
      if (countEl) countEl.textContent = String(count);
      if (barEl) barEl.style.width = (count / maxCount * 100) + '%';
    });

    // Gráfica real de barras (reemplaza SVG decorativo)
    renderRealChart(stats);

    // Resumen diario (banner)
    renderDashSummary(stats);
  }

  function renderRealChart(stats) {
    var chartWrap = document.querySelector('.stats-chart');
    if (!chartWrap || !stats.meses6) return;
    var perMes = stats.perMes || {};
    var maxVal = 1;
    stats.meses6.forEach(function (m) { if ((perMes[m.key] || 0) > maxVal) maxVal = perMes[m.key]; });

    var html = '<div class="chart-bar-container">';
    stats.meses6.forEach(function (m) {
      var val = perMes[m.key] || 0;
      var h = val > 0 ? Math.max(4, Math.round((val / maxVal) * 100)) : 2;
      html += '<div class="chart-bar-col">' +
        '<span class="chart-bar-value">' + val + '</span>' +
        '<div class="chart-bar" style="height:' + h + 'px"></div>' +
        '<span class="chart-bar-label">' + m.label + '</span>' +
      '</div>';
    });
    html += '</div>';
    chartWrap.innerHTML = html;
  }

  function renderDashSummary(stats) {
    var el = document.getElementById('dashSummary');
    if (!el) return;
    var qEl = document.getElementById('ds-queries');
    var cEl = document.getElementById('ds-credits');
    if (qEl) qEl.textContent = String(stats.consultasHoy);
    if (cEl) {
      // Leer saldo actual del plan-card o del propio perfil
      var creditEl = document.querySelector('.plan-stats .plan-stat strong');
      var credits = creditEl ? creditEl.textContent : '0';
      // Si ya tenemos el valor directo, usarlo
      var profCredits = document.getElementById('rp-credits');
      if (profCredits && profCredits.textContent !== '—') credits = profCredits.textContent;
      cEl.textContent = credits;
    }
    // Días de vencimiento — solo mostrar si hay fecha real de expiración
    var sub = Consultia.Subscription;
    var daysItem = document.getElementById('ds-plan-item');
    var daysEl = document.getElementById('ds-days');
    var hasRealExpiry = sub && sub.expiresAt && sub.expiresAt() && !isNaN(sub.expiresAt().getTime());
    if (hasRealExpiry && sub.isActiveSync && sub.isActiveSync() && sub.daysLeft) {
      var d = sub.daysLeft();
      if (d > 0) {
        if (daysEl) daysEl.textContent = String(d);
        if (daysItem) daysItem.hidden = false;
      } else {
        if (daysItem) daysItem.hidden = true;
      }
    } else {
      if (daysItem) daysItem.hidden = true;
    }
    el.hidden = false;
  }

  // Exponer loadStats para que right-panel pueda usarlo también
  Consultia.loadDashboardStats = loadStats;
  Consultia.renderDashboardStats = render;
})();
