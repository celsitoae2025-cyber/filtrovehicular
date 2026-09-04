/* ============================================================
   EL DESPLEGABLE DE TIPO DE CONSULTA

   El cuadro que se abría era una lista pelada: veintitantas líneas de
   texto, sin título, sin manera de buscar y sin nada que dijera cuál
   está elegida salvo un gris muy flojo. Para encontrar «Certificado
   SOAT (PDF)» había que leerlas todas y desplazar.

   Esto le pone lo que le faltaba, y lo hace SIN tocar a quien pinta las
   opciones. filter.js y category-view.js siguen escribiendo sus
   `.combo-option` en el panel como siempre; aquí se detecta que han
   escrito y se reordena lo que ya hay:

     · una cabecera fija con el rótulo y el buscador
     · las opciones, movidas —no recreadas— dentro de una lista que se
       desplaza sola

   Que se MUEVAN y no se copien es la clave: son los mismos nodos, así
   que los `click` que les colgó su módulo siguen funcionando. Si se
   clonaran, el desplegable dejaría de seleccionar nada.

   Lo demás es teclado: al abrir, el cursor va al buscador; se escribe
   para filtrar, se sube y se baja con las flechas y se elige con Enter.
   Sin ratón, de principio a fin.
============================================================ */
(function () {
  'use strict';

  var LUPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"' +
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

  var ASPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M18 6 6 18M6 6l12 12"/></svg>';

  /* Sin tildes y en minúsculas: quien busca «revision» tiene que
     encontrar «Revisión», y quien busca «SOAT» no debe depender de las
     mayúsculas. */
  function llano(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function cabeceraHTML() {
    return '<div class="cbx-head">' +
        '<span class="cbx-title">Elige una consulta</span>' +
        '<div class="cbx-search">' +
          '<span class="cbx-search-ico">' + LUPA + '</span>' +
          '<input type="text" class="cbx-input" name="cbxBuscarConsulta"' +
            ' placeholder="Buscar por nombre…" autocomplete="off" autocapitalize="off"' +
            ' spellcheck="false" inputmode="search" enterkeyhint="search"' +
            ' data-lpignore="true" data-form-type="other" aria-label="Buscar consulta">' +
          '<button type="button" class="cbx-clear" hidden aria-label="Borrar la búsqueda">' + ASPA + '</button>' +
        '</div>' +
      '</div>';
  }

  /* Reordena un panel recién pintado. Es idempotente: si ya lleva su
     cabecera, no hace nada, porque el observador salta también con los
     cambios que provoca esta misma función. */
  function montar(panel) {
    if (!panel || panel.querySelector(':scope > .cbx-head')) return;

    var sueltas = [];
    for (var i = 0; i < panel.children.length; i++) {
      var n = panel.children[i];
      if (n.classList && (n.classList.contains('combo-option') || n.classList.contains('combo-empty'))) {
        sueltas.push(n);
      }
    }
    if (!sueltas.length) return;

    var lista = document.createElement('div');
    lista.className = 'cbx-list';
    lista.setAttribute('role', 'listbox');
    sueltas.forEach(function (o) { lista.appendChild(o); });

    var vacio = document.createElement('p');
    vacio.className = 'cbx-vacio';
    vacio.hidden = true;
    vacio.textContent = 'Ninguna consulta se llama así.';

    panel.insertAdjacentHTML('afterbegin', cabeceraHTML());
    panel.appendChild(lista);
    panel.appendChild(vacio);

    var input = panel.querySelector('.cbx-input');
    var borrar = panel.querySelector('.cbx-clear');

    function filtrar() {
      var q = llano(input.value.trim());
      var vistas = 0;
      lista.querySelectorAll('.combo-option').forEach(function (o) {
        var ok = !q || llano(o.textContent).indexOf(q) !== -1;
        o.hidden = !ok;
        o.classList.remove('is-activa');
        if (ok) vistas++;
      });
      vacio.hidden = vistas > 0;
      borrar.hidden = !input.value;
      lista.scrollTop = 0;
    }

    input.addEventListener('input', filtrar);
    borrar.addEventListener('click', function () {
      input.value = '';
      filtrar();
      input.focus();
    });

    /* El buscador no cierra el desplegable ni lo selecciona: se traga el
       clic para que el manejador de «clic fuera» no lo confunda con un
       clic en la página. */
    panel.querySelector('.cbx-head').addEventListener('click', function (e) { e.stopPropagation(); });

    input.addEventListener('keydown', function (e) {
      var visibles = [].slice.call(lista.querySelectorAll('.combo-option')).filter(function (o) { return !o.hidden; });
      if (!visibles.length) return;
      var act = lista.querySelector('.combo-option.is-activa');
      var idx = visibles.indexOf(act);

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        idx = e.key === 'ArrowDown'
          ? (idx + 1 >= visibles.length ? 0 : idx + 1)
          : (idx <= 0 ? visibles.length - 1 : idx - 1);
        visibles.forEach(function (o) { o.classList.remove('is-activa'); });
        visibles[idx].classList.add('is-activa');
        visibles[idx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        (visibles[idx] || visibles[0]).click();
      } else if (e.key === 'Escape') {
        if (input.value) { e.stopPropagation(); input.value = ''; filtrar(); }
      }
    });

    panel.__cbxReset = function () {
      input.value = '';
      filtrar();
      /* EL FOCO, SOLO CON RATÓN.

         En el ordenador poner el cursor en el buscador al abrir es un
         regalo: se abre y ya se puede escribir.

         En el teléfono es lo contrario. Enfocar un campo levanta el
         teclado, y el teclado se come media pantalla: el cliente abre la
         lista para VERLA y se encuentra tres opciones y un teclado
         encima. El buscador sigue estando; se usa cuando se toca, que es
         cuando de verdad se quiere escribir.

         Se distingue por el puntero, no por el ancho de la ventana: lo
         que decide es si hay ratón, no cuántos píxeles mide la pantalla.

         El foco se intenta dos veces porque el panel tarda 180ms en
         pasar de `visibility: hidden` a visible, y un elemento invisible
         no acepta el cursor. */
      var conRaton = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (conRaton) {
        var poner = function () { try { input.focus({ preventScroll: true }); } catch (e) {} };
        requestAnimationFrame(poner);
        setTimeout(poner, 220);
      }
      var sel = lista.querySelector('.combo-option.selected');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    };
  }

  function vigilar(panel) {
    montar(panel);
    new MutationObserver(function () { montar(panel); })
      .observe(panel, { childList: true });
  }

  function arrancar() {
    document.querySelectorAll('.combo-panel').forEach(vigilar);

    /* Al abrir: limpiar lo escrito la vez anterior y poner el cursor en
       el buscador. El desplegable se abre añadiendo `open` al .combo. */
    document.querySelectorAll('.combo').forEach(function (combo) {
      new MutationObserver(function () {
        if (!combo.classList.contains('open')) return;
        var panel = combo.querySelector('.combo-panel');
        if (panel && panel.__cbxReset) panel.__cbxReset();
      }).observe(combo, { attributes: true, attributeFilter: ['class'] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
})();
