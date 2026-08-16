/* ============================================================
   PIE DE PÁGINA — año y botón de soporte

   Lo justo: los enlaces de navegación ya los conecta views.js por
   data-nav, y los legales overlays.js por data-modal. Aquí solo queda
   lo que ninguno de los dos cubre.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  /* Los dos botones flotantes —el CTA "Obtén tu reporte" y el de WhatsApp—
     son position:fixed, así que sin ayuda se quedan pegados al borde de la
     ventana y acaban montados sobre el pie al llegar al final.

     Aquí se calcula cuánto pie asoma dentro de la ventana y se sube esa
     misma cantidad, de modo que los botones se FRENAN justo encima del pie
     en vez de invadirlo. Como el desplazamiento es exactamente la invasión,
     cada botón conserva su separación propia (el CTA sus 24px, el de
     WhatsApp sus 80px) medida ahora contra el borde del pie.

     Se publica como variable CSS y no como estilo directo para que el
     movimiento lo haga el compositor y no haya que tocar dos elementos. */
  function anclarFlotantes() {
    var pie = document.querySelector('.site-footer');
    if (!pie) return;

    var pedido = false;

    function medir() {
      pedido = false;
      // Si el pie está oculto (sin sesión) no hay nada que esquivar.
      if (getComputedStyle(pie).display === 'none') {
        document.documentElement.style.setProperty('--fv-lift', '0px');
        return;
      }
      var borde = pie.getBoundingClientRect().top;
      var invasion = Math.max(0, window.innerHeight - borde);
      document.documentElement.style.setProperty('--fv-lift', Math.round(invasion) + 'px');
    }

    function pedir() {
      if (pedido) return;
      pedido = true;
      requestAnimationFrame(medir);
    }

    // El scroll real ocurre en .main, no en la ventana (ver topbar.css).
    var scroller = document.querySelector('.main');
    if (scroller) scroller.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    // Cambiar de vista cambia el alto de la página y, con él, la invasión.
    document.addEventListener('click', pedir, true);

    // Una sola medida al arrancar NO basta: se toma antes de que la página
    // termine de componerse (imágenes de las tarjetas, tipografía) y deja
    // un valor viejo enorme que dispara los botones hasta arriba. El
    // ResizeObserver vuelve a medir cada vez que cambia el alto real.
    window.addEventListener('load', pedir);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(pedir);
      ro.observe(pie);
      if (scroller) ro.observe(scroller);
      var contenido = document.querySelector('.content');
      if (contenido) ro.observe(contenido);
    }

    medir();
  }

  Consultia.initFooter = function () {
    // Año del copyright. Se pone desde JS para que no envejezca solo:
    // el HTML trae 2026 escrito como respaldo por si esto no corriera.
    var year = document.getElementById('footYear');
    if (year) year.textContent = String(new Date().getFullYear());

    // El botón de soporte reutiliza el flotante de WhatsApp en vez de
    // abrir un enlace directo: así el cliente ve las mismas opciones
    // que desde el botón redondo, y la lista vive en un solo sitio
    // (js/modules/whatsapp-support.js).
    anclarFlotantes();

    var btn = document.getElementById('footWhatsapp');
    var fab = document.getElementById('waSupport');
    if (btn && fab) {
      btn.addEventListener('click', function (e) {
        // stopPropagation NO es adorno: whatsapp-support.js vigila los
        // clics en `document` para cerrar el menú al tocar fuera. Sin
        // esto, el clic abre el menú vía fab.click() y acto seguido sigue
        // subiendo hasta ese vigilante, que lo ve caído fuera del FAB y lo
        // cierra en el mismo gesto — el menú parpadeaba y no se abría.
        e.stopPropagation();
        fab.click();
      });
    }
  };
})();
