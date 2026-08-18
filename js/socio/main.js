/* ============================================================
   SOCIO MAIN — arranque y navegación del panel del socio
============================================================ */

(function () {
  var S = window.Consultia.Socio;

  var TITULOS = {
    resumen:     'Resumen',
    clientes:    'Mis clientes',
    movimientos: 'Entregas'
  };

  function cambiarVista(clave) {
    document.querySelectorAll('.admin-view').forEach(function (v) { v.hidden = true; });
    var destino = document.getElementById('socioView-' + clave);
    if (destino) destino.hidden = false;

    document.querySelectorAll('[data-socio-view]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.socioView === clave);
    });

    var titulo = document.getElementById('socioPageTitle');
    if (titulo) titulo.textContent = TITULOS[clave] || '';

    if (clave === 'resumen')     S.cargarResumen();
    if (clave === 'clientes')    { S.cargarResumen(); S.cargarClientes(); }
    if (clave === 'movimientos') S.cargarMovimientos();
  }

  function initNav() {
    document.querySelectorAll('[data-socio-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        cambiarVista(btn.dataset.socioView);
        if (window.innerWidth <= 768) cerrarMenu();
      });
    });
  }

  function abrirMenu() {
    document.querySelector('.admin-side').classList.add('open');
    document.getElementById('socioOverlay').classList.add('show');
    document.body.classList.add('admin-sidebar-open');
  }
  function cerrarMenu() {
    document.querySelector('.admin-side').classList.remove('open');
    document.getElementById('socioOverlay').classList.remove('show');
    document.body.classList.remove('admin-sidebar-open');
  }

  function initMenuMovil() {
    var btn = document.getElementById('socioMenuBtn');
    var velo = document.getElementById('socioOverlay');
    if (btn) btn.addEventListener('click', abrirMenu);
    if (velo) velo.addEventListener('click', cerrarMenu);
  }

  document.addEventListener('DOMContentLoaded', function () {
    S.initAuth(function () {
      initNav();
      initMenuMovil();
      S.initPanel();
      cambiarVista('resumen');
    });
  });
})();
