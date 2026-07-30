/* ============================================================
   MY TRANSACTIONS — listados del cliente
   - view-compras  → amount > 0 (recargas recibidas)
   - view-historial → amount < 0 (créditos consumidos en consultas)
   Lee de la tabla `transactions` de Supabase vía RLS por user_id.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  function getSB() {
    return (window.Consultia && window.Consultia.supabase) || null;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  function methodLabel(m) {
    if (m === 'whatsapp')    return 'WhatsApp (Yape/Plin)';
    if (m === 'mercadopago') return 'Mercado Pago';
    if (m === 'manual')      return 'Ajuste manual';
    return m || '';
  }

  var escapeHtml = Consultia.Utils.escapeHtml;

  async function loadTransactions() {
    var sb = getSB();
    if (!sb) return [];
    var user = await Consultia.Auth.getUser();
    if (!user) return [];
    var res = await sb
      .from('transactions')
      .select('id, amount, type, description, payment_method, reference, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (res.error) {
      console.error('[my-transactions] error:', res.error);
      return [];
    }
    return res.data || [];
  }

  // Mapeo de módulos a nombres legibles en español
  var MODULE_LABELS = {
    'reniec': 'RENIEC', 'vehiculos': 'VEHÍCULOS', 'sunarp': 'SUNARP',
    'sunat': 'SUNAT', 'financiero': 'FINANCIERO', 'estudios': 'ESTUDIOS',
    'certificados': 'CERTIFICADOS', 'familiares': 'FAMILIA', 'familia': 'FAMILIA',
    'migraciones': 'MIGRACIONES', 'laboral': 'LABORAL', 'telefonia': 'TELEFONÍA',
    'telefonos': 'TELEFONÍA', 'delitos': 'DELITOS', 'actas': 'ACTAS',
    'mtc': 'MTC', 'seeker': 'SEEKER', 'vip': 'VIP',
    'facial': 'FACIAL', 'filter': 'FILTRAR', 'extras': 'EXTRAS',
    'premium': 'PREMIUM', 'general': 'GENERAL',
  };

  var TIPO_LABELS = {
    'dni': 'DNI', 'placa': 'PLACA', 'telefono': 'TELÉFONO',
    'ruc': 'RUC', 'texto': 'BÚSQUEDA', 'foto': 'RECONOCIMIENTO FACIAL',
  };


  function parseDescription(desc) {
    // Formato esperado: "modulo / tipo_dato" o solo "modulo"
    if (!desc) return { module: 'CONSULTA', tipo: '' };
    var parts = desc.split(/\s*\/\s*/);
    var mod = (MODULE_LABELS[parts[0].trim().toLowerCase()] || parts[0].trim().toUpperCase());
    var tipo = parts[1] ? (TIPO_LABELS[parts[1].trim().toLowerCase()] || parts[1].trim().toUpperCase()) : '';
    return { module: mod, tipo: tipo };
  }

  function renderList(container, empty, items, kind) {
    if (!container || !empty) return;
    if (!items.length) {
      container.hidden = true;
      container.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    container.hidden = false;

    container.innerHTML = items.map(function (t) {
      var isPositive = t.amount > 0;
      var amountCls  = isPositive ? 'tx-amount-pos' : 'tx-amount-neg';
      var sign = isPositive ? '+' : '';
      var title, sub, badge = '';

      if (kind === 'compras') {
        if (t.type === 'subscription') title = 'SUSCRIPCIÓN DE PLAN';
        else                            title = 'RECARGA DE CRÉDITOS';
        sub = methodLabel(t.payment_method) + (t.description ? ' · ' + t.description : '');
      } else {
        var parsed = parseDescription(t.description);
        title = parsed.module;
        sub   = parsed.tipo;
      }

      return '<li class="tx-row">' +
        '<div class="tx-meta">' +
          '<span class="tx-title">' + escapeHtml(title) + (sub ? ' <span class="tx-tipo">· ' + escapeHtml(sub) + '</span>' : '') + '</span>' +
          '<span class="tx-date">' + escapeHtml(fmtDate(t.created_at)) + '</span>' +
        '</div>' +
        '<span class="tx-amount ' + amountCls + '">' + sign + Math.abs(t.amount) + ' CRÉDITOS</span>' +
      '</li>';
    }).join('');
  }

  // Tipos que SÍ son compras pagadas por el usuario.
  // Excluye welcome (5 créditos gratis), admin_adjust (regalo del admin),
  // refund (reembolso), consultation (gasto), etc.
  var COMPRA_TYPES = ['purchase', 'subscription'];

  Consultia.renderCompras = async function () {
    var items = await loadTransactions();
    var compras = items.filter(function (t) {
      return t.amount > 0 && COMPRA_TYPES.indexOf(t.type) !== -1;
    });
    renderList(
      document.getElementById('comprasList'),
      document.getElementById('comprasEmpty'),
      compras,
      'compras'
    );
  };

  Consultia.renderHistorial = async function () {
    var items = await loadTransactions();
    var consumos = items.filter(function (t) { return t.amount < 0; });
    renderList(
      document.getElementById('historialList'),
      document.getElementById('historialEmpty'),
      consumos,
      'historial'
    );
  };
})();
