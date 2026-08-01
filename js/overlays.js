/* ============================================================
   OVERLAYS — modales (términos, cookies) y banner de cookies
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  const COOKIE_KEY = 'consultia_cookies_consent';

  Consultia.openModal = function (name) {
    const modal = document.getElementById(name + 'Modal');
    if (modal) {
      modal.hidden = false;
      document.body.classList.add('modal-open');
    }
  };

  Consultia.closeModal = function (modal) {
    if (!modal) return;
    modal.hidden = true;
    // Si no hay otros modales abiertos, liberar el scroll
    const hasOpen = document.querySelectorAll('.modal:not([hidden])').length > 0;
    if (!hasOpen) document.body.classList.remove('modal-open');
  };

  Consultia.initOverlays = function () {
    // Abrir modales desde enlaces del footer
    document.querySelectorAll('[data-modal]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        Consultia.openModal(link.dataset.modal);
      });
    });

    // Cerrar: click en overlay, botón close, o tecla Esc
    document.querySelectorAll('.modal [data-close]').forEach(el => {
      el.addEventListener('click', () => {
        const modal = el.closest('.modal');
        Consultia.closeModal(modal);
      });
    });

    // Click en una región → abre la URL externa en pestaña nueva
    document.querySelectorAll('.region-card[data-region]').forEach(card => {
      card.addEventListener('click', () => {
        const url = card.dataset.href;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      });
    });

    // Click en una service-card de "Consultar placa":
    //   - Anónimo + tarjeta con `is-locked-anon` → abrir modal de login.
    //   - Logueado (o tarjeta sin candado) → abrir el data-href en pestaña nueva.
    document.querySelectorAll('.service-card[data-href]').forEach(card => {
      card.addEventListener('click', () => {
        const isAnon = document.body.classList.contains('is-anonymous');
        const isLocked = card.classList.contains('is-locked-anon');
        if (isAnon && isLocked) {
          if (Consultia.AuthModals) Consultia.AuthModals.openLogin();
          if (Consultia.toast) Consultia.toast({
            type: 'info',
            title: 'Inicia sesión',
            message: 'Crea tu cuenta gratis para acceder a todos los servicios.'
          });
          return;
        }
        const url = card.dataset.href;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      });
    });

    // Filtro de regiones (buscador en la vista)
    function filterRegions(term) {
      const t = (term || '').trim().toLowerCase();
      let visible = 0;
      document.querySelectorAll('.region-card[data-region]').forEach(card => {
        const name = (card.dataset.name || '').toLowerCase();
        const desc = (card.querySelector('small')?.textContent || '').toLowerCase();
        const match = !t || name.includes(t) || desc.includes(t);
        card.hidden = !match;
        if (match) visible++;
      });
      const counter = document.getElementById('regionesCount');
      if (counter) counter.textContent = visible;
    }
    var regionesSearch = document.getElementById('regionesSearchView');
    if (regionesSearch) {
      regionesSearch.addEventListener('input', () => filterRegions(regionesSearch.value));
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not([hidden])').forEach(m => Consultia.closeModal(m));
      }
    });

    // Banner de cookies
    const banner = document.getElementById('cookieBanner');
    const btnAccept = document.getElementById('cookieAccept');
    const btnReject = document.getElementById('cookieReject');

    if (banner) {
      banner.hidden = true;
    }
  };
})();
