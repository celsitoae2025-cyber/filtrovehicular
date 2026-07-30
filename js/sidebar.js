/* ============================================================
   SIDEBAR — hamburguesa mobile + submenús accordion
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  Consultia.initSidebar = function () {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const menuBtn = document.getElementById('menuBtn');
    const toggleBtn = document.getElementById('sidebarToggle');

    if (!sidebar || !overlay || !menuBtn) return null;

    const open = () => {
      sidebar.classList.add('open');
      overlay.classList.add('show');
      document.body.classList.add('sidebar-open');
      menuBtn.setAttribute('aria-expanded', 'true');
    };

    const close = () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
      document.body.classList.remove('sidebar-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    };

    menuBtn.addEventListener('click', () =>
      sidebar.classList.contains('open') ? close() : open()
    );
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    // ===== Colapso (solo desktop, manual con botón) =====
    // Ya no auto-colapsa ni reacciona al hover; solo el botón toggle lo cambia.
    const collapse = () => {
      sidebar.classList.add('collapsed');
      document.querySelectorAll('.nav-item.open').forEach(n => {
        n.classList.remove('open');
        const sub = document.getElementById(n.dataset.submenu);
        if (sub) sub.classList.remove('open');
      });
    };
    const expand = () => sidebar.classList.remove('collapsed');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.contains('collapsed') ? expand() : collapse();
      });
    }

    // ===== Toggle de la pestaña "Extras" =====
    const extrasBtn = document.getElementById('extrasToggle');
    const extrasMenu = document.getElementById('extrasSubmenu');
    if (extrasBtn && extrasMenu) {
      const openExtras = () => {
        extrasMenu.hidden = false;
        extrasBtn.classList.add('is-open');
        extrasBtn.setAttribute('aria-expanded', 'true');
      };
      const closeExtras = () => {
        extrasMenu.hidden = true;
        extrasBtn.classList.remove('is-open');
        extrasBtn.setAttribute('aria-expanded', 'false');
      };
      extrasBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        extrasBtn.classList.contains('is-open') ? closeExtras() : openExtras();
      });
      // Si el usuario navega a una categoría, mantener el submenú abierto
      // (útil cuando la vista activa está dentro de Extras).
      const activeCat = document.querySelector('.nav-submenu .nav-item.active');
      if (activeCat) openExtras();
    }

    return { close, collapse, expand };
  };
})();
