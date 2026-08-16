/* ============================================================
   PIE DE PÁGINA — año del copyright

   Los enlaces de navegación ya los conecta views.js por data-nav, y los
   legales overlays.js por data-modal. Aquí solo queda lo que ninguno
   de los dos cubre.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  /* AQUI VIVIA EL FRENO DE LOS BOTONES FLOTANTES.

     El de WhatsApp se desplazaba hacia arriba cuando el pie asomaba,
     para que no acabara montado encima. Se retiro por peticion expresa:
     el boton tiene que estar QUIETO, sin moverse por nada.

     Si alguna vez se echa de menos, esta en el historial de git —vivia
     en una funcion `anclarFlotantes()`— pero no se repone sin pedirlo.
     Que el boton pase por delante del pie al llegar al final es el
     precio aceptado a cambio de que no se mueva nunca. */

  Consultia.initFooter = function () {
    // Año del copyright. Se pone desde JS para que no envejezca solo:
    // el HTML trae 2026 escrito como respaldo por si esto no corriera.
    var year = document.getElementById('footYear');
    if (year) year.textContent = String(new Date().getFullYear());

  };
})();
