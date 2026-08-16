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

  /* ── El alto REAL de la barra superior ──

     `--topbar-h` estaba escrito a mano en base.css como 71px, y de ese
     valor depende el `min-height` de `.content` (footer.css): es lo que
     hace que el ultimo panel termine justo en el borde inferior de lo
     visible, ni antes ni despues.

     71px era cierto solo en escritorio. mobile.css le baja el relleno a
     la barra de 14px a 10px, y polish.css otro tanto, asi que en un
     telefono la barra mide unos 8px menos — y ademas cambia con el
     tamano de letra del sistema y con los propios botones que lleva
     dentro. Con el numero fijo, en cada telefono la tarjeta se pasaba o
     se quedaba corta por unos pocos pixeles.

     Aqui se mide la barra tal como ha quedado pintada y se publica su
     alto en la variable. Se remide al girar el telefono, al cambiar el
     tamano de la ventana y cada vez que la propia barra cambia de alto.
     Asi la cuenta sale bien en cualquier pantalla sin listas de
     tamanos ni consultas de medios que mantener.

     Escribir una custom property en :root obliga al navegador a revisar
     el estilo de todo el documento, que es caro; por eso solo se escribe
     cuando el valor CAMBIA, y esto no ocurre al desplazarse. */
  function medirBarraSuperior() {
    var barra = document.querySelector('.topbar');
    if (!barra) return;
    var ultimo = -1;

    function medir() {
      var alto = Math.round(barra.getBoundingClientRect().height);
      if (!alto || alto === ultimo) return;
      ultimo = alto;
      document.documentElement.style.setProperty('--topbar-h', alto + 'px');
    }

    medir();
    // Una sola medida al arrancar no basta: se toma antes de que acabe
    // de cargar la tipografia, y la barra crece unos pixeles despues.
    window.addEventListener('load', medir);
    window.addEventListener('resize', medir);
    window.addEventListener('orientationchange', medir);
    if (window.ResizeObserver) new ResizeObserver(medir).observe(barra);
  }

  Consultia.initFooter = function () {
    medirBarraSuperior();

    // Año del copyright. Se pone desde JS para que no envejezca solo:
    // el HTML trae 2026 escrito como respaldo por si esto no corriera.
    var year = document.getElementById('footYear');
    if (year) year.textContent = String(new Date().getFullYear());

  };
})();
