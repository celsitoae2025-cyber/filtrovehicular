/* ============================================================
   ADMIN MAIN — arranque y navegación
============================================================ */

(function () {
  var A = window.Consultia.Admin;

  var PESTANAS = {
    resumen:    [['dashboard', 'Resumen']],
    usuarios:   [['users', 'Usuarios'], ['addusers', 'Agregar usuario']],
    pagos:      [['revenue', 'Ingresos del mes'], ['recargas', 'Recargas'], ['compras', 'Compras'], ['mercadopago', 'Mercado Pago']],
    actividad:  [['consultas', 'Consultas de hoy'], ['audit', 'Auditoría']],
    publicidad: [['anuncios', 'Anuncios'], ['carteles', 'Carteles']],
    sistema:    [['settings', 'Configuración'], ['team', 'Equipo'], ['antiabuse', 'Prevención de abuso']]
  };

  var VISTAS = Object.create(null);
  Object.keys(PESTANAS).forEach(function (clave) {
    PESTANAS[clave].forEach(function (v) { VISTAS[v[0]] = { seccion: clave, titulo: v[1] }; });
  });
  var vistaActual = '';

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
    var vistas = PESTANAS[clave];
    caja.hidden = vistas.length < 2;
    caja.innerHTML = caja.hidden ? '' : vistas.map(function (v) {
      var activa = v[0] === vistaActiva;
      return '<button type="button" class="ad-ficha' + (activa ? ' es-activa' : '') +
             '" data-admin-view="' + v[0] + '"' + (activa ? ' aria-current="page"' : '') + '>' + v[1] + '</button>';
    }).join('');
  }

  function marcarPestana(clave) {
    document.querySelectorAll('[data-admin-tab]').forEach(function (b) {
      var es = b.dataset.adminTab === clave;
      b.classList.toggle('es-activa', es);
      if (es) b.setAttribute('aria-current', clave === 'resumen' ? 'page' : 'true');
      else b.removeAttribute('aria-current');
    });
  }

  /* Abrir una pestaña es abrir su primera pantalla. */
  function switchTab(clave) {
    if (Object.hasOwn(PESTANAS, clave)) return switchView(PESTANAS[clave][0][0]);
  }
  A.switchTab = switchTab;

  function switchView(viewKey) {
    var vista = VISTAS[viewKey];
    var target = document.getElementById('adminView-' + viewKey);
    if (!vista || !target) return false;

    var titulo = document.getElementById('adVistaTitulo');
    titulo.textContent = vista.titulo;
    target.setAttribute('aria-labelledby', titulo.id);
    marcarPestana(vista.seccion);
    pintarFichas(vista.seccion, viewKey);
    document.querySelectorAll('.admin-view').forEach(function (v) { v.hidden = v !== target; });
    document.getElementById('adEstado').open = false;
    document.getElementById('adFiltrosUsuarios').open = false;
    if (vistaActual !== viewKey) window.scrollTo(0, 0);
    vistaActual = viewKey;

    document.querySelectorAll('[data-admin-view]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.adminView === viewKey);
    });

    (AL_ABRIR[viewKey] || []).forEach(function (fn) {
      if (typeof A[fn] === 'function') A[fn]();
    });
    return true;
  }
  A.switchView = switchView;

  // El interruptor de aviso de la barra necesita poder traer aquí al
  // administrador cuando falta escribir el mensaje.
  A.irAConfiguracion = function () { switchView('settings'); };

  function initNav() {
    var panel = document.getElementById('adminApp');
    var titulo = document.getElementById('adVistaTitulo');
    var lateral = document.getElementById('adLateral');
    var navegacion = document.getElementById('adNavegacion');
    var abrirMenu = document.getElementById('adAbrirMenu');
    var menu = document.getElementById('adMenuMovil');
    var estado = document.getElementById('adEstado');
    var desplegables = [estado, document.getElementById('adFiltrosUsuarios')];

    abrirMenu.addEventListener('click', function () {
      estado.open = false;
      document.getElementById('adMenuContenido').appendChild(navegacion);
      menu.showModal();
      abrirMenu.setAttribute('aria-expanded', 'true');
      var actual = navegacion.querySelector('[aria-current]');
      actual.focus({ preventScroll: true });
      actual.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    });
    document.getElementById('adCerrarMenu').addEventListener('click', function () { menu.close(); });
    menu.addEventListener('click', function (e) { if (e.target === menu) menu.close(); });
    menu.addEventListener('close', function () {
      lateral.appendChild(navegacion);
      abrirMenu.setAttribute('aria-expanded', 'false');
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (e) {
      if (e.matches && menu.open) { menu.close(); titulo.focus({ preventScroll: true }); }
    });
    desplegables.forEach(function (detalle) {
      detalle.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !detalle.open) return;
        e.preventDefault();
        detalle.open = false;
        detalle.querySelector('summary').focus();
      });
    });

    panel.addEventListener('click', function (e) {
      desplegables.forEach(function (detalle) { if (!detalle.contains(e.target)) detalle.open = false; });
      var b = e.target.closest('[data-admin-view],[data-admin-tab]');
      if (!b) return;
      var cambio = b.dataset.adminTab ? switchTab(b.dataset.adminTab) : switchView(b.dataset.adminView);
      if (!cambio) return;
      if (menu.open) menu.close();
      titulo.focus({ preventScroll: true });
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
      switchTab('resumen');
    });
  });
})();
