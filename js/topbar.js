/* ============================================================
   TOPBAR — menú de usuario (dropdown)
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  Consultia.initUserMenu = function () {
    const userMenu = document.querySelector('.user-menu');
    const userBtn = document.getElementById('userBtn');
    if (!userMenu || !userBtn) return;

    userBtn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = userMenu.classList.toggle('open');
      userBtn.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', e => {
      if (!userMenu.contains(e.target)) {
        userMenu.classList.remove('open');
        userBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        userMenu.classList.remove('open');
        userBtn.setAttribute('aria-expanded', 'false');
      }
    });
  };
})();
