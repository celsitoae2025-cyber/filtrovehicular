/* ============================================================
   PIE DE PÁGINA — año y botón de soporte

   Lo justo: los enlaces de navegación ya los conecta views.js por
   data-nav, y los legales overlays.js por data-modal. Aquí solo queda
   lo que ninguno de los dos cubre.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  Consultia.initFooter = function () {
    // Año del copyright. Se pone desde JS para que no envejezca solo:
    // el HTML trae 2026 escrito como respaldo por si esto no corriera.
    var year = document.getElementById('footYear');
    if (year) year.textContent = String(new Date().getFullYear());

    // El botón de soporte reutiliza el flotante de WhatsApp en vez de
    // abrir un enlace directo: así el cliente ve las mismas opciones
    // que desde el botón redondo, y la lista vive en un solo sitio
    // (js/modules/whatsapp-support.js).
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
