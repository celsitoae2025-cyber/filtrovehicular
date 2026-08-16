/* ============================================================
   PIE DE PÁGINA — año y freno de los botones flotantes

   Los enlaces de navegación ya los conecta views.js por data-nav, y los
   legales overlays.js por data-modal. Aquí solo queda lo que ninguno
   de los dos cubre.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  /* Los dos botones flotantes —el CTA "Obtén tu reporte" y el de WhatsApp—
     son position:fixed, así que sin ayuda se quedan pegados al borde de la
     ventana y acaban montados sobre el pie al llegar al final.

     Se calcula cuánto pie asoma dentro de la ventana y se sube esa misma
     cantidad, de modo que los botones se FRENAN justo encima del pie. Como
     el desplazamiento es exactamente la invasión, cada botón conserva su
     separación propia (el CTA sus 24px, el de WhatsApp sus 80px) medida
     ahora contra el borde del pie.

     Tres decisiones que son de rendimiento, no de estilo, y que conviene
     no deshacer:

     1. El transform se escribe DIRECTAMENTE en los dos botones. La versión
        anterior publicaba una variable CSS en :root y el resultado se veía
        a tirones: tocar una custom property del elemento raíz obliga al
        navegador a revisar el estilo de todo el documento en cada
        fotograma, y esta página tiene cientos de tarjetas.

     2. Si el valor no ha cambiado desde el fotograma anterior no se
        escribe nada. Durante la mayor parte del scroll el pie ni asoma y
        el desplazamiento es 0, así que no se toca el DOM.

     3. NO se usa IntersectionObserver para encender y apagar el
        seguimiento, aunque sería lo natural: se probó y no llega a
        disparar en todos los entornos, y cuando no dispara los botones
        dejan de frenar y se montan sobre el pie. Un listener de scroll
        con rAF es menos elegante pero funciona siempre. */
  function anclarFlotantes() {
    var pie = document.querySelector('.site-footer');
    if (!pie) return;

    var scroller = document.querySelector('.main');
    var botones = [];
    ['ctaReporteBtn', 'waSupport'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) botones.push(e);
    });
    if (!botones.length) return;

    var pedido = false;
    var ultimo = -1;

    function medir() {
      pedido = false;

      var px = 0;
      // Si el pie está oculto (sin sesión) no hay nada que esquivar.
      if (getComputedStyle(pie).display !== 'none') {
        var invasion = window.innerHeight - pie.getBoundingClientRect().top;
        if (invasion > 0) px = Math.round(invasion);
      }

      // Nada que hacer si no ha cambiado: se ahorra tocar el DOM en la
      // inmensa mayoría de los fotogramas.
      if (px === ultimo) return;
      ultimo = px;

      for (var i = 0; i < botones.length; i++) {
        // translate3d y no translateY: mantiene el botón en su propia capa
        // del compositor, así moverlo no repinta nada de alrededor.
        botones[i].style.transform = px ? 'translate3d(0,' + (-px) + 'px,0)' : '';
      }
    }

    function pedir() {
      if (pedido) return;
      pedido = true;
      requestAnimationFrame(medir);
    }

    // El scroll real ocurre en .main, no en la ventana (ver topbar.css).
    if (scroller) scroller.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    // Cambiar de vista cambia el alto de la página y, con él, la invasión.
    document.addEventListener('click', pedir, true);

    // Una sola medida al arrancar NO basta: se toma antes de que la página
    // termine de componerse (imágenes de las tarjetas, tipografía) y deja
    // un valor viejo que dispara los botones fuera de sitio. El
    // ResizeObserver vuelve a medir cada vez que cambia el alto real, y es
    // además lo que detecta que el pie aparece al confirmarse la sesión.
    window.addEventListener('load', pedir);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(pedir);
      ro.observe(pie);
      if (scroller) ro.observe(scroller);
      var contenido = document.querySelector('.content');
      if (contenido) ro.observe(contenido);
    }

    pedir();
  }

  Consultia.initFooter = function () {
    // Año del copyright. Se pone desde JS para que no envejezca solo:
    // el HTML trae 2026 escrito como respaldo por si esto no corriera.
    var year = document.getElementById('footYear');
    if (year) year.textContent = String(new Date().getFullYear());

    anclarFlotantes();
  };
})();
