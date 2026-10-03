/* ============================================================
   ADMIN MAIN — arranque y navegación
============================================================ */

(function () {
  var A = window.Consultia.Admin;

  /* Las seis pestañas y qué pantallas cuelgan de cada una. La barra
     lateral tenía dieciséis entradas y tres de ellas eran lo mismo
     (Recargas, Compras y Mercado Pago son movimientos de dinero); aquí
     van juntas bajo «Pagos» y se eligen con las fichas de debajo. */
  var PESTANAS = {
    usuarios:   [['users', 'Usuarios'], ['addusers', 'Agregar usuario']],
    pagos:      [['revenue', 'Ingresos del mes'], ['recargas', 'Recargas'], ['compras', 'Compras'], ['mercadopago', 'Mercado Pago']],
    actividad:  [['consultas', 'Consultas'], ['dashboard', 'Resumen'], ['audit', 'Auditoría']],
    publicidad: [['carteles', 'Carteles'], ['anuncios', 'Anuncios']],
    sistema:    [['settings', 'Configuración'], ['team', 'Equipo'], ['antiabuse', 'Anti-abuso']]
  };

  /* A qué pestaña pertenece cada pantalla. Hace falta porque hay botones
     que saltan a una pantalla de OTRA pestaña (los KPI del resumen, por
     ejemplo): sin esto la barra seguía marcando la pestaña anterior y
     las fichas de debajo eran las que no tocaban. */
  var PESTANA_DE = {};
  Object.keys(PESTANAS).forEach(function (clave) {
    PESTANAS[clave].forEach(function (v) { PESTANA_DE[v[0]] = clave; });
  });

  /* Qué hay que pintar al abrir cada pantalla. */
  var AL_ABRIR = {
    dashboard:   ['renderDashboard'],
    revenue:     ['renderRevenue'],
    users:       ['renderUsers'],
    addusers:    ['renderAddUsers'],
    recargas:    ['renderRecargas'],
    compras:     ['renderCompras'],
    consultas:   ['renderConsultas'],
    anuncios:    ['renderBroadcasts'],
    carteles:    ['renderCarteles'],
    mercadopago: ['renderMercadoPago'],
    team:        ['renderTeam'],
    antiabuse:   ['renderAntiAbuse'],
    audit:       ['renderAudit'],
    settings:    ['renderMaintenance', 'renderAvisoClientes']
  };

  function pintarFichas(clave, vistaActiva) {
    var caja = document.getElementById('adFichas');
    if (!caja) return;
    var vistas = PESTANAS[clave] || [];
    if (vistas.length < 2) { caja.innerHTML = ''; return; }
    caja.innerHTML = vistas.map(function (v) {
      return '<button type="button" class="ad-ficha' + (v[0] === vistaActiva ? ' es-activa' : '') +
             '" data-admin-view="' + v[0] + '">' + v[1] + '</button>';
    }).join('');
  }

  function marcarPestana(clave) {
    document.querySelectorAll('[data-admin-tab]').forEach(function (b) {
      var es = b.dataset.adminTab === clave;
      b.classList.toggle('es-activa', es);
      b.setAttribute('aria-selected', String(es));
    });
  }

  /* Abrir una pestaña es abrir su primera pantalla. */
  function switchTab(clave) {
    if (PESTANAS[clave]) switchView(PESTANAS[clave][0][0]);
  }
  A.switchTab = switchTab;

  function switchView(viewKey) {
    var clave = PESTANA_DE[viewKey];
    if (!clave) return;

    marcarPestana(clave);
    pintarFichas(clave, viewKey);

    document.querySelectorAll('.admin-view').forEach(function (v) { v.hidden = true; });
    var target = document.getElementById('adminView-' + viewKey);
    if (target) target.hidden = false;

    document.querySelectorAll('[data-admin-view]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.adminView === viewKey);
    });

    (AL_ABRIR[viewKey] || []).forEach(function (fn) {
      if (typeof A[fn] === 'function') A[fn]();
    });
  }
  A.switchView = switchView;

  // El interruptor de aviso de la barra necesita poder traer aquí al
  // administrador cuando falta escribir el mensaje.
  A.irAConfiguracion = function () { switchView('settings'); };

  function initNav() {
    document.querySelectorAll('[data-admin-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.adminTab); });
    });
    /* Delegado: las fichas de cada pestaña se crean al vuelo, y hay
       botones con data-admin-view repartidos por las pantallas. */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-admin-view]');
      if (!b) return;
      switchView(b.dataset.adminView);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    A.initAuth(function () {
      A.getStore();
      if (A.initRevenue)     A.initRevenue();
      if (A.initUsers)       A.initUsers();
      if (A.initAddUsers)    A.initAddUsers();
      if (A.initRecargas)    A.initRecargas();
      if (A.initCompras)     A.initCompras();
      if (A.initConsultas)   A.initConsultas();
      if (A.initBroadcasts)  A.initBroadcasts();
      if (A.initMercadoPago) A.initMercadoPago();
      if (A.initTeam)        A.initTeam();
      if (A.initAntiAbuse)   A.initAntiAbuse();
      if (A.initAudit)       A.initAudit();
      if (A.initMaintenance) A.initMaintenance();
      if (A.initAvisoClientes) A.initAvisoClientes();
      initNav();
      if (A.initCabecera) A.initCabecera();
      switchTab('usuarios');
    });
  });
})();
