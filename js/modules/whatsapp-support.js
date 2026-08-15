/* ============================================================
   WHATSAPP SUPPORT — el FAB abre una lista de opciones y cada
   una le escribe al bot pidiendo esa opción concreta.

   El texto de cada enlace lleva dos cosas: la frase que activa al
   bot ("estoy en Filtro Vehicular+") y lo que el cliente quiere.
   El bot entiende ambas de una y responde directo esa opción, sin
   hacerle elegir otra vez en el menú del chat.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  // El orden y los textos son los que ve el cliente. La frase de la
  // derecha es la que se le manda al bot: cambiarla puede hacer que el
  // bot responda otra opción, así que conviene dejarla como está.
  var OPCIONES = [
    { n: 1, titulo: 'Cómo registrarme',        pide: 'quiero saber cómo registrarme' },
    { n: 2, titulo: 'Cómo recargar créditos',  pide: 'quiero saber cómo recargar créditos' },
    { n: 3, titulo: 'Precios de créditos',     pide: 'quiero ver los precios de los créditos' },
    { n: 4, titulo: 'Cómo hacer una consulta', pide: 'quiero saber cómo hacer una consulta' },
    { n: 5, titulo: 'Qué servicios ofrecen',   pide: 'quiero saber qué servicios ofrecen' },
    { n: 6, titulo: 'Hablar con un asesor',    pide: 'quiero hablar con un asesor' },
  ];

  function enlace(pide) {
    var msg = Consultia.greeting() + ', estoy en Filtro Vehicular+ y ' + pide + '.';
    return 'https://wa.me/' + Consultia.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  function pintar(menu) {
    var h = '<p class="wa-menu-titulo">¿En qué te ayudamos?</p>';
    OPCIONES.forEach(function (o) {
      h += '<a class="wa-menu-opcion" href="' + enlace(o.pide) + '"' +
           ' target="_blank" rel="noopener noreferrer">' +
           '<span class="wa-menu-n">' + o.n + '</span>' +
           '<span class="wa-menu-txt">' + o.titulo + '</span></a>';
    });
    menu.innerHTML = h;
  }

  Consultia.initWhatsappSupport = function () {
    var fab = document.getElementById('waSupport');
    var menu = document.getElementById('waMenu');
    if (!fab || !menu) return;

    pintar(menu);

    function abierto() {
      return fab.getAttribute('aria-expanded') === 'true';
    }

    function abrir() {
      // Los saludos dependen de la hora: se rearma al abrir, no al cargar,
      // por si la pestaña lleva horas abierta.
      pintar(menu);
      menu.hidden = false;
      fab.setAttribute('aria-expanded', 'true');
    }

    function cerrar() {
      menu.hidden = true;
      fab.setAttribute('aria-expanded', 'false');
    }

    fab.addEventListener('click', function (e) {
      e.preventDefault();
      if (abierto()) cerrar(); else abrir();
    });

    // Un clic fuera cierra. Se escucha en el documento, pero se ignora si
    // el clic cayó dentro del propio menú o del botón.
    document.addEventListener('click', function (e) {
      if (!abierto()) return;
      if (menu.contains(e.target) || fab.contains(e.target)) return;
      cerrar();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && abierto()) cerrar();
    });

    // Al elegir una opción se abre WhatsApp en otra pestaña; el menú no
    // tiene por qué quedarse abierto detrás.
    menu.addEventListener('click', function (e) {
      if (e.target.closest('.wa-menu-opcion')) cerrar();
    });
  };
})();
