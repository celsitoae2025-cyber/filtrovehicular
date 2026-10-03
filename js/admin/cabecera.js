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
    /* Solo amount_pen. Antes se pedía también `status`, que en
       transactions no existe: PostgREST devolvía 400 y la cifra de
       ingresos se quedaba en «cargando…» para siempre. */
    var filas = await todas('transactions', 'amount_pen', function (q) {
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
    var conPlan = 0, vencidos = 0, creditos = 0, soloCreditos = 0;
    filas.forEach(function (u) {
      var saldo = Number(u.credits_balance) || 0;
      creditos += saldo;
      var t = u.subscription_expires_at ? new Date(u.subscription_expires_at).getTime() : NaN;
      if (!isNaN(t) && t > ahora) { conPlan += 1; return; }
      if (!isNaN(t)) { vencidos += 1; return; }
      /* Sin plan por días pero con saldo: no está «sin nada», está en el
         otro producto. Contarlos juntos escondía a los clientes de
         paquetes de créditos, que son casi todos. */
      if (saldo > 0) soloCreditos += 1;
    });
    poner('adUsuarios', numero(filas.length),
      conPlan + ' con plan · ' + vencidos + ' vencidos · ' + soloCreditos + ' solo con créditos');
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

  /* NADIE PAGA POR LO QUE NO RECIBIÓ

     El servidor devuelve el crédito cuando una consulta no trae datos,
     pero una reserva puede quedarse sin liquidar si se corta a mitad
     (pestaña cerrada, proveedor mudo, la función del servidor se acabó).
     Mientras el panel esté abierto se barren las de TODOS cada dos
     minutos; cada cliente barre además las suyas al consultar. */
  async function devolverColgadas() {
    var c = sb();
    if (!c) return;
    try {
      var res = await c.rpc('liquidar_consultas_colgadas', { p_todos: true });
      if (res.error) { console.warn('[cabecera] barrido:', res.error.message); return; }
      if (res.data > 0) console.info('[cabecera] reservas colgadas devueltas:', res.data);
    } catch (e) {
      console.warn('[cabecera] barrido:', e);
    }
  }

  function render() {
    ingresos();
    usuariosYCreditos();
    consultasDeHoy();
    devolverColgadas();
  }

  /* CUÁNTO OCUPA LO QUE SE QUEDA QUIETO ARRIBA
     La barra negra y las pestañas van pegadas al borde; la cabecera de
     la tabla tiene que pararse justo debajo, no detrás. La altura se
     mide en vez de escribirla a mano: con otro tamaño de letra, o si las
     pestañas se parten en dos líneas, el hueco sigue siendo el bueno. */
  function medirFijo() {
    var app = document.querySelector('.admin-app');
    var cab = document.querySelector('.ad-cab');
    var pes = document.querySelector('.ad-pestanas');
    if (!app || !cab || !pes) return;
    var hCab = Math.round(cab.getBoundingClientRect().height);
    var hPes = Math.round(pes.getBoundingClientRect().height);
    if (!hCab) return;
    app.style.setProperty('--ad-cab', hCab + 'px');
    app.style.setProperty('--ad-fijo', (hCab + hPes) + 'px');
  }

  A.initCabecera = function () {
    medirFijo();
    window.addEventListener('resize', medirFijo);
    render();
    /* Cada dos minutos: el panel se deja abierto todo el día. */
    setInterval(render, 120000);
  };
  A.renderCabecera = render;
})();
