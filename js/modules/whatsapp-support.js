/* ============================================================
   WHATSAPP SUPPORT — arma el link del FAB con saludo
   dinámico según la hora local del usuario.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  function buildHref() {
    var msg = Consultia.greeting() +
      ', estoy en Filtro Vehicular+ y necesito ayuda. ' +
      'Quiero información sobre los planes y cómo comprar créditos. ' +
      '¿Pueden orientarme?';
    return 'https://wa.me/' + Consultia.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  function refresh() {
    var el = document.getElementById('waSupport');
    if (el) el.href = buildHref();
  }

  Consultia.initWhatsappSupport = function () {
    refresh();
    // Si la pestaña se queda abierta y pasa la hora (ej. usuario deja la web
    // abierta y cambia de día a tarde), recomputamos cuando vuelve el foco.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh();
    });
  };
})();
