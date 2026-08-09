/* ============================================================
   ADMIN MAIN — entry point + wiring de navegación
============================================================ */

(function () {
  var A = window.Consultia.Admin;

  var VIEW_TITLES = {
    dashboard:   'Dashboard',
    revenue:     'Ingresos del mes',
    users:       'Usuarios',
    addusers:    'Agregar Usuario',
    recargas:    'Recargas de créditos',
    plans:       'Planes y Suscripciones',
    compras:     'Compras',
    consultas:   'Consultas',
    anuncios:    'Anuncios',
    mercadopago: 'Mercado Pago',
    webhooks:    'Webhooks',
    team:        'Equipo',
    apikeys:     'API Keys',
    antiabuse:   'Anti-abuso',
    audit:       'Auditoría',
    settings:    'Configuración'
  };

  function switchView(viewKey) {
    document.querySelectorAll('.admin-view').forEach(function (v) { v.hidden = true; });
    var target = document.getElementById('adminView-' + viewKey);
    if (target) target.hidden = false;

    document.querySelectorAll('[data-admin-view]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.adminView === viewKey);
    });

    var title = document.getElementById('adminPageTitle');
    if (title) title.textContent = VIEW_TITLES[viewKey] || '';

    if (viewKey === 'dashboard'   && A.renderDashboard)   A.renderDashboard();
    if (viewKey === 'revenue'     && A.renderRevenue)     A.renderRevenue();
    if (viewKey === 'users'       && A.renderUsers)       A.renderUsers();
    if (viewKey === 'addusers'    && A.renderAddUsers)    A.renderAddUsers();
    if (viewKey === 'recargas'    && A.renderRecargas)    A.renderRecargas();
    if (viewKey === 'plans'       && A.renderPlans)       A.renderPlans();
    if (viewKey === 'compras'     && A.renderCompras)     A.renderCompras();
    if (viewKey === 'consultas'   && A.renderConsultas)   A.renderConsultas();
    if (viewKey === 'anuncios'    && A.renderBroadcasts)  A.renderBroadcasts();
    if (viewKey === 'mercadopago' && A.renderMercadoPago) A.renderMercadoPago();
    if (viewKey === 'webhooks'    && A.renderWebhooks)    A.renderWebhooks();
    if (viewKey === 'team'        && A.renderTeam)        A.renderTeam();
    if (viewKey === 'apikeys'     && A.renderApiKeys)     A.renderApiKeys();
    if (viewKey === 'antiabuse'   && A.renderAntiAbuse)   A.renderAntiAbuse();
    if (viewKey === 'audit'       && A.renderAudit)       A.renderAudit();
    if (viewKey === 'settings'    && A.renderSettings)    A.renderSettings();
    if (viewKey === 'settings'    && A.renderMaintenance) A.renderMaintenance();
  }

  function initNav() {
    document.querySelectorAll('[data-admin-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchView(btn.dataset.adminView);
        if (window.innerWidth <= 768) closeMobileSidebar();
      });
    });
  }

  function openMobileSidebar() {
    document.querySelector('.admin-side').classList.add('open');
    document.getElementById('adminOverlay').classList.add('show');
    document.body.classList.add('admin-sidebar-open');
  }
  function closeMobileSidebar() {
    document.querySelector('.admin-side').classList.remove('open');
    document.getElementById('adminOverlay').classList.remove('show');
    document.body.classList.remove('admin-sidebar-open');
  }

  function initMobileToggle() {
    var btn = document.getElementById('adminMenuBtn');
    var overlay = document.getElementById('adminOverlay');
    if (btn) btn.addEventListener('click', openMobileSidebar);
    if (overlay) overlay.addEventListener('click', closeMobileSidebar);
  }

  document.addEventListener('DOMContentLoaded', function () {
    A.initAuth(function () {
      A.getStore();
      if (A.initRevenue)     A.initRevenue();
      if (A.initUsers)       A.initUsers();
      if (A.initAddUsers)    A.initAddUsers();
      if (A.initRecargas)    A.initRecargas();
      if (A.initPlans)       A.initPlans();
      if (A.initCompras)     A.initCompras();
      if (A.initConsultas)   A.initConsultas();
      if (A.initBroadcasts)  A.initBroadcasts();
      if (A.initMercadoPago) A.initMercadoPago();
      if (A.initWebhooks)    A.initWebhooks();
      if (A.initTeam)        A.initTeam();
      if (A.initApiKeys)     A.initApiKeys();
      if (A.initAudit)       A.initAudit();
      if (A.initSettings)    A.initSettings();
      if (A.initMaintenance) A.initMaintenance();
      initNav();
      initMobileToggle();
      switchView('dashboard');
    });
  });
})();
