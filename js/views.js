/* ============================================================
   VIEWS — navegación entre vistas
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  // Etiquetas del breadcrumb por vista
  const viewLabels = {
    'view-filter':         '',
    'view-dashboard':      'Dashboard',
    'view-premium':        'Consultas Premium',
    'view-vehiculos':      'Vehículos',
    'view-sunarp':         'Sunarp',
    'view-reniec':         'Reniec',
    'view-sunat':          'Sunat',
    'view-financiero':     'Financiero',
    'view-telefonia':      'Telefonía',
    'view-familiares':     'Familiares',
    'view-delitos':        'Delitos',
    'view-laboral':        'Laboral',
    'view-extras':         'Extras',
    'view-cuenta':         'Mi cuenta',
    'view-saldo':          'Mi saldo',
    'view-compras':        'Mis compras',
    'view-historial':      'Mis consultas',
    'view-notificaciones': 'Notificaciones',
    'view-configuracion':  'Configuración',
    'view-regiones':       'Infracciones por regiones',
  };

  function updateBreadcrumb(viewId) {
    const label = viewLabels[viewId] || '';
    const sep = document.getElementById('breadcrumbSep');
    const curr = document.getElementById('currentCrumb');
    if (!sep || !curr) return;
    if (label) {
      sep.hidden = false;
      curr.hidden = false;
      curr.textContent = label;
      // En pantallas estrechas el nombre se recorta con puntos suspensivos
      // (ver .breadcrumb .crumb.current en topbar.css). El title deja
      // leerlo entero al posar el cursor sin ocupar sitio en la barra.
      curr.title = label;
    } else {
      sep.hidden = true;
      curr.hidden = true;
    }
  }

  Consultia.initViews = function (onNavigate) {
    const views = document.querySelectorAll('.view');

    // Sincroniza el estado .active del sidebar con la vista visible.
    const syncActiveNav = viewId => {
      const key = viewId.replace(/^view-/, '');
      document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.nav === key);
      });
    };

    // Mapea el hash de la URL (#cuenta) a un viewId válido (view-cuenta).
    // Sin hash → Consulta vehicular (view-filter) como página principal.
    const parseHashToViewId = () => {
      const hash = (window.location.hash || '').replace(/^#/, '');
      if (!hash) return 'view-filter';
      const id = 'view-' + hash;
      return document.getElementById(id) ? id : 'view-filter';
    };

    const showView = (viewId, pushHistory) => {
      views.forEach(v => (v.hidden = v.id !== viewId));
      updateBreadcrumb(viewId);
      syncActiveNav(viewId);

      // Por defecto empuja estado al historial para que el botón "atrás"
      // del navegador vuelva a la vista anterior. Cuando la llamada viene
      // de popstate o de la carga inicial, pasamos false para no duplicar.
      if (pushHistory !== false) {
        const slug = viewId.replace(/^view-/, '');
        // Bug fix #4: al navegar al dashboard no preservar query params anteriores
        // (ej. ?action=signup del landing) — reabrirían el modal al recargar.
        const newUrl = window.location.pathname + (slug !== 'filter' ? '#' + slug : '');
        // No pushear si ya estamos en el mismo estado
        if (!window.history.state || window.history.state.viewId !== viewId) {
          window.history.pushState({ viewId: viewId }, '', newUrl);
        }
      }
    };

    // Volver al inicio → vista filter (principal)
    const goHome = () => {
      showView('view-filter');
      if (Consultia.setFilterOption) Consultia.setFilterOption('free-placa');
      document.querySelectorAll('.submenu a').forEach(a => a.classList.remove('active-sub'));
      document.querySelectorAll('.nav-item.open').forEach(n => {
        n.classList.remove('open');
        const sub = document.getElementById(n.dataset.submenu);
        if (sub) sub.classList.remove('open');
      });
      if (typeof onNavigate === 'function') onNavigate();
    };

    // Al cargar la página: si la URL trae #cuenta (u otro hash válido),
    // mostramos esa vista; si no, dashboard. Reemplazamos el estado inicial.
    const initialViewId = parseHashToViewId();
    views.forEach(v => (v.hidden = v.id !== initialViewId));
    updateBreadcrumb(initialViewId);
    syncActiveNav(initialViewId);
    {
      const slug = initialViewId.replace(/^view-/, '');
      const initialUrl = window.location.pathname + (slug !== 'filter' ? '#' + slug : '');
      window.history.replaceState({ viewId: initialViewId }, '', initialUrl);
    }
    // Disparar onNavigate en la carga inicial para que main.js aplique
    // body.is-dashboard-view (y oculte el right-panel) desde el primer render.
    if (typeof onNavigate === 'function') onNavigate(initialViewId);

    // Botón "atrás" del navegador: restaura la vista previa sin recargar.
    window.addEventListener('popstate', function (e) {
      const viewId = (e.state && e.state.viewId) || parseHashToViewId();
      showView(viewId, false);
      if (typeof onNavigate === 'function') onNavigate(viewId);
    });

    // Breadcrumb "Inicio"
    const homeBtn = document.getElementById('goHomeBtn');
    if (homeBtn) homeBtn.addEventListener('click', goHome);

    // Quick-actions del dashboard que llevan directo a una categoría
    document.querySelectorAll('[data-go-submenu]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.goSubmenu;
        const trigger = document.querySelector('.nav-item.nav-category[data-nav="' + key + '"]');
        if (trigger) trigger.click();
      });
    });

    // Navegación genérica por data-nav (sidebar actions + user dropdown)
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const nav = btn.dataset.nav;
        // "filter" resetea además la opción del combo a la por defecto
        if (nav === 'filter' && Consultia.setFilterOption) {
          Consultia.setFilterOption('free-placa');
        }
        var viewId = 'view-' + nav;
        showView(viewId);
        // Cierra el dropdown del usuario (si está abierto)
        const userMenu = document.querySelector('.user-menu');
        if (userMenu) userMenu.classList.remove('open');
        if (typeof onNavigate === 'function') onNavigate(viewId);
      });
    });

    // El logout real se maneja desde js/modules/auth-ui.js

    return { showView };
  };
})();
