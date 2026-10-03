/* ============================================================
   CABECERA DEL PANEL — las cuatro cifras de arriba

   Son las que se miran a diario, así que están siempre a la vista, en
   cualquier pestaña. Antes vivían en un «Dashboard» que no hacía nada
   más y había que ir a buscarlo.

   Cada cifra se pide por separado y escribe en cuanto llega: si una
   consulta tarda, las otras tres ya están puestas en vez de esperar
   todas a la más lenta.
============================================================ */
(function () {
  var A = window.Consultia.Admin;

  function sb() { return A.getSB ? A.getSB() : (window.Consultia && window.Consultia.supabase); }

  function poner(id, valor, pie) {
    var el = document.getElementById(id);
    if (el) el.textContent = valor;
    if (pie != null) {
      var p = document.getElementById(id + 'Pie');
      if (p) p.textContent = pie;
    }
  }

  function numero(n) { return (Number(n) || 0).toLocaleString('es-PE'); }
  function soles(n) { return 'S/ ' + (Number(n) || 0).toFixed(2); }

  /* Todas las filas de una tabla, de mil en mil: PostgREST corta en
     1.000 y con más usuarios las cuentas salían cortas. */
  async function todas(tabla, columnas, filtrar) {
    var c = sb();
    if (!c) return [];
    var filas = [];
    for (var desde = 0; ; desde += 1000) {
      var q = c.from(tabla).select(columnas).range(desde, desde + 999);
      if (filtrar) q = filtrar(q);
      var res = await q;
      if (res.error) { console.error('[cabecera] ' + tabla + ':', res.error.message); break; }
      var tramo = res.data || [];
      filas = filas.concat(tramo);
      if (tramo.length < 1000) break;
      if (desde > 200000) break;
    }
    return filas;
  }

  async function ingresos() {
    var filas = await todas('transactions', 'amount_pen, status', function (q) {
      return q.not('amount_pen', 'is', null);
    });
    var total = 0, pagos = 0;
    filas.forEach(function (t) {
      var v = parseFloat(t.amount_pen) || 0;
      if (v <= 0) return;
      total += v; pagos += 1;
    });
    poner('adIngresos', soles(total), pagos + (pagos === 1 ? ' pago completado' : ' pagos completados'));
  }

  async function usuariosYCreditos() {
    var filas = await todas('profiles', 'credits_balance, subscription_expires_at');
    var ahora = Date.now();
    var conPlan = 0, vencidos = 0, creditos = 0;
    filas.forEach(function (u) {
      creditos += Number(u.credits_balance) || 0;
      if (!u.subscription_expires_at) return;
      var t = new Date(u.subscription_expires_at).getTime();
      if (isNaN(t)) return;
      if (t > ahora) conPlan += 1; else vencidos += 1;
    });
    var sinPlan = filas.length - conPlan - vencidos;
    poner('adUsuarios', numero(filas.length),
      conPlan + ' con plan · ' + vencidos + ' vencidos · ' + sinPlan + ' sin plan');
    poner('adCreditos', numero(creditos),
      filas.length ? Math.round(creditos / filas.length) + ' de media por usuario' : 'sin usuarios');
  }

  async function consultasDeHoy() {
    var c = sb();
    if (!c) return;
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var res = await c.from('consultas')
      .select('status, cost')
      .gte('created_at', hoy.toISOString())
      .limit(5000);
    if (res.error) { poner('adHoy', '—', 'no se pudo leer'); return; }
    var filas = res.data || [];
    var sinResultado = 0, gastados = 0;
    filas.forEach(function (q) {
      if (q.status !== 'success') sinResultado += 1;
      gastados += Number(q.cost) || 0;
    });
    poner('adHoy', numero(filas.length),
      sinResultado + ' sin resultado · ' + numero(gastados) + ' créditos gastados');
  }

  function render() {
    ingresos();
    usuariosYCreditos();
    consultasDeHoy();
  }

  A.initCabecera = function () {
    render();
    /* Cada dos minutos: el panel se deja abierto todo el día. */
    setInterval(render, 120000);
  };
  A.renderCabecera = render;
})();
