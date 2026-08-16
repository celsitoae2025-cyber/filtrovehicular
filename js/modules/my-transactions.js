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

  // ── Descarga del historial en PDF ──────────────────────────
  // Se guarda lo último que se pintó para no volver a pedirlo a
  // Supabase al pulsar el botón: el PDF tiene que ser exactamente lo
  // que el cliente está viendo, no una consulta nueva que podría traer
  // una fila de más si acaba de gastar créditos en otra pestaña.
  var ultimosConsumos = [];

  function filasParaPdf(items) {
    return items.map(function (t, i) {
      var parsed = parseDescription(t.description);
      return {
        n: i + 1,
        fecha: fmtDate(t.created_at).replace(' · ', '  '),
        modulo: parsed.module,
        tipo: parsed.tipo || '—',
        creditos: t.amount
      };
    });
  }

  // Fecha corta para el resumen. Las transacciones llegan de más nueva
  // a más vieja, así que el periodo va de la última a la primera.
  function fechaCorta(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  async function descargarHistorialPdf(btn) {
    var gen = Consultia.ReportGenerator;
    if (!gen || !gen.generateHistorial) return;
    if (!ultimosConsumos.length) return;

    // Solo se deshabilita mientras trabaja. No se le toca el contenido:
    // el botón lleva un icono dentro y escribirle texto lo borraría.
    btn.disabled = true;

    try {
      var user = await Consultia.Auth.getUser();
      // El nombre es un adorno de la portada: si el perfil falla, el
      // informe sale igual con el correo. Por eso va en su propio
      // try/catch y no tumba la descarga.
      var perfil = null;
      try {
        if (Consultia.Auth.getProfile) perfil = await Consultia.Auth.getProfile(user);
      } catch (e) { /* sin nombre, con correo basta */ }
      var res = gen.generateHistorial(filasParaPdf(ultimosConsumos), {
        nombre: (perfil && perfil.full_name) || '',
        email: (user && user.email) || '',
        // El más viejo es el último del array, el más nuevo el primero.
        desde: fechaCorta(ultimosConsumos[ultimosConsumos.length - 1].created_at),
        hasta: fechaCorta(ultimosConsumos[0].created_at)
      });
      if (!res) {
        if (Consultia.toast) Consultia.toast({
          type: 'error', title: 'No se pudo generar', message: 'Inténtalo de nuevo en un momento.'
        });
        return;
      }
      gen.download(res);
      // El blob queda en memoria hasta que se suelta. Sin esto, cada
      // descarga deja un PDF entero retenido en la pestaña.
      setTimeout(function () { URL.revokeObjectURL(res.blobUrl); }, 4000);
    } catch (e) {
      console.error('[my-transactions] PDF:', e);
      if (Consultia.toast) Consultia.toast({
        type: 'error', title: 'No se pudo generar', message: 'Inténtalo de nuevo en un momento.'
      });
    } finally {
      btn.disabled = false;
    }
  }

  Consultia.renderHistorial = async function () {
    var items = await loadTransactions();
    var consumos = items.filter(function (t) { return t.amount < 0; });
    ultimosConsumos = consumos;

    renderList(
      document.getElementById('historialList'),
      document.getElementById('historialEmpty'),
      consumos,
      'historial'
    );

    var btn = document.getElementById('historialPdfBtn');
    if (!btn) return;
    btn.hidden = !consumos.length;
    // La vista se repinta cada vez que se entra, así que el listener se
    // pone una sola vez o se acumularían y el PDF saldría por duplicado.
    if (!btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () { descargarHistorialPdf(btn); });
    }
  };
})();
