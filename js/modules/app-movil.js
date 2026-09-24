/* ============================================================
   LA APP EN EL TELÉFONO — comportamiento

   Dos piezas, las dos solo bajo 768px:

   1. La barra de destinos de abajo. Sus botones llevan data-nav, así
      que quien navega sigue siendo views.js: aquí no hay un segundo
      sistema de navegación, solo otra manera de tocarlo. Lo único que
      se hace es encender el destino que corresponde a la vista
      visible, y para eso se MIRA el DOM (qué sección dejó de estar
      oculta) en vez de recordar el último clic: así acierta también
      cuando se navega desde el menú lateral, desde un atajo del inicio
      o con el botón atrás del navegador.

   2. La pantalla «Consultas»: todo el catálogo en una sola lista con
      buscador. En el escritorio las consultas están repartidas en
      nueve pestañas del menú lateral; en un teléfono eso significa
      abrir el cajón, encontrar la categoría y acordarse de en cuál
      estaba «Boleta Informativa». Aquí se escribe «boleta» y sale.

   Al tocar una consulta NO se reimplementa nada: se navega a la vista
   de su categoría y se pulsa por código su opción del desplegable, que
   es el mismo nodo que pulsaría el dedo. El cobro, las validaciones y
   el pintado del resultado siguen donde estaban.

   Lo que NO hace, a propósito:
   · No enfoca el campo al llegar. Levantar el teclado solo ya se
     corrigió una vez en este proyecto y no se vuelve atrás.
   · No muestra las consultas «premium»: hoy no tienen pantalla en
     app.html (premium.js no encuentra sus IDs), así que ofrecerlas
     sería mandar al cliente a una puerta que no existe.
============================================================ */

