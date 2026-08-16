/* ============================================================
   MENÚ LATERAL — grupo plegable "Consultas por categoría"

   Las nueve categorías (Reniec, Familia, Telefonía, Sunarp, Vehículos,
   Sunat, Financiero, Justicia y Extras) dejaron de estar sueltas: viven
   dentro de un grupo que arranca CERRADO. El menú pasa de once entradas
   visibles a tres y el catálogo queda a un clic.

   Lo único que guarda es si el grupo quedó abierto, en localStorage. Si
   el navegador no deja escribir (modo privado en algunos casos) el grupo
   sigue funcionando: simplemente vuelve a arrancar cerrado.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var CLAVE = 'fv.navCatOpen';

  function leer() {
    try { return localStorage.getItem(CLAVE) === '1'; } catch (e) { return false; }
  }

  function guardar(abierto) {
    try { localStorage.setItem(CLAVE, abierto ? '1' : '0'); } catch (e) { /* sin memoria, no pasa nada */ }
  }

  Consultia.initNavGroup = function () {
    var head  = document.getElementById('navCatToggle');
    var group = document.getElementById('navCatGroup');
    if (!head || !group) return;

    /* La cabecera NO usa la clase .open, que es la de los submenús: tanto
       el colapso del sidebar como el botón "Inicio" del breadcrumb hacen
       un barrido de `.nav-item.open` para cerrarlos, y se llevarían por
       delante el chevrón dejándolo apuntando al revés del grupo. */
    function aplicar(abierto) {
      group.classList.toggle('open', abierto);
      head.classList.toggle('is-open', abierto);   // gira el chevrón
      head.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    }

    aplicar(leer());

    /* Solo el clic en la cabecera se recuerda: es la única vez que el
       usuario dice lo que quiere. Las aperturas automáticas de abajo no
       tocan localStorage. */
    head.addEventListener('click', function () {
      var abierto = !group.classList.contains('open');
      aplicar(abierto);
      guardar(abierto);
    });

    /* Si se entra a una categoría sin pasar por la cabecera, el grupo se
       abre solo: si no, la entrada marcada como activa se quedaría
       escondida dentro de un grupo cerrado y el menú no diría dónde
       está uno.

       Se vigila la clase .active en vez de los clics porque a una
       categoría se llega por muchos caminos —el pie de página, los
       accesos rápidos del dashboard, el botón atrás del navegador, o
       directamente con la URL #sunarp al cargar— y views.js los resuelve
       todos poniendo esa clase. Vigilar el resultado los cubre todos;
       vigilar los clics dejaba fuera la mitad. */
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(function (registros) {
        /* Solo cuentan los cambios de clase de las categorías. El propio
           grupo también está vigilado —`subtree` incluye al elemento
           observado— y sin este filtro cerrarlo a mano no servía de
           nada: quitar .open era en sí una mutación, la categoría en la
           que estabas seguía marcada como activa, y el grupo se volvía a
           abrir en el acto. */
        var deCategoria = registros.some(function (r) { return r.target !== group; });
        if (!deCategoria) return;
        if (group.classList.contains('open')) return;
        if (!group.querySelector('.nav-item.active')) return;
        aplicar(true);
      }).observe(group, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  };
})();
