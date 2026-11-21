/* ============================================================
   INTERFAZ NUEVA — las pantallas

   Cada pantalla tiene UN trabajo y no se pisa con otra:
     · Consultar  → elegir y lanzar.
     · Resumen    → cómo va la cuenta: saldo, métricas, gráfico de los
                    últimos 14 días y reparto por categoría. No lista
                    consultas: eso es el historial.
     · Historial  → el registro: cada consulta, agrupada por día, con
                    «Repetir» para volver a lanzarla.
     · Vehículos  → placas guardadas por el usuario para elegir otra consulta.
     · Pagos      → comprar créditos y ver los movimientos.
     · Cuenta     → tus datos y los accesos.

   Todo lee de la misma base que app.html y compra por el mismo camino
   ('crear-preferencia'). Cambia cómo se enseña, no lo que se cobra.
============================================================ */
(function () {
  'use strict';
  var C = window.Consultia = window.Consultia || {};
  var NV = C.NV;
  var $ = NV.$;
  var esc = NV.esc;

  var CORTO = {
    filter: 'Vehicular', vehiculos: 'Vehículos', reniec: 'Reniec', sunarp: 'Sunarp',
    telefonia: 'Telefonía', familiares: 'Familia', financiero: 'Financiero',
    delitos: 'Justicia', extras: 'Extras'
  };
  function nombreCat(k) { return CORTO[k] || NV.CATEGORIAS[k] || k || 'Consulta'; }

  function sb() { return C.supabase; }


  /* ============================================================
     CONSULTAR
     ============================================================ */

  var catalogo = [];
  var reporteDestacado = null;
  var textoBuscado = '';
  var datoPendiente = null;
  var ICONOS_CATEGORIA = {
    todas: 'resumen', filter: 'placa', vehiculos: 'vehiculo', reniec: 'reniec',
    sunarp: 'legal', telefonia: 'telefonia', familiares: 'familia', financiero: 'finanzas',
    delitos: 'justicia', extras: 'certificado', premium: 'rayo'
  };
  // Las variantes del mismo trámite comparten símbolo aunque pidan datos distintos.
  var ICONOS_CONSULTA = {
    '/mpla': 'reporte', '/metapla': 'reporte', '/boin': 'reporte',
    '/placa': 'placa', '/plai': 'placa', '/plab': 'placa',
    '/tiv': 'tarjeta-vehicular', '/tive': 'tarjeta-vehicular', '/tiveg': 'tarjeta-vehicular',
    '/lplaca': 'registro', '/ivehi': 'registro',
    '/soat': 'poliza', '/hsoat': 'historial-seguro', '/hsoat2': 'historial-seguro',
    '/citv': 'citv', '/mtc': 'reniec', '/mtcb': 'puntos', '/record': 'historial', '/reve': 'historial',
    '/csat': 'policia', '/sat': 'papeleta',
    '/sun': 'propiedad', '/sunb': 'propiedad', '/pro': 'propiedad', '/propdf': 'propiedad',
    '/dnit': 'reniec', '/dniv': 'reniec', '/dnivel': 'reniec', '/dnis': 'reniec', '/dnib': 'reniec', '/dox': 'reniec',
    '/nm': 'consultar', '/fab': 'cuenta', '/c4a': 'reporte', '/c4b': 'reporte', '/c4': 'reporte', '/c4i': 'certificado',
    '/telp': 'telefonia', '/lineas': 'telefonia', '/tels': 'telefonia', '/tel': 'telefonia', '/ode': 'telefonia',
    '/operador': 'sim', '/vlop': 'sim', '/port': 'sim', '/claro': 'sim', '/bitel': 'sim', '/movistar': 'sim', '/entel': 'sim',
    '/movn': 'sim', '/movd': 'sim', '/bitx': 'sim', '/bitd': 'sim', '/cl': 'sim', '/clw': 'sim', '/cld': 'sim', '/cldni': 'sim',
    '/dcl': 'finanzas', '/bnt': 'pagos', '/sbsvp': 'finanzas', '/sbs': 'finanzas',
    '/senti': 'finanzas', '/equix': 'finanzas', '/afp': 'finanzas',
    '/ag': 'arbol', '/agvp': 'arbol', '/fam': 'familia', '/hogar': 'propiedad',
    '/fiscapdf': 'justicia', '/fis': 'justicia', '/rq': 'justicia', '/rqv': 'justicia',
    '/denuncias': 'policia', '/denpla': 'policia', '/denun': 'policia', '/jne': 'papeleta',
    '/migra': 'migracion', '/migrace': 'migracion', '/minedu': 'educacion', '/sunedupdf': 'educacion', '/notas': 'educacion',
    '/cerjov': 'certificado', '/ceradu': 'certificado', '/cadult': 'certificado', '/const': 'certificado',
    '/cor': 'correo', '/sis': 'salud', '/essa2': 'salud', '/seg': 'salud',
    '/ruc': 'legal', '/rucn': 'legal', '/rucd': 'legal'
  };
  /* Arranca en Vehicular; las demás consultas siguen a un filtro o búsqueda. */
  var categoriaActiva = 'filter';
  NV.nombreCategoriaActiva = function () {
    return categoriaActiva === 'todas' ? 'Todas las consultas' : nombreCat(categoriaActiva);
  };

  function esReporteDestacado(c) {
    var cmd = (c && c.comando) || '';
    return cmd.indexOf('/mpla') === 0 || cmd.indexOf('/metapla') === 0;
  }
  function opcionesCatalogo() {
    return catalogo.filter(function (c) { return !esReporteDestacado(c); });
  }
  function totalCatalogo() { return opcionesCatalogo().length + (reporteDestacado ? 1 : 0); }
  function costo(c) {
    if (c.requires_subscription || c.categoria === 'premium') return 'Premium';
    return c.precio_venta + ' crédito' + (Number(c.precio_venta) === 1 ? '' : 's');
  }
  function datoNecesario(c) {
    return ({
      placa: 'Por placa', dni: 'Con DNI', telefono: 'Con teléfono',
      ruc: 'Con RUC', nombre: 'Por nombre', correo: 'Con correo',
      ce: 'Con carné de extranjería', foto: 'Con foto'
    })[c.tipo_dato] || 'Dato a ingresar';
  }
  function iconoCategoria(clave) {
    return Object.hasOwn(ICONOS_CATEGORIA, clave) ? ICONOS_CATEGORIA[clave] : 'reporte';
  }

  function pintarCategorias() {
    var cuenta = Object.create(null);
    opcionesCatalogo().forEach(function (c) {
      cuenta[c.categoria] = (cuenta[c.categoria] || 0) + 1;
    });
    if (reporteDestacado) cuenta[reporteDestacado.categoria] = (cuenta[reporteDestacado.categoria] || 0) + 1;
    var claves = NV.ORDEN.filter(function (k) { return cuenta[k]; });
    var otras = Object.keys(cuenta).filter(function (k) { return !NV.ORDEN.includes(k); });
    if (categoriaActiva !== 'todas' && !cuenta[categoriaActiva]) categoriaActiva = 'todas';
    if (NV.actualizarInicio) NV.actualizarInicio();
    var cantidadActiva = categoriaActiva === 'todas' ? totalCatalogo() : cuenta[categoriaActiva];
    $('nvCategoriaActual').textContent = categoriaActiva === 'todas' ? 'Todas las categorías' : nombreCat(categoriaActiva);
    $('nvCategoriaCuenta').textContent = cantidadActiva + ' consulta' + (cantidadActiva === 1 ? '' : 's');
    var contexto = $('nvCategoriaContexto');
    if (contexto) contexto.textContent = $('nvCategoriaActual').textContent + ' · ' + $('nvCategoriaCuenta').textContent;
    var lateral = $('nvCategoriasLado');
    if (lateral) lateral.innerHTML = ['todas'].concat(claves, otras).map(function (clave) {
      var nombre = clave === 'todas' ? 'Todas las consultas' : nombreCat(clave);
      return '<button type="button" class="nv-categoria-lado" data-cat="' + esc(clave) + '" aria-pressed="' +
        (clave === categoriaActiva) + '">' +
        '<svg aria-hidden="true"><use href="#fv-' + iconoCategoria(clave) + '"/></svg>' +
        '<span>' + esc(nombre) + '</span></button>';
    }).join('');
    if (lateral) {
      var lado = lateral.closest('.nv-lado');
      if (lado) lado.style.setProperty('--nv-lado-cantidad', String(lateral.children.length + lado.querySelectorAll('.nv-nav:not([hidden])').length));
    }
    $('nvCategoriaOpciones').innerHTML = ['todas'].concat(claves, otras).map(function (clave) {
      var todas = clave === 'todas';
      var cantidad = todas ? totalCatalogo() : cuenta[clave];
      var nombre = todas ? 'Todas las categorías' : nombreCat(clave);
      var icono = iconoCategoria(clave);
      var activa = clave === categoriaActiva;
      return '<button type="button" class="nv-categoria-opcion" data-cat="' + esc(clave) +
        '" aria-pressed="' + activa + '" aria-label="' + esc(nombre + ', ' + cantidad +
        (cantidad === 1 ? ' consulta' : ' consultas')) + '">' +
        '<svg class="nv-categoria-icono" aria-hidden="true"><use href="#fv-' + icono + '"/></svg>' +
        '<span class="nv-categoria-nombre">' + esc(nombre) + '</span>' +
        '<small class="nv-categoria-numero">' + cantidad + '</small>' +
        '<svg class="nv-categoria-marca" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>' +
        '</button>';
    }).join('');
  }

  function iconoConsulta(c) {
    var comando = (c.comando || '').trim().toLowerCase().split(/\s+/, 1)[0];
    return c.accion === 'citv' ? 'citv' : (Object.hasOwn(ICONOS_CONSULTA, comando) ? ICONOS_CONSULTA[comando] : iconoCategoria(c.categoria));
  }
  NV.iconoConsulta = iconoConsulta;

  function filaCatalogo(c) {
    var icono = iconoConsulta(c);
    return '<button type="button" class="nv-op" data-id="' + esc(c.id) + '">' +
      '<span class="nv-op-ico" aria-hidden="true"><svg><use href="#fv-' + icono + '"/></svg></span>' +
      '<span class="nv-op-principal"><span class="nv-op-nombre">' + esc(c.nombre) + '</span>' +
        '<span class="nv-op-dato">' + esc(datoNecesario(c)) + '</span></span>' +
    '</button>';
  }

  function grupoCatalogo(consultas) {
    return '<div class="nv-catalogo-filas">' + consultas.map(filaCatalogo).join('') + '</div>';
  }

  function pintarCatalogo() {
    var q = NV.llano(textoBuscado.trim());
    var reporteVisible = !!(reporteDestacado &&
      (categoriaActiva === 'todas' || categoriaActiva === reporteDestacado.categoria) &&
      (!q || NV.llano(reporteDestacado.nombre + ' Reporte completo').indexOf(q) !== -1));
    var lista = opcionesCatalogo().filter(function (c) {
      if (categoriaActiva !== 'todas' && c.categoria !== categoriaActiva) return false;
      return !q || NV.llano(c.nombre + ' ' + nombreCat(c.categoria)).indexOf(q) !== -1;
    });
    var totalResultados = lista.length + (reporteVisible ? 1 : 0);
    $('nvCatalogoTitulo').textContent = q ? 'Resultados de búsqueda' : 'Consultas disponibles';
    $('nvCatalogoInfo').textContent = totalResultados + ' resultado' + (totalResultados === 1 ? '' : 's');
    $('nvAbrirBusqueda').classList.toggle('tiene-busqueda', Boolean(q));
    $('nvLimpiarBusqueda').hidden = !textoBuscado;
    $('ctaReporteBtn').hidden = !reporteVisible;
    var contenido = lista.length ? grupoCatalogo(lista) : '';
    if (!lista.length && !reporteVisible) contenido = '<p class="nv-vacio">Sin coincidencias. Prueba otra palabra o categoría.</p>';
    $('nvCatalogo').innerHTML = contenido;
    marcarElegida();
  }

  function marcarElegida() {
    var sel = document.querySelector('#filterComboPanel .combo-option.selected');
    var id = !$('nvConsultaSeleccion').hidden && sel ? sel.dataset.id : '';
    document.querySelectorAll('.nv-op').forEach(function (b) {
      b.classList.toggle('es-elegida', b.dataset.id === id);
    });
  }

  function filtrarDesplegable() {
    var panel = $('filterComboPanel');
    if (!panel) return;
    var porId = {};
    catalogo.forEach(function (c) { porId[c.id] = c.categoria; });
    panel.querySelectorAll('.combo-option').forEach(function (o) {
      o.classList.toggle('nv-fuera', categoriaActiva !== 'todas' && porId[o.dataset.id] !== categoriaActiva);
    });
    panel.querySelectorAll('.combo-grupo').forEach(function (g) {
      g.classList.toggle('nv-fuera', categoriaActiva !== 'todas' && g.textContent.trim() !== NV.CATEGORIAS[categoriaActiva]);
    });
  }

  /* Elegir una consulta reemplaza la lista por el formulario compacto. */
  function mostrarBuscador(item) {
    var caja = $('nvBuscador');
    var abriendo = caja && caja.hidden;
    if (abriendo) caja.hidden = false;
    $('nvSeleccionNombre').textContent = item ? item.nombre : $('filterComboText').textContent;
    $('nvSeleccionCosto').textContent = item ? 'Costo: ' + costo(item) : '';
    $('nvExplorar').hidden = true;
    $('nvConsultaSeleccion').hidden = false;
    /* Elegir una consulta es un paso atrás desde el catálogo: sin esta
       entrada, el «atrás» del navegador sacaba de la plataforma. */
    if (abriendo && NV.abrirCapa) NV.abrirCapa('consulta', volverAlCatalogo);
    if (NV.actualizarInicio) NV.actualizarInicio();
  }

  /* Atrás desde una consulta elegida: se vuelve al catálogo, no fuera. */
  function volverAlCatalogo() {
    if (C.FilterView && C.FilterView.resetResult) C.FilterView.resetResult();
    var caja = $('nvBuscador');
    if (caja) caja.hidden = true;
    $('filter-input').value = '';
    $('nvConsultaSeleccion').hidden = true;
    $('nvExplorar').hidden = false;
    if (NV.actualizarModoNombre) NV.actualizarModoNombre(null);
    var res = $('filter-result');
    if (res) res.hidden = true;
    if (NV.actualizarInicio) NV.actualizarInicio();
  }
  NV.volverAlCatalogo = volverAlCatalogo;
  NV.mostrarBuscador = mostrarBuscador;

  function elegir(id) {
    var item = catalogo.find(function (c) { return c.id === id; });
    if (item && item.accion === 'citv') {
      if (C.CitvAviso && C.CitvAviso.abrir) C.CitvAviso.abrir();
      return;
    }
    if (C.setFilterOption) item = C.setFilterOption(id) || item;
    var combo = $('filterCombo');
    if (combo) combo.classList.remove('open');
    marcarElegida();
    mostrarBuscador(item);
    if (NV.actualizarModoNombre) NV.actualizarModoNombre(item);
    if (datoPendiente) {
      if (item && item.categoria === (datoPendiente.categoria === 'vehiculos' ? 'filter' : datoPendiente.categoria) &&
          item.tipo_dato === datoPendiente.tipo &&
          !(item.comando && item.comando.indexOf('/nm') === 0)) {
        $('filter-input').value = datoPendiente.valor;
      }
      datoPendiente = null;
    }
    if (window.matchMedia('(hover: hover)').matches && !(item && item.comando && item.comando.indexOf('/nm') === 0)) {
      $('filter-input').focus();
    }
    $('nvConsultaSeleccion').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cambiarCategoria(cat) {
    if (!$('nvConsultaSeleccion').hidden) {
      if (NV.cerrarDesdeCapa) NV.cerrarDesdeCapa('consulta');
      volverAlCatalogo();
    }
    categoriaActiva = cat === 'vehiculos' ? 'filter' : cat;
    textoBuscado = '';
    $('nvBuscarConsulta').value = '';
    pintarCategorias();
    pintarCatalogo();
    filtrarDesplegable();
  }
  NV.cambiarCategoria = cambiarCategoria;

  function arrancarConsultar() {
    var menuCategorias = $('nvCategoriaMenu');
    var selectorCategoria = menuCategorias.querySelector('summary');
    var categoriasLado = $('nvCategoriasLado');
    if (categoriasLado) categoriasLado.addEventListener('click', function (event) {
      var button = event.target.closest('.nv-categoria-lado');
      if (!button) return;
      var categoria = button.dataset.cat;
      var pantalla = document.querySelector('[data-pantalla="consultar"]');
      if (pantalla && pantalla.hidden) NV.ir('consultar');
      cambiarCategoria(categoria);
      window.scrollTo(0, 0);
      menuCategorias.open = false;
      mostrarBusqueda(false);
      var actual = Array.from(categoriasLado.querySelectorAll('.nv-categoria-lado')).find(function (item) {
        return item.dataset.cat === categoria;
      });
      if (actual) actual.focus({ preventScroll: true });
    });
    var barra = document.querySelector('#nvApp .nv-barra');
    var navegacion = document.querySelector('#nvApp .nv-abajo');
    var botonBusqueda = $('nvAbrirBusqueda');
    var panelBusqueda = $('nvPanelBusqueda');
    var campoBusqueda = $('nvBuscarConsulta');
    function limitesVisibles() {
      return {
        superior: Math.max(0, barra.getBoundingClientRect().bottom),
        inferior: navegacion.getClientRects().length ? navegacion.getBoundingClientRect().top : window.innerHeight
      };
    }

    function mostrarBusqueda(visible) {
      panelBusqueda.hidden = !visible;
      botonBusqueda.setAttribute('aria-expanded', String(visible));
      var etiqueta = visible ? 'Cerrar búsqueda' : 'Buscar consultas';
      botonBusqueda.setAttribute('aria-label', etiqueta);
      botonBusqueda.title = etiqueta;
    }
    NV.actualizarBusquedaCatalogo = function (enCatalogo) {
      botonBusqueda.hidden = !enCatalogo;
      if (!enCatalogo) mostrarBusqueda(false);
    };
    botonBusqueda.addEventListener('click', function () {
      var abrir = panelBusqueda.hidden;
      mostrarBusqueda(abrir);
      if (abrir) {
        menuCategorias.open = false;
        window.scrollTo(0, 0);
        campoBusqueda.focus({ preventScroll: true });
      }
    });
    barra.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || panelBusqueda.hidden ||
          (e.target !== botonBusqueda && !panelBusqueda.contains(e.target))) return;
      e.preventDefault();
      mostrarBusqueda(false);
      botonBusqueda.focus({ preventScroll: true });
    });
    $('nvLimpiarBusqueda').addEventListener('click', function () {
      campoBusqueda.value = '';
      actualizarBusqueda();
      campoBusqueda.focus({ preventScroll: true });
    });
    function actualizarBusqueda() {
      menuCategorias.open = false;
      textoBuscado = campoBusqueda.value;
      if (textoBuscado.trim() && categoriaActiva !== 'todas') {
        categoriaActiva = 'todas';
        pintarCategorias();
        filtrarDesplegable();
      }
      pintarCatalogo();
    }
    campoBusqueda.addEventListener('input', actualizarBusqueda);

    function acomodarCategorias() {
      if (!menuCategorias.open) return;
      var borde = menuCategorias.getBoundingClientRect();
      var limites = limitesVisibles();
      if (!borde.height || borde.bottom <= limites.superior || borde.top >= limites.inferior) {
        menuCategorias.open = false;
        return;
      }
      var abajo = limites.inferior - borde.bottom - 16;
      var arriba = borde.top - limites.superior - 16;
      var flotante = Math.max(arriba, abajo) < 128;
      var abrirArriba = !flotante && abajo < 240 && arriba > abajo;
      var alto = flotante ? limites.inferior - limites.superior - 16 : (abrirArriba ? arriba : abajo);
      menuCategorias.classList.toggle('abre-arriba', abrirArriba);
      menuCategorias.classList.toggle('panel-flotante', flotante);
      menuCategorias.style.setProperty('--nv-menu-alto', alto + 'px');
      menuCategorias.style.setProperty('--nv-menu-superior', limites.superior + 8 + 'px');
    }
    menuCategorias.addEventListener('toggle', acomodarCategorias);
    window.addEventListener('resize', acomodarCategorias);
    window.addEventListener('scroll', acomodarCategorias, { passive: true });
    $('nvCategoriaOpciones').addEventListener('click', function (e) {
      var b = e.target.closest('.nv-categoria-opcion');
      if (!b) return;
      menuCategorias.open = false;
      cambiarCategoria(b.dataset.cat);
      mostrarBusqueda(false);
      selectorCategoria.focus({ preventScroll: true });
    });
    menuCategorias.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuCategorias.open) {
        menuCategorias.open = false;
        e.preventDefault();
        selectorCategoria.focus({ preventScroll: true });
      }
    });
    document.addEventListener('click', function (e) {
      if (!menuCategorias.contains(e.target)) menuCategorias.open = false;
    });
    $('nvCatalogo').addEventListener('click', function (e) {
      var b = e.target.closest('.nv-op');
      if (b) elegir(b.dataset.id);
    });
    $('nvCambiarConsulta').addEventListener('click', function () {
      if (NV.cerrarDesdeCapa) NV.cerrarDesdeCapa('consulta');
      volverAlCatalogo();
      if (window.matchMedia('(hover: hover)').matches) botonBusqueda.focus({ preventScroll: true });
    });
    /* Si se elige desde el desplegable, la lista de abajo lo refleja. */
    $('filterComboPanel').addEventListener('click', function () { setTimeout(marcarElegida, 0); });
    /* El reporte usa el mismo formulario y la misma navegación que el
       resto de las consultas. */
    var ctaReporte = $('ctaReporteBtn');
    if (ctaReporte) ctaReporte.addEventListener('click', function () {
      if (reporteDestacado) elegir(reporteDestacado.id);
    });

    var panelRes = $('filter-result');
    if (panelRes && window.MutationObserver && NV.abrirCapa) {
      var capaRes = false;
      new MutationObserver(function () {
        if (!panelRes.hidden && !capaRes) {
          capaRes = true;
          NV.abrirCapa('resultado', function () { panelRes.hidden = true; capaRes = false; });
        } else if (panelRes.hidden && capaRes) {
          capaRes = false;
          if (NV.cerrarCapa) NV.cerrarCapa('resultado');
        }
      }).observe(panelRes, { attributes: true, attributeFilter: ['hidden'] });
    }

    var espera = (C.FilterView && C.FilterView.whenReady) ? C.FilterView.whenReady() : Promise.resolve();
    espera.then(function () {
      catalogo = ((C.FilterView && C.FilterView.getCatalog()) || []).concat([{
        id: 'tramite-duplicado-citv', nombre: 'Duplicado CITV', categoria: 'filter',
        tipo_dato: 'placa', accion: 'citv'
      }]);
      reporteDestacado = catalogo.find(function (c) { return ((c && c.comando) || '').indexOf('/mpla') === 0; }) ||
        catalogo.find(esReporteDestacado) || null;
      $('ctaReporteBtn').hidden = !reporteDestacado;
      pintarCategorias();
      pintarCatalogo();
    });
  }


  /* ============================================================
     DATOS DEL CLIENTE
     ============================================================ */

  var consultas = null;
  /* Si la lectura falla (sesión aún sin cargar, permiso denegado, red),
     el historial se quedaba mudo con un «Sin consultas» que parecía que
     el cliente no había consultado nunca. Se guarda el motivo y se
     enseña. */
  var fallaHist = '';
  async function leerConsultas() {
    fallaHist = '';
    if (!NV.usuario) {
      /* La pantalla puede abrirse antes de que la sesión esté puesta:
         se espera a que llegue en vez de dar la lista por vacía. */
      for (var i = 0; i < 20 && !NV.usuario; i++) {
        await new Promise(function (r) { setTimeout(r, 150); });
      }
      if (!NV.usuario) {
        fallaHist = 'No se pudo leer tu sesión. Vuelve a entrar.';
        consultas = [];
        return consultas;
      }
    }
    var res = await sb().from('consultas')
      .select('id, module, type, input, cost, status, created_at')
      .eq('user_id', NV.usuario.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (res.error) {
      fallaHist = 'No se pudo leer el historial: ' + res.error.message;
      consultas = [];
    } else {
      consultas = res.data || [];
    }
    return consultas;
  }

  function esOk(c) { return c.status === 'success'; }
  function enCurso(c) { return c.status === 'in_flight' || c.status === 'pending'; }
  function estadoConsulta(c) {
    if (esOk(c)) return { clase: 'ok', texto: 'Con resultado' };
    if (c.status === 'pending') return { clase: 'curso', texto: 'En espera' };
    if (c.status === 'in_flight') return { clase: 'curso', texto: 'En proceso' };
    if (c.status === 'error') return { clase: 'error', texto: 'Sin resultado' };
    return { clase: 'revisar', texto: 'Por revisar' };
  }


  /* ============================================================
     RESUMEN — el panel
     ============================================================ */

  function pintarMetricasResumen(filas) {
    $('nvMetricas').innerHTML = filas.map(function (m) {
      return '<div class="nv-metrica"><span>' + esc(m[0]) + '</span><strong>' + esc(m[1]) +
        '</strong><small>' + esc(m[2]) + '</small></div>';
    }).join('');
  }

  async function entrarResumen() {
    NV.refrescarSaldo();
    pintarMetricasResumen([['Hoy', '—', 'consultas'], ['Este mes', '—', 'consultas'], ['Con resultado', '—', 'consultas recientes']]);
    $('nvMetricas').setAttribute('aria-busy', 'true');
    var lista;
    try { lista = await leerConsultas(); }
    catch (error) { lista = []; fallaHist = 'No se pudo cargar la actividad. Inténtalo de nuevo desde Resumen.'; }
    $('nvMetricas').setAttribute('aria-busy', 'false');
    $('nvResumenEstado').hidden = !fallaHist;
    $('nvResumenEstado').textContent = fallaHist ? 'No pudimos actualizar el resumen. Vuelve a abrir esta sección para reintentarlo.' : '';
    if (fallaHist) {
      $('nvActividadTotal').textContent = 'Sin actualizar';
      $('nvRepartoTotal').textContent = '';
      $('nvGrafico').innerHTML = '<p class="nv-vacio">No pudimos cargar la actividad.</p>';
      $('nvReparto').innerHTML = '<p class="nv-vacio">No pudimos cargar las categorías.</p>';
      return;
    }

    var ahora = new Date();
    var hoy0 = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    var mes0 = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
    var hoy = 0, mes = 0, ok = 0;
    lista.forEach(function (c) {
      var t = new Date(c.created_at).getTime();
      if (t >= hoy0) hoy++;
      if (t >= mes0) mes++;
      if (esOk(c)) ok++;
    });
    var tasa = lista.length ? Math.round(ok * 100 / lista.length) : 0;

    pintarMetricasResumen([
      ['Hoy', NV.numero(hoy), 'consultas'],
      ['Este mes', NV.numero(mes), 'consultas'],
      ['Con resultado', tasa + '%', NV.numero(ok) + ' de ' + NV.numero(lista.length) + ' consultas']
    ]);

    /* La altura de cada barra se calcula dentro de su pista: el número
       y la fecha no reducen la escala de los días con más consultas. */
    var dias = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - i);
      dias.push({ t: d.getTime(), n: 0, etiqueta: d.toLocaleDateString('es-PE', { day: 'numeric' }) });
    }
    lista.forEach(function (c) {
      var t = new Date(c.created_at);
      var t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
      for (var j = 0; j < dias.length; j++) if (dias[j].t === t0) { dias[j].n++; break; }
    });
    var max = Math.max.apply(null, dias.map(function (d) { return d.n; })) || 1;
    var total14 = dias.reduce(function (a, d) { return a + d.n; }, 0);
    $('nvActividadTotal').textContent = NV.numero(total14) + ' consultas · 14 días';
    $('nvGrafico').innerHTML = !total14 ? '<p class="nv-vacio">Aún no hay actividad en estos 14 días.</p>' : dias.map(function (d, i) {
      var alto = d.n ? Math.max(6, Math.round(d.n * 100 / max)) : 2;
      var descripcion = new Date(d.t).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' }) + ': ' + d.n + ' consultas';
      return '<div class="nv-col' + (i === dias.length - 1 ? ' es-hoy' : '') + '" role="listitem" aria-label="' + esc(descripcion) + '" style="--nv-barra-alto:' + alto + '%">' +
        '<div class="nv-col-pista" aria-hidden="true"><span class="nv-col-n">' + (d.n || '') + '</span>' +
        '<span class="nv-col-barra"></span></div>' +
        '<span class="nv-col-dia" aria-hidden="true">' + d.etiqueta + '</span>' +
      '</div>';
    }).join('');

    /* Cada categoría mantiene su porcentaje junto a su propia barra. */
    var porCat = {};
    lista.forEach(function (c) { if (esOk(c)) porCat[c.module] = (porCat[c.module] || 0) + 1; });
    var filas = Object.keys(porCat).map(function (k) { return [k, porCat[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    var suma = filas.reduce(function (a, f) { return a + f[1]; }, 0);
    $('nvRepartoTotal').textContent = NV.numero(suma) + ' con resultado';
    if (!suma) {
      $('nvReparto').innerHTML = '<p class="nv-vacio">Aún sin consultas.</p>';
    } else {
      var top = filas.slice(0, 6);
      var resto = suma - top.reduce(function (a, f) { return a + f[1]; }, 0);
      if (resto > 0) top.push(['otras', resto]);
      $('nvReparto').innerHTML = '<ul class="nv-categorias-lista">' + top.map(function (f) {
        var nombre = f[0] === 'otras' ? 'Otras' : nombreCat(f[0]);
        var porcentaje = Math.round(f[1] * 100 / suma);
        return '<li aria-label="' + esc(nombre + ': ' + f[1] + ' consultas, ' + porcentaje + '%') + '">' +
          '<div class="nv-categoria-fila"><span>' + esc(nombre) + '</span><b>' + porcentaje + '%</b></div>' +
          '<span class="nv-categoria-progreso" aria-hidden="true"><i style="width:' + (f[1] * 100 / suma).toFixed(2) + '%"></i></span></li>';
      }).join('') + '</ul>';
    }
  }

  function arrancarResumen() {
    document.querySelector('.nv-atajos').addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      if (a.hasAttribute('data-reporte-atajo')) {
        setTimeout(function () { var r = $('ctaReporteBtn'); if (r) r.click(); }, 50);
        return;
      }
      var cat = a.getAttribute('data-cat-atajo');
      if (cat) setTimeout(function () { cambiarCategoria(cat); }, 50);
    });
  }


  /* ============================================================
     HISTORIAL — el registro
     ============================================================ */

  var filtroHist = 'todas';

  function tituloDia(t) {
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var d = new Date(t); d.setHours(0, 0, 0, 0);
    var dif = Math.round((hoy - d) / 86400000);
    var fecha = d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
    if (dif === 0) return 'Hoy · ' + fecha;
    if (dif === 1) return 'Ayer · ' + fecha;
    return fecha;
  }

  function pintarRegistro() {
    var q = NV.llano(($('nvHistBuscar').value || '').trim());
    var lista = (consultas || []).filter(function (c) {
      if (filtroHist === 'ok' && !esOk(c)) return false;
      if (filtroHist === 'curso' && !enCurso(c)) return false;
      if (filtroHist === 'error' && (esOk(c) || enCurso(c))) return false;
      return !q || NV.llano((c.input || '') + ' ' + nombreCat(c.module)).indexOf(q) !== -1;
    }).slice(0, 300);

    if (!lista.length) {
      var vacio = fallaHist ? fallaHist
        : (q || filtroHist !== 'todas') ? 'Ninguna consulta coincide con lo buscado.'
        : 'Aún no has hecho ninguna consulta.';
      $('nvHistRegistro').innerHTML = '<p class="nv-vacio">' + esc(vacio) + '</p>';
      return;
    }

    var html = '', diaActual = '';
    lista.forEach(function (c) {
      var claveDia = new Date(c.created_at).toDateString();
      if (claveDia !== diaActual) {
        if (diaActual) html += '</div>';
        html += '<h3 class="nv-dia">' + esc(tituloDia(c.created_at)) + '</h3><div class="nv-dia-lista">';
        diaActual = claveDia;
      }
      var hora = new Date(c.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      var estado = estadoConsulta(c);
      var cobro = esOk(c) && c.cost ? '−' + c.cost : '';
      var demorada = enCurso(c) && Date.now() - new Date(c.created_at).getTime() > 30 * 60000;
      html += '<div class="nv-reg">' +
        '<span class="nv-reg-hora">' + hora + '</span>' +
        '<span class="nv-reg-txt"><b>' + esc(c.input || '—') + '</b><span>' + esc(nombreCat(c.module)) + '</span></span>' +
        '<span class="nv-reg-estado nv-reg-estado-' + estado.clase + '"><span><i class="nv-punto nv-punto-' + estado.clase + '"></i>' + esc(estado.texto) + '</span>' +
        (demorada ? '<a class="nv-reg-ayuda" target="_blank" rel="noopener noreferrer" href="' + esc(NV.whatsapp('Hola, necesito revisar mi consulta ' + c.id + ' que sigue en curso.')) + '">Pedir ayuda</a>' : '') + '</span>' +
        '<span class="nv-reg-cobro">' + cobro + '</span>' +
        '<button type="button" class="nv-repetir" data-mod="' + esc(c.module) + '" data-type="' + esc(c.type) + '" data-val="' + esc(c.input || '') + '" title="Consultar de nuevo" aria-label="Consultar de nuevo"><svg><use href="#fv-repetir"/></svg></button>' +
      '</div>';
    });
    $('nvHistRegistro').innerHTML = html + '</div>';
  }

  async function entrarHistorial() {
    $('nvHistRegistro').innerHTML = '<div class="nv-cargando"></div>';
    await leerConsultas();
    pintarRegistro();
  }

  function arrancarHistorial() {
    var estadoSelect = $('nvHistEstado');
    if (estadoSelect) estadoSelect.addEventListener('change', function () {
      var opcion = $('nvSegmentos').querySelector('[data-filtro="' + this.value + '"]');
      if (opcion) opcion.click();
    });
    $('nvHistActualizar').addEventListener('click', entrarHistorial);
    $('nvSegmentos').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      filtroHist = b.dataset.filtro;
      if (estadoSelect) estadoSelect.value = filtroHist;
      this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('es-activo', x === b); });
      pintarRegistro();
    });
    $('nvHistBuscar').addEventListener('input', pintarRegistro);

    /* El historial guarda categoría y tipo de dato, pero no el ID del
       servicio exacto. El usuario elige el servicio y reutiliza el dato
       solo cuando coincide su categoría y tipo. */
    $('nvHistRegistro').addEventListener('click', function (e) {
      var b = e.target.closest('.nv-repetir');
      if (!b) return;
      datoPendiente = { categoria: b.dataset.mod, tipo: b.dataset.type, valor: b.dataset.val };
      NV.ir('consultar');
      if (CORTO[b.dataset.mod]) cambiarCategoria(b.dataset.mod);
      if (C.toast) C.toast({ type: 'info', title: 'Elige una consulta', message: 'El dato anterior se completará si corresponde a la consulta elegida.' });
      if (window.matchMedia('(hover: hover)').matches) $('nvAbrirBusqueda').focus({ preventScroll: true });
    });
  }

  NV.verConsultaEnHistorial = function (consulta) {
    filtroHist = 'todas';
    $('nvHistEstado').value = filtroHist;
    $('nvHistBuscar').value = consulta && consulta.input || '';
    $('nvSegmentos').querySelectorAll('button').forEach(function (button) {
      button.classList.toggle('es-activo', button.dataset.filtro === filtroHist);
    });
    NV.ir('historial');
  };


  /* ============================================================
     MIS VEHICULOS - guardado voluntario, sin consultar ni cobrar
     ============================================================ */

  var vehiculos = [];
  var vehiculosError = '';
  var Veh = C.Vehicles;

  function pintarVehiculos() {
    var caja = $('nvVehLista');
    if (vehiculosError) {
      caja.innerHTML = '<div class="nv-veh-mensaje" role="alert">' + esc(vehiculosError) +
        ' <button type="button" class="nv-boton-claro" data-veh-actualizar>Reintentar</button></div>';
      return;
    }
    if (!vehiculos.length) {
      caja.innerHTML = '<p class="nv-veh-mensaje">Todavía no has guardado placas.</p>';
      return;
    }
    caja.innerHTML = vehiculos.map(function (v) {
      var ultima = (consultas || []).find(function (c) {
        return c.type === 'placa' && Veh.normalizePlate(c.input) === v.plate;
      });
      var resumen = fallaHist ? 'Consultas recientes no disponibles' : ultima
        ? 'Última consulta reciente: ' + new Date(ultima.created_at).toLocaleDateString('es-PE') + ' · ' + estadoConsulta(ultima).texto
        : 'Sin consultas recientes';
      return '<article class="nv-veh-card">' +
        '<span class="nv-veh-icono" aria-hidden="true"><svg><use href="#fv-vehiculo"/></svg></span>' +
        '<div class="nv-veh-info"><strong>' + esc(v.plate) + '</strong>' +
        (v.alias ? '<span>' + esc(v.alias) + '</span>' : '') +
        '<small>' + esc(resumen) + '</small></div>' +
        '<div class="nv-veh-acciones"><button class="nv-cta nv-cta-chica" type="button" data-veh-consultar="' + esc(v.id) + '">Elegir consulta</button>' +
        '<button class="nv-boton-claro" type="button" data-veh-borrar="' + esc(v.id) + '" aria-label="Eliminar placa ' + esc(v.plate) + '">Eliminar</button></div>' +
        '</article>';
    }).join('');
  }

  async function entrarVehiculos() {
    $('nvVehLista').innerHTML = '<div class="nv-cargando"></div>';
    await leerConsultas();
    if (!NV.usuario) {
      vehiculosError = 'No se pudo leer tu sesión. Vuelve a entrar.';
      pintarVehiculos();
      return;
    }
    try {
      var res = await sb().from('saved_vehicles')
        .select('id, plate, alias, created_at')
        .eq('user_id', NV.usuario.id)
        .order('created_at', { ascending: false });
      if (res.error) throw res.error;
      vehiculos = res.data || [];
      vehiculosError = '';
    } catch (e) {
      vehiculos = [];
      vehiculosError = 'No se pudieron cargar las placas guardadas. Inténtalo de nuevo.';
    }
    pintarVehiculos();
  }

  function arrancarVehiculos() {
    $('nvVehForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var placa = Veh.normalizePlate($('nvVehPlaca').value);
      var alias = $('nvVehAlias').value.trim();
      if (!Veh.validPlate(placa)) {
        C.toast({ type: 'error', title: 'Revisa la placa', message: 'Escribe entre 5 y 8 letras o números.' });
        $('nvVehPlaca').focus();
        return;
      }
      if (!NV.usuario) {
        C.toast({ type: 'error', title: 'Sesión no disponible', message: 'Vuelve a entrar para guardar la placa.' });
        return;
      }
      var boton = $('nvVehGuardar');
      boton.disabled = true;
      try {
        var res = await sb().from('saved_vehicles').insert({ user_id: NV.usuario.id, plate: placa, alias: alias });
        if (res.error) throw res.error;
        $('nvVehForm').reset();
        C.toast({ type: 'success', title: 'Placa guardada', message: 'Podrás elegir una consulta cuando la necesites.' });
        await entrarVehiculos();
      } catch (error) {
        C.toast({ type: 'error', title: 'No se pudo guardar', message: error && error.code === '23505' ? 'Esa placa ya está en tu lista.' : 'Reinténtalo en unos momentos.' });
      } finally {
        boton.disabled = false;
      }
    });

    $('nvVehLista').addEventListener('click', async function (e) {
      if (e.target.closest('[data-veh-actualizar]')) { entrarVehiculos(); return; }
      var abrir = e.target.closest('[data-veh-consultar]');
      if (abrir) {
        var v = vehiculos.find(function (x) { return x.id === abrir.dataset.vehConsultar; });
        if (!v) return;
        datoPendiente = { categoria: 'filter', tipo: 'placa', valor: v.plate };
        NV.ir('consultar');
        cambiarCategoria('filter');
        C.toast({ type: 'info', title: 'Elige una consulta', message: 'La placa se completará al elegir un servicio por placa.' });
        return;
      }
      var borrar = e.target.closest('[data-veh-borrar]');
      if (!borrar) return;
      var vehiculo = vehiculos.find(function (x) { return x.id === borrar.dataset.vehBorrar; });
      if (!vehiculo) return;
      var ok = C.confirm
        ? await C.confirm({ title: 'Eliminar placa', message: '¿Quitar ' + vehiculo.plate + ' de tus vehículos?', confirmText: 'Eliminar' })
        : window.confirm('¿Quitar ' + vehiculo.plate + ' de tus vehículos?');
      if (!ok) return;
      borrar.disabled = true;
      var res = await sb().from('saved_vehicles').delete()
        .eq('id', vehiculo.id).eq('user_id', NV.usuario.id);
      if (res.error) {
        borrar.disabled = false;
        C.toast({ type: 'error', title: 'No se pudo eliminar', message: 'Reinténtalo en unos momentos.' });
        return;
      }
      vehiculos = vehiculos.filter(function (x) { return x.id !== vehiculo.id; });
      pintarVehiculos();
    });
  }


  /* ============================================================
     PAGOS
     ============================================================ */

  var PAQUETES = C.CreditPackages;
  var LIBRE_TARIFA = 0.05;
  var LIBRE_MINIMO = 400;

  function pintarPaquetes() {
    var mejor = PAQUETES.reduce(function (a, b) { return (b.precio / b.creditos) < (a.precio / a.creditos) ? b : a; });
    $('nvPaquetes').innerHTML = PAQUETES.map(function (p) {
      var es = p === mejor;
      return '<article class="nv-paq' + (es ? ' es-mejor' : '') + '">' +
        '<div class="nv-paq-top"><span>Paquete</span>' +
          (es ? '<span class="nv-paq-mejor">Mejor precio</span>' : '') + '</div>' +
        '<div class="nv-paq-cred"><strong>' + NV.numero(p.creditos) + '</strong><span>créditos</span></div>' +
        '<div class="nv-paq-precio"><span>' + NV.soles(p.precio) + '</span>' +
          '<small>' + NV.soles(p.precio / p.creditos * 100) + ' por 100 créditos</small></div>' +
        '<button type="button" class="nv-cta nv-cta-chica" data-plan="' + p.id +
          '" aria-label="Comprar ' + NV.numero(p.creditos) + ' créditos por ' + NV.soles(p.precio) + '"><span>Comprar</span></button>' +
      '</article>';
    }).join('');
  }

  async function comprar(planId, boton) {
    var original = boton.innerHTML;
    var botones = $('nvPaquetes').querySelectorAll('[data-plan]');
    botones.forEach(function (b) { b.disabled = true; });
    boton.innerHTML = '<span>Abriendo pago…</span><i><span class="nv-giro"></span></i>';
    try {
      var res = await sb().functions.invoke('crear-preferencia', { body: { plan_id: planId } });
      if (res.error) throw res.error;
      var url = res.data && res.data.init_point;
      if (!url) throw new Error((res.data && res.data.error) || 'Respuesta inválida');
      if (!/^https:\/\/[a-z]+\.(mercadopago|mercadolibre)\.com/i.test(url)) throw new Error('Dirección de pago no reconocida');
      window.location.href = url;
    } catch (e) {
      console.error('[pagos]', e);
      botones.forEach(function (b) { b.disabled = false; });
      boton.innerHTML = original;
      C.toast({ type: 'error', title: 'No se pudo abrir el pago', message: 'Inténtalo de nuevo.' });
    }
  }

  function actualizarLibre() {
    var campo = $('nvLibreCreditos');
    var valor = campo.value.trim();
    var n = /^\d+$/.test(valor) ? Number(valor) : NaN;
    var ok = Number.isInteger(n) && n >= LIBRE_MINIMO && n % 10 === 0;
    $('nvLibreTotal').textContent = NV.soles(ok ? n * LIBRE_TARIFA : 0);
    campo.setAttribute('aria-invalid', valor && !ok ? 'true' : 'false');
    $('nvLibreAyuda').textContent = !valor ? 'Mínimo 400, en múltiplos de 10.'
      : !Number.isInteger(n) || n % 10 !== 0 ? 'Ingresa créditos en múltiplos de 10.'
      : n < LIBRE_MINIMO ? 'El mínimo es 400 créditos.'
      : 'Te llevará a WhatsApp para coordinar la recarga.';
    var ir = $('nvLibreIr');
    ir.classList.toggle('es-inactivo', !ok);
    ir.setAttribute('aria-disabled', ok ? 'false' : 'true');
    ir.href = ok
      ? NV.whatsapp('Hola, quiero recargar ' + n + ' créditos (' + NV.soles(n * LIBRE_TARIFA) + '). Mi correo: ' + ((NV.usuario && NV.usuario.email) || ''))
      : '#';
  }

  var METODO = { mercadopago: 'Mercado Pago', whatsapp: 'WhatsApp', manual: 'Recarga manual', yape: 'Yape', plin: 'Plin' };

  function nombrePago(t) {
    if (t.type === 'purchase') return 'Paquete de ' + NV.numero(t.amount) + ' créditos';
    if (t.type === 'subscription') return 'Suscripción';
    return 'Recarga de ' + NV.numero(t.amount) + ' créditos';
  }

  /* Solo PAGOS: compras por Mercado Pago, suscripciones y recargas
     hechas por WhatsApp o a mano (ajustes positivos). Fuera consultas,
     devoluciones, bonos de bienvenida y usos de suscripción.

     Y SIEMPRE filtrado por el usuario: a una cuenta administradora la
     base le deja leer los movimientos de todos, y sin este filtro le
     salían los de todos los clientes. */
  async function cargarPagos() {
    $('nvPagosN').textContent = 'Cargando pagos…';
    $('nvPagosTotal').textContent = '';
    $('nvMovimientos').innerHTML = '<div class="nv-cargando"></div>';
    var filas = [];
    var pagosMP = [];
    var movimientosMP = [];
    if (NV.usuario) {
      try {
        var resultados = await Promise.all([sb().from('transactions')
          .select('id, user_id, type, amount, amount_pen, payment_method, reference, plan_id, created_at')
          .eq('user_id', NV.usuario.id)
          .or('type.in.(purchase,subscription),and(type.eq.admin_adjust,amount.gt.0,payment_method.in.(whatsapp,manual))')
          .order('created_at', { ascending: false })
          .limit(200),
        sb().from('payments_mp')
          .select('payment_id, user_id, plan_id, credits, amount, status, type, created_at')
          .eq('user_id', NV.usuario.id)
          .order('created_at', { ascending: false })
          .limit(200)]);
        if (resultados[0].error) throw resultados[0].error;
        if (resultados[1].error) throw resultados[1].error;
        filas = resultados[0].data || [];
        pagosMP = resultados[1].data || [];
        var ids = pagosMP.map(function (p) { return p.payment_id; });
        for (var i = 0; i < ids.length; i += 80) {
          var vinculados = await sb().from('transactions')
            .select('id, user_id, type, amount, amount_pen, payment_method, reference, plan_id')
            .eq('user_id', NV.usuario.id)
            .eq('payment_method', 'mercadopago')
            .in('reference', ids.slice(i, i + 80));
          if (vinculados.error) throw vinculados.error;
          movimientosMP = movimientosMP.concat(vinculados.data || []);
        }
      } catch (e) {
        console.error('[pagos] historial:', e);
        $('nvPagosN').textContent = 'No disponible';
        $('nvMovimientos').innerHTML = '<div class="nv-pagos-error"><p>No pudimos cargar tus pagos.</p>' +
          '<button type="button" class="nv-boton-claro" data-reintentar-pagos>Reintentar</button></div>';
        return;
      }
    }

    var idsMP = {};
    var entradas = pagosMP.map(function (p) {
      idsMP[p.payment_id] = true;
      var estado = C.MPReconciliation.assess(p, movimientosMP);
      var revisar = estado !== 'movement_recorded';
      var nombre = p.type === 'suscripcion' ? 'Suscripción' : 'Paquete de ' + NV.numero(p.credits) + ' créditos';
      var ayuda = revisar ? '<span class="nv-mov-revision">Movimiento por revisar · ' + esc(p.payment_id) +
        ' <a target="_blank" rel="noopener noreferrer" href="' + esc(NV.whatsapp('Hola, necesito revisar mi pago de Mercado Pago ' + p.payment_id + '.')) + '">Pedir ayuda</a></span>' :
        '<span class="nv-mov-registrado">Movimiento registrado</span>';
      return {
        fecha: p.created_at,
        monto: Number(p.amount) || 0,
        html: '<div class="nv-mov"><span class="nv-mov-txt"><b>' + esc(nombre) + '</b>' +
          '<span>' + esc(NV.fecha(p.created_at, true)) + ' · Mercado Pago</span>' + ayuda +
          '</span><strong>' + NV.soles(p.amount) + '</strong></div>'
      };
    });
    filas.filter(function (t) {
      return t.payment_method !== 'mercadopago' || !idsMP[t.reference];
    }).forEach(function (t) {
      var metodo = METODO[t.payment_method] || t.payment_method || '';
      entradas.push({
        fecha: t.created_at,
        monto: Number(t.amount_pen) || 0,
        html: '<div class="nv-mov"><span class="nv-mov-txt"><b>' + esc(nombrePago(t)) + '</b>' +
          '<span>' + esc(NV.fecha(t.created_at, true)) + (metodo ? ' · ' + esc(metodo) : '') + '</span></span>' +
          '<strong>' + (Number(t.amount_pen) ? NV.soles(t.amount_pen) : '+' + NV.numero(t.amount)) + '</strong></div>'
      });
    });
    entradas.sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    var total = entradas.reduce(function (a, t) { return a + t.monto; }, 0);
    $('nvPagosN').textContent = entradas.length + (entradas.length === 1 ? ' pago' : ' pagos');
    $('nvPagosTotal').textContent = total ? NV.soles(total) : '';
    $('nvMovimientos').innerHTML = entradas.length ? entradas.map(function (t) { return t.html; }).join('') :
      '<p class="nv-vacio">Todavía no has hecho ningún pago.</p>';
  }

  function entrarPagos() {
    /* Cada vez que se entra a Pagos, la lista empieza plegada. */
    var det = $('nvPagosHechos');
    if (det.open) det.open = false;
    $('nvPagosBoton').textContent = 'Ver pagos';
    NV.refrescarSaldo();
    cargarPagos();
  }

  function arrancarPagos() {
    pintarPaquetes();
    $('nvPaquetes').addEventListener('click', function (e) {
      var b = e.target.closest('[data-plan]');
      if (b && !b.disabled) comprar(b.dataset.plan, b);
    });
    $('nvPagosHechos').addEventListener('toggle', function () {
      $('nvPagosBoton').textContent = this.open ? 'Ocultar' : 'Ver pagos';
    });
    $('nvMovimientos').addEventListener('click', function (e) {
      if (e.target.closest('[data-reintentar-pagos]')) cargarPagos();
    });
    $('nvLibreCreditos').addEventListener('input', actualizarLibre);
    $('nvLibreIr').addEventListener('click', function (e) {
      if (this.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        C.toast({ type: 'info', title: 'Revisa la cantidad', message: $('nvLibreAyuda').textContent });
      }
    });
    actualizarLibre();
  }


  /* ============================================================
     CUENTA
     ============================================================ */

  function entrarCuenta() {
    var p = NV.perfil || {};
    var u = NV.usuario || {};
    $('nvNombre').textContent = p.full_name || 'Sin nombre';
    $('nvCorreo').textContent = u.email || '';
    $('nvPlan').textContent = NV.esAdmin() ? 'Administrador'
      : (p.subscription_tier ? String(p.subscription_tier).replace(/_/g, ' ') : 'Créditos');
  }

  function arrancarCuenta() {
    $('nvSoporte').href = NV.whatsapp('Hola, necesito ayuda con mi cuenta de Filtro Vehicular+.');
    /* Cerrar sesión está en Mi cuenta y en el menú del avatar: el mismo
       código para los dos, marcado con [data-salir]. */
    document.querySelectorAll('[data-salir]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var ok = C.confirm
          ? await C.confirm({ title: 'Cerrar sesión', message: '¿Salir de tu cuenta?', confirmText: 'Salir' })
          : window.confirm('¿Salir de tu cuenta?');
        if (!ok) return;
        try { if (C.Auth && C.Auth.signOut) await C.Auth.signOut(); } catch (e) {}
        window.location.reload();
      });
    });
  }


  /* ============================================================
     ARRANQUE
     ============================================================ */

  NV.arrancarPantallas = function () {
    arrancarConsultar();
    arrancarResumen();
    arrancarHistorial();
    arrancarVehiculos();
    arrancarPagos();
    arrancarCuenta();
    if (NV.arrancarRecientes) NV.arrancarRecientes();
    NV.alEntrar.resumen = entrarResumen;
    NV.alEntrar.historial = entrarHistorial;
    NV.alEntrar.vehiculos = entrarVehiculos;
    NV.alEntrar.pagos = entrarPagos;
    NV.alEntrar.cuenta = entrarCuenta;
    /* Lo que rodea a las consultas (js/nueva/servicios.js): va al final
       porque amplía lo que hace Cuenta al abrirse. */
    if (NV.arrancarServicios) NV.arrancarServicios();
  };
})();