(function () {
  'use strict';
  window.Consultia = window.Consultia || {};

  var ASPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="9 6 15 12 9 18"/></svg>';

  /* Categorías que SÍ tienen pantalla en app.html, en el orden en que
     se enseñan. El nombre de la categoría es también el prefijo de los
     IDs de su vista (vehiculosComboPanel, vehiculos-input…). */
  var CATEGORIAS = [
    { id: 'filter',     titulo: 'Consulta vehicular' },
    { id: 'vehiculos',  titulo: 'Vehículos' },
    { id: 'reniec',     titulo: 'Reniec' },
    { id: 'sunarp',     titulo: 'Sunarp' },
    { id: 'telefonia',  titulo: 'Telefonía' },
    { id: 'familiares', titulo: 'Familia' },
    { id: 'financiero', titulo: 'Financiero' },
    { id: 'delitos',    titulo: 'Justicia' },
    { id: 'extras',     titulo: 'Extras' }
  ];

  var DATO = {
    placa: 'Placa',
    dni: 'DNI',
    telefono: 'Teléfono',
    ruc: 'RUC',
    nombre: 'Nombre',
    texto: 'Dato',
    correo: 'Correo',
    ce: 'Carné de extranjería'
  };

  /* Los destinos de la barra de abajo y qué vistas encienden cada uno.
     Todo lo que sea consultar —cualquier categoría, el inicio, las
     regiones— enciende «Consultas»: es donde está el cliente aunque la
     vista se llame de otra manera. */
  var DESTINOS = [
    { nav: 'consultas', vistas: ['consultas', 'filter', 'dashboard', 'regiones', 'premium',
                                 'vehiculos', 'reniec', 'sunarp', 'telefonia', 'familiares',
                                 'financiero', 'delitos', 'extras', 'laboral'] },
    { nav: 'historial', vistas: ['historial'] },
    { nav: 'saldo',     vistas: ['saldo', 'compras'] },
    { nav: 'cuenta',    vistas: ['cuenta', 'configuracion', 'notificaciones'] }
  ];

  var catalogo = [];
  var pintado = false;

  function $(id) { return document.getElementById(id); }

  function esMovil() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Sin tildes y en minúsculas: quien escribe «revision» tiene que
     encontrar «Revisión», y «SOAT» no puede depender de las mayúsculas. */
  function llano(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /* ── 1 · La barra de destinos ─────────────────────────────── */

  function marcarDestino() {
    var barra = $('movTabbar');
    if (!barra) return;
    var visible = document.querySelector('.view:not([hidden])');
    var slug = visible ? visible.id.replace(/^view-/, '') : '';
    var tabs = barra.querySelectorAll('.mov-tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      var destino = null;
      for (var i = 0; i < DESTINOS.length; i++) {
        if (DESTINOS[i].nav === tab.dataset.nav) { destino = DESTINOS[i]; break; }
      }
      var activo = !!destino && destino.vistas.indexOf(slug) !== -1;
      tab.classList.toggle('is-active', activo);
      if (activo) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
  }

  /* Se vigila el atributo `hidden` de las secciones: es lo que mueve
     views.js al cambiar de pantalla, venga el cambio de donde venga. */
  function vigilarVistas() {
    var zona = document.querySelector('.content') || document.body;
    if (window.MutationObserver) {
      new MutationObserver(marcarDestino).observe(zona, {
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden']
      });
    }
    window.addEventListener('popstate', marcarDestino);
    marcarDestino();
  }

  /* ── 2 · La pantalla de consultas ─────────────────────────── */

  function tarjeta(c) {
    var dato = DATO[c.tipo_dato] || 'Dato';
    var precio = (typeof c.precio_venta === 'number')
      ? c.precio_venta + ' crédito' + (c.precio_venta === 1 ? '' : 's')
      : '';
    var meta = precio ? dato + ' · ' + precio : dato;
    return '<button class="mov-item" type="button" data-id="' + esc(c.id) + '">' +
      '<span class="mov-item-txt">' +
        '<span class="mov-item-nombre">' + esc(c.nombre) + '</span>' +
        '<span class="mov-item-meta">' + esc(meta) + '</span>' +
      '</span>' +
      '<span class="mov-item-chev">' + CHEV + '</span>' +
    '</button>';
  }

  function pintarLista(filtro) {
    var lista = $('movLista');
    if (!lista) return;
    var q = llano(filtro || '').trim();
    var html = '';
    var total = 0;

    CATEGORIAS.forEach(function (cat) {
      var items = catalogo.filter(function (c) {
        if (c.categoria !== cat.id) return false;
        if (!q) return true;
        return llano(c.nombre).indexOf(q) !== -1 ||
               llano(c.descripcion).indexOf(q) !== -1 ||
               llano(DATO[c.tipo_dato] || '').indexOf(q) !== -1;
      });
      if (!items.length) return;
      total += items.length;
      html += '<h3 class="mov-grupo-titulo">' + esc(cat.titulo) + '</h3>' +
        '<div class="mov-lista-grupo">' + items.map(tarjeta).join('') + '</div>';
    });

    if (!total) {
      html = '<p class="mov-vacio">No hay ninguna consulta que se llame así. ' +
        'Prueba con «placa», «DNI» o «SOAT».</p>';
    }
    lista.innerHTML = html;
  }

  /* Abrir una consulta = ir a su pantalla y pulsar su opción. La opción
     es el nodo que ya creó su módulo, con su click colgado: por eso se
     pulsa y no se copia. Si el catálogo de esa pantalla todavía no ha
     llegado, se reintenta un momento antes de rendirse. */
  function abrir(c) {
    var slug = c.categoria;
    var navBtn = document.querySelector('[data-nav="' + slug + '"]');
    if (!navBtn) return;
    navBtn.click();

    var intentos = 0;
    (function elegir() {
      var opcion = document.querySelector(
        '#' + slug + 'ComboPanel .combo-option[data-id="' + c.id + '"]');
      if (opcion) {
        opcion.click();
        var combo = $(slug + 'Combo');
        if (combo) combo.classList.remove('open');
        window.scrollTo(0, 0);
        return;
      }
      if (++intentos < 20) setTimeout(elegir, 150);
    })();
  }

  function cargar() {
    if (pintado) return;
    var lista = $('movLista');
    if (!lista || !Consultia.ConsultaRunner) return;
    Consultia.ConsultaRunner.loadCatalog().then(function (todas) {
      catalogo = (todas || []).filter(function (c) {
        for (var i = 0; i < CATEGORIAS.length; i++) {
          if (CATEGORIAS[i].id === c.categoria) return true;
        }
        return false;
      });
      pintado = true;
      pintarLista('');
    }).catch(function (e) {
      console.error('[app-movil] no se pudo cargar el catálogo:', e);
      lista.innerHTML = '<p class="mov-vacio">No se pudo cargar la lista de consultas. ' +
        'Revisa tu conexión y vuelve a entrar.</p>';
    });
  }

  /* En pantalla grande la lista de consultas esta en display:none, asi
     que si alguien llega con #consultas desde el telefono —o gira a un
     monitor— se quedaria mirando una pagina en blanco. Se le devuelve a
     la pantalla principal, que es donde estan sus consultas.

     Se comprueba cuando la pantalla se hace visible —no una sola vez al
     arrancar—: views.js decide la vista inicial dentro de su propio
     arranque, que puede terminar despues que este modulo. */
  function cuidarElEscritorio() {
    if (esMovil()) return;
    var vista = $('view-consultas');
    if (!vista || vista.hidden) return;
    var inicio = document.querySelector('[data-nav="filter"]');
    if (inicio) inicio.click();
  }

  /* El buscador se queda pegado arriba mientras se desplaza la lista,
     y tiene que quedarse DEBAJO de la barra de la aplicacion. Su alto
     no es fijo —cambia si hay sesion o no—, asi que se mide. */
  function medirBarraDeArriba() {
    var top = document.querySelector('.topbar');
    var alto = top ? Math.round(top.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--mov-arriba', alto + 'px');
  }

  function conectar() {
    vigilarVistas();
    medirBarraDeArriba();
    window.addEventListener('resize', medirBarraDeArriba);
    window.addEventListener('load', medirBarraDeArriba);
    window.addEventListener('resize', cuidarElEscritorio);

    var buscador = $('movBuscar');
    var caja = $('movBuscarCaja');
    var limpiar = $('movBuscarLimpiar');

    if (limpiar && !limpiar.innerHTML.trim()) limpiar.innerHTML = ASPA;

    if (buscador) {
      buscador.addEventListener('input', function () {
        if (caja) caja.classList.toggle('tiene-texto', !!buscador.value);
        pintarLista(buscador.value);
      });
      /* Enter cierra el teclado en vez de enviar nada: aquí no hay
         formulario que enviar, y dejarlo abierto tapa media lista. */
      buscador.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); buscador.blur(); }
      });
    }

    if (limpiar) limpiar.addEventListener('click', function () {
      if (!buscador) return;
      buscador.value = '';
      if (caja) caja.classList.remove('tiene-texto');
      pintarLista('');
      buscador.focus();
    });

    var lista = $('movLista');
    if (lista) lista.addEventListener('click', function (e) {
      var item = e.target.closest ? e.target.closest('.mov-item') : null;
      if (!item) return;
      for (var i = 0; i < catalogo.length; i++) {
        if (catalogo[i].id === item.dataset.id) { abrir(catalogo[i]); return; }
      }
    });

    /* El catálogo se pide cuando hace falta: al abrir la pantalla de
       consultas, y no antes, para no competir con la primera pantalla. */
    var vista = $('view-consultas');
    if (vista && window.MutationObserver) {
      new MutationObserver(function () {
        if (vista.hidden) return;
        cargar();
        cuidarElEscritorio();
        /* Si entre medias hubo un inicio de sesion, la barra de arriba
           aparece y cambia de alto sin que nadie redimensione nada. */
        medirBarraDeArriba();
      }).observe(vista, { attributes: true, attributeFilter: ['hidden'] });
    }
    if (vista && !vista.hidden) { cargar(); cuidarElEscritorio(); }
    if (esMovil()) cargar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', conectar);
  } else {
    conectar();
  }
})();
