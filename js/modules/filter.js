/* ============================================================
   FILTER — pestaña "Consultar placa" (view-filter).
   Carga consultas del catálogo con categoria='filter' y las
   ejecuta vía bridge. Soporta DNI, placa, PDF y texto.

   Las funciones de renderizado compartidas viven en render-helpers.js
   y se acceden a través de Consultia.RenderHelpers.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var catalog = [];
  var currentConsulta = null;
  var catalogReadyPromise = null;

  // Antispam del reporte /metapla: tras entregar la información hay que
  // esperar 60 s antes de poder pedir otro reporte. Aplica sólo a /metapla.
  var METAPLA_COOLDOWN_MS = 60 * 1000;
  var metaplaCooldownUntil = 0;

  /* El Reporte Completo ha cambiado de bot y con él de comando: era
     `/metapla` en fuentesdata y ahora es `/mpla` en ghostdataxxx. Se
     reconocen los dos porque de esta comprobación cuelga TODO lo propio
     del reporte —el render en tabla, el PDF rediseñado con el estilo de
     la casa y el enfriamiento de un minuto—, y con el nombre viejo a
     secas el reporte nuevo se habría renderizado como una consulta
     cualquiera sin que nadie lo notara. */
  function esMetapla(c) {
    var cmd = (c && c.comando) || '';
    return cmd.indexOf('/metapla') === 0 || cmd.indexOf('/mpla') === 0;
  }

  /* ── Reporte Completo: en implementación ──────────────────────────────
     Todavía no se entrega, pero es lo más grande que va a tener la
     plataforma —veintiún trámites en un solo clic—, así que en vez de
     esconderlo se anuncia: al elegirlo se ve la lista entera de lo que va
     a traer, y pulsar Consultar no cobra ni consulta, lo repite.

     Abierto el 2026-08-19: se escribe la placa, se pulsa Consultar y se
     entrega. El aviso y su lista se quedan escritos aquí porque el día
     que haya que cerrarlo otra vez —un bot caído, un trámite que deje de
     responder— basta con volver a poner esto en true. */
  var REPORTE_EN_IMPLEMENTACION = false;

  var REPORTE_INCLUYE = [
    'Infracciones por regiones (17 regiones disponibles)',
    'Propiedad Vehicular SUNARP',
    'Historial Completo por Placa',
    'Cambio de Características',
    'Deudas y Multas SAT Lima',
    'Deudas y Multas SAT Callao',
    'Papeletas de Tránsito ATU',
    'Siniestralidad por Placa',
    'Estado de Placa',
    'Papeletas de Infracción por Cinemómetro',
    'Inspección Técnica Vehicular CITV',
    'Vigencia del SOAT',
    'Papeletas SUTRAN',
    'Lunas Oscurecidas',
    'FISE GNV Subsidio Gas',
    'Consulta Deuda GNV',
    'Denuncias y Órdenes de Captura',
    'Boleta Informativa',
    'Tarjeta de Propiedad (TIVE)',
    'Historial de Propietarios Inscritos',
    'Récord de Conductor (DNI)',
  ];

  var ICONO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  function htmlReporteEnImplementacion() {
    return '<div class="rep-espera">' +
      '<div class="rep-espera-hero">' +
        '<span class="rep-espera-chip"><span class="rep-espera-pulso"></span>En implementación</span>' +
        '<h4 class="rep-espera-titulo">Reporte Completo</h4>' +
        '<p class="rep-espera-cifra">' +
          '<span class="rep-espera-num" data-hasta="' + REPORTE_INCLUYE.length + '">0</span>' +
          '<span class="rep-espera-cifra-txt">trámites en un solo clic</span>' +
        '</p>' +
        '<div class="rep-espera-barra"><span></span></div>' +
      '</div>' +
      '<p class="rep-espera-texto">Lo estamos terminando. Cuando esté listo, un solo clic ' +
      'te devuelve todo esto reunido en un mismo documento:</p>' +
      '<ul class="rep-espera-lista">' +
        REPORTE_INCLUYE.map(function (t, i) {
          return '<li style="--i:' + i + '"><span class="rep-espera-ico">' + ICONO_CHECK + '</span>' +
            escapeHtml(t) + '</li>';
        }).join('') +
      '</ul>' +
      '<p class="rep-espera-pie">Mientras tanto, cada consulta de la lista ya está disponible ' +
      'por separado en su categoría.</p>' +
    '</div>';
  }

  /* El contador sube de 0 a 21 al aparecer. Es el dato que vende el
     reporte, y verlo subir dice «esto es mucho» mejor que escribirlo. */
  function animarCifra(raiz) {
    var num = raiz && raiz.querySelector('.rep-espera-num');
    if (!num) return;
    var hasta = parseInt(num.getAttribute('data-hasta'), 10) || 0;
    var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieto || !hasta) { num.textContent = hasta; return; }
    var DURACION = 900;
    var inicio = 0;
    function paso(ahora) {
      if (!inicio) inicio = ahora;
      var t = Math.min((ahora - inicio) / DURACION, 1);
      // Desacelera al final: arranca rápido y se posa en la cifra.
      var suave = 1 - Math.pow(1 - t, 3);
      num.textContent = Math.round(hasta * suave);
      if (t < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }

  /* La pantalla flotante sale al PULSAR Consultar, no al elegir la consulta
     del cuadro: quien pulsa está pidiendo el reporte y merece la respuesta
     de frente; a quien solo pasea por el catálogo, un cartel encima le
     estorba —para eso está la lista en el panel, que no tapa nada. */
  var CERRAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function abrirModalReporte() {
    var previo = document.getElementById('rep-modal');
    if (previo) previo.remove();

    var root = document.createElement('div');
    root.id = 'rep-modal';
    root.className = 'rep-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML =
      '<div class="rep-modal-fondo"></div>' +
      '<div class="rep-modal-caja">' +
        '<button class="rep-modal-cerrar" type="button" aria-label="Cerrar">' + CERRAR_SVG + '</button>' +
        htmlReporteEnImplementacion() +
        '<div class="rep-modal-pie"><button class="rep-modal-ok" type="button">Entendido</button></div>' +
      '</div>';
    document.body.appendChild(root);
    document.body.classList.add('modal-open');
    // Un fotograma de margen para que el navegador vea el estado inicial y
    // la entrada se anime en vez de aparecer puesta.
    requestAnimationFrame(function () {
      root.classList.add('is-abierto');
      animarCifra(root);
    });

    function cerrar() {
      document.removeEventListener('keydown', alPulsarTecla);
      document.body.classList.remove('modal-open');
      root.remove();
    }
    function alPulsarTecla(e) { if (e.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', alPulsarTecla);
    root.querySelector('.rep-modal-fondo').addEventListener('click', cerrar);
    root.querySelector('.rep-modal-cerrar').addEventListener('click', cerrar);
    root.querySelector('.rep-modal-ok').addEventListener('click', cerrar);
    setTimeout(function () {
      var b = root.querySelector('.rep-modal-ok');
      if (b) b.focus();
    }, 50);
  }

  function mostrarReporteEnImplementacion() {
    var body  = $('filter-result-body');
    var empty = $('filter-empty');
    var rp    = $('filter-result');
    if (rp) rp.hidden = false;
    if (empty) empty.hidden = true;
    if (body) {
      body.hidden = false;
      body.innerHTML = htmlReporteEnImplementacion();
      animarCifra(body);
    }
    var status = $('filterResultStatus');
    if (status) {
      status.classList.remove('status-loading', 'status-ok');
      status.classList.add('status-empty');
      status.innerHTML = '';
    }
  }

  function $(id) { return document.getElementById(id); }

  // Alias de render helpers
  var H                       = Consultia.RenderHelpers;
  var escapeHtml              = H.escapeHtml;
  var revokeActiveBlobUrls    = H.revokeActiveBlobUrls;
  var esErrorTecnico          = H.esErrorTecnico;
  var esErrorTecnicoRespuesta = H.esErrorTecnicoRespuesta;
  var htmlMantenimiento       = H.htmlMantenimiento;
  var placeholderFor          = H.placeholderFor;
  var maxLenFor               = H.maxLenFor;
  var inputModeFor            = H.inputModeFor;
  var validarValor            = H.validarValor;
  var renderDataRows          = H.renderDataRows;
  var renderButtonList        = H.renderButtonList;
  var renderDataWithMedia     = H.renderDataWithMedia;
  var renderDocumentCard      = H.renderDocumentCard;
  var renderPdfDlBar          = H.renderPdfDlBar;
  var renderPdfTopButton      = H.renderPdfTopButton;
  var descargarPdfConOverlay  = H.descargarPdfConOverlay;
  var isEmptyValue            = H.isEmptyValue;

  // Render dedicado para "Reporte Completo" (/metapla): filas simples,
  // sin título del bot, sin duplicar campos repetidos y sin el partido en
  // 2 columnas que usa renderDataRows para listas de varios registros
  // (ese modo no aplica acá — /metapla es un solo vehículo).
  /* `placa` es la que se consultó. Va delante de todo lo demás.

     El reporte salía sin ella: la ficha listaba propietario, DNI, SOAT,
     aseguradora y vigencias —todo lo que devuelve el bot— y el dato por
     el que se pregunta, que es el que encabeza el documento y el que el
     cliente necesita ver para saber que no se equivocó de vehículo, no
     aparecía por ningún lado. No sale del bot porque es la pregunta, no
     la respuesta; hay que ponerla desde aquí.

     Si el bot llegara a devolverla como un campo más, no se repite. */
  /* ── La ficha del Reporte Completo ───────────────────────────────────
     Antes era una lista plana de pares etiqueta/valor pegada al borde de
     la tarjeta —seis píxeles de aire— y con la columna del valor
     estirada a novecientos: la etiqueta quedaba en un extremo y el dato
     en el otro, y el ojo tenía que cruzar la pantalla para juntarlos.

     Ahora son dos piezas. Arriba un RESUMEN con lo que se mira primero,
     en celdas del mismo tamaño; debajo el DETALLE con todo lo demás, en
     dos columnas que no se separan más de lo que se lee cómodo.

     El resumen no repite lo que ya dice el veredicto: el veredicto
     contesta qué pasa con el vehículo, el resumen dice qué es. */

  // Lo que va arriba, en el orden en que se mira. Cada entrada busca su
  // campo entre los que trajo el bot, con varios nombres posibles.
  var RESUMEN_CAMPOS = [
    { rot: 'Placa',      re: /^PLACA$/ },
    { rot: 'Marca',      re: /^MARCA$/ },
    { rot: 'Modelo',     re: /^MODELO$/ },
    { rot: 'Año',        re: /^A[NÑ]I?O/ },
    { rot: 'Color',      re: /^COLOR$/ },
    { rot: 'Propietario',re: /^PROPIETARIO/ },
    { rot: 'SOAT',       re: /^SOAT$/,     sub: /^VIGENCIA SOAT/,     subRot: 'hasta el' },
    { rot: 'Revisión',   re: /^REVISION T/, sub: /^VIGENCIA REVISION/, subRot: 'hasta el' },
  ];

  function renderMetaplaData(p, placa) {
    var prettyLabel = Consultia.ConsultaRunner ? Consultia.ConsultaRunner.prettyLabel : function (s) { return s; };

    // Todo lo que llegó, sin repetidos: el bot manda algún campo dos veces.
    var campos = [];
    var vistos = Object.create(null);
    if (placa) {
      vistos.PLACA = true;
      campos.push({ clave: 'PLACA', rotulo: 'Placa', valor: placa.toUpperCase() });
    }
    (p.secciones || []).forEach(function (s) {
      (s.campos || []).forEach(function (c) {
        if (!c.campo || isEmptyValue(c.valor)) return;
        var k = c.campo.toUpperCase().trim();
        if (vistos[k]) return;
        vistos[k] = true;
        campos.push({ clave: k, rotulo: prettyLabel(c.campo), valor: c.valor });
      });
    });
    if (!campos.length) return '';

    // Reparto: lo del resumen arriba, el resto abajo, sin duplicar.
    var enResumen = Object.create(null);
    var resumen = [];
    var buscar = function (re) {
      for (var i = 0; i < campos.length; i++) {
        if (!enResumen[campos[i].clave] && re.test(campos[i].clave)) return campos[i];
      }
      return null;
    };
    RESUMEN_CAMPOS.forEach(function (r) {
      var c = buscar(r.re);
      if (!c) return;
      enResumen[c.clave] = true;
      var celda = { rotulo: r.rot, valor: c.valor };
      if (r.sub) {
        var sc = buscar(r.sub);
        if (sc) { enResumen[sc.clave] = true; celda.sub = r.subRot + ' ' + sc.valor; }
      }
      resumen.push(celda);
    });
    var detalle = campos.filter(function (c) { return !enResumen[c.clave]; });

    var html = '<div class="rep-ficha">';

    if (resumen.length) {
      html += '<div class="rep-bloque">' +
        '<h4 class="rep-titulo">Resumen</h4>' +
        '<div class="rep-resumen">' +
          resumen.map(function (r) {
            return '<div class="res-celda">' +
              '<span class="res-k">' + escapeHtml(r.rotulo) + '</span>' +
              '<strong class="res-v">' + escapeHtml(r.valor) + '</strong>' +
              (r.sub ? '<span class="res-sub">' + escapeHtml(r.sub) + '</span>' : '') +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
    }

    if (detalle.length) {
      html += '<div class="rep-bloque">' +
        '<h4 class="rep-titulo">Detalle</h4>' +
        '<dl class="rep-detalle">' +
          detalle.map(function (c) {
            return '<div class="det-fila">' +
              '<dt class="det-k">' + escapeHtml(c.rotulo) + '</dt>' +
              '<dd class="det-v">' + escapeHtml(c.valor) + '</dd>' +
            '</div>';
          }).join('') +
        '</dl>' +
      '</div>';
    }

    return html + '</div>';
  }

  /* ── El veredicto en pantalla ────────────────────────────────────────
     Lo primero que necesita quien va a comprar un auto no son veintiún
     apartados: es saber si puede circular, si puede transferirlo y cuánto
     debe. Eso lo calcula js/modules/reporte-veredicto.js a partir del
     modelo, y aquí solo se pinta.

     Va ENCIMA de la ficha de datos por la misma razón por la que la placa
     va en la primera fila: es la conclusión, y una conclusión al final de
     veinte secciones no la lee nadie.

     Si algo falla —el modelo no está cargado, las secciones vienen
     raras—, no se pinta nada y el reporte sigue saliendo como antes. Un
     veredicto es un extra sobre el documento, no un requisito para que
     el documento exista. */
  function pintarVeredicto(parsed, placa) {
    if (!Consultia.ReporteModelo || !Consultia.ReporteVeredicto) return;
    var body = $('filter-result-body');
    if (!body || document.getElementById('rep-veredicto')) return;

    var r;
    try {
      var modelo = Consultia.ReporteModelo.desdeParsed(parsed, placa);
      r = Consultia.ReporteVeredicto.nivel(modelo);
      if (modelo.noMapeado.length) {
        // No se le enseña al cliente: es para nosotros, y es el aviso de
        // que el proveedor cambió el nombre de algún campo.
        console.info('[reporte] campos sin mapear:', modelo.noMapeado);
      }
    } catch (e) {
      console.warn('[reporte] no se pudo armar el veredicto:', e);
      return;
    }

    var chip = function (titulo, estado, detalle) {
      var clase = estado === 'si' ? 'ok' : (estado === 'no' ? 'mal' : 'duda');
      var palabra = estado === 'si' ? 'Sí'
        : (estado === 'no' ? 'No'
        : (estado === 'sin determinar' ? 'Sin determinar' : 'Con reparos'));
      return '<div class="ver-caja ver-' + clase + '">' +
        '<span class="ver-k">' + escapeHtml(titulo) + '</span>' +
        '<strong class="ver-v">' + palabra + '</strong>' +
        '<span class="ver-d">' + escapeHtml(detalle || '') + '</span>' +
      '</div>';
    };

    /* La deuda tiene tres estados, no dos. Cuando una sección trae
       registros pero ninguno se reconoce como importe, decir «S/ 0.00»
       es afirmar que el vehículo no debe nada — lo contrario de lo que
       sabemos. Ahí se dice que no se pudo totalizar. */
    function cajaDeuda(d) {
      var clase, valor, detalle;
      if (d.sinDeterminar) {
        clase = ' ver-duda'; valor = 'Sin determinar';
        detalle = 'El detalle del reporte todavía no se interpreta';
      } else if (!d.exacta && d.total === 0) {
        clase = ' ver-duda'; valor = 'No totalizada';
        detalle = 'Hay registros en ' + d.entidadesIlegibles.join(', ') + ' sin importe legible';
      } else {
        clase = d.total > 0 ? ' ver-mal' : ' ver-ok';
        valor = d.totalTexto;
        if (d.ilegibles) { clase = ' ver-duda'; detalle = 'Y hay deuda sin totalizar en ' + d.entidadesIlegibles.join(', '); }
        else if (d.fuentesMudas) detalle = d.fuentesMudas + ' fuente(s) sin respuesta';
        else detalle = 'Todas las fuentes respondieron';
      }
      return '<div class="ver-caja' + clase + '">' +
        '<span class="ver-k">Deuda registrada</span>' +
        '<strong class="ver-v">' + escapeHtml(valor) + '</strong>' +
        '<span class="ver-d">' + escapeHtml(detalle) + '</span>' +
      '</div>';
    }

    var html =
      // El nivel entra en el nombre de la clase, así que un espacio lo
      // partiría en dos clases: «sin determinar» daba `ver-nivel-sin` y
      // `determinar` suelta.
      '<div class="rep-veredicto ver-nivel-' + r.nivel.toLowerCase().replace(/\s+/g, '-') +
        '" id="rep-veredicto">' +
        '<div class="ver-cabecera">' +
          '<span class="ver-rotulo">Veredicto</span>' +
          '<strong class="ver-nivel">' + (r.nivel === 'SIN DETERMINAR'
            ? 'Parcial'
            : 'Riesgo ' + r.nivel.charAt(0) + r.nivel.slice(1).toLowerCase()) + '</strong>' +
        '</div>' +
        '<div class="ver-cajas">' +
          chip('Puede circular', r.circular.estado, r.circular.resumen) +
          chip('Puede transferirse', r.transferir.estado, r.transferir.resumen) +
          cajaDeuda(r.deuda) +
        '</div>' +
        (r.deuda.sinDeterminar
          ? '<p class="ver-nota">Este veredicto solo cubre las vigencias. Las deudas y los ' +
            'antecedentes están en el reporte adjunto: todavía no los interpretamos, y ' +
            'preferimos no afirmar nada antes que afirmarlo mal.</p>'
          : (r.deuda.completa ? '' :
            '<p class="ver-nota">Hay apartados que no devolvieron información. ' +
            'Lo que no se pudo consultar no significa que esté limpio.</p>')) +
      '</div>';

    body.insertAdjacentHTML('afterbegin', html);
  }

  /* â”€â”€ Catálogo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async function cargarCatalogo() {
    var comboText = $('filterComboText');
    var panel = $('filterComboPanel');
    try {
      catalog = await Consultia.ConsultaRunner.loadCatalog('filter');
      if (!catalog.length) {
        if (comboText) comboText.textContent = 'Sin consultas activas';
        if (panel) panel.innerHTML = '<div class="combo-empty">No hay consultas disponibles.</div>';
        return;
      }
      if (panel) {
        panel.innerHTML = catalog.map(function (c, i) {
          return '<div class="combo-option' + (i === 0 ? ' selected' : '') + '" data-id="' + c.id + '" role="option">' +
            '<span class="combo-opt-text">' + escapeHtml(c.nombre) + '</span>' +
          '</div>';
        }).join('');
      }
      setConsulta(catalog[0]);
      if (panel) panel.querySelectorAll('.combo-option').forEach(function (opt) {
        opt.addEventListener('click', function () {
          var id = opt.dataset.id;
          var c = catalog.find(function (x) { return x.id === id; });
          if (c) {
            setConsulta(c);
            panel.querySelectorAll('.combo-option').forEach(function (o) { o.classList.toggle('selected', o === opt); });
            var combo = $('filterCombo');
            if (combo) combo.classList.remove('open');
            $('filterComboBtn').setAttribute('aria-expanded', 'false');
          }
        });
      });
    } catch (err) {
      console.error('Error cargando catálogo filter:', err);
      if (comboText) comboText.textContent = 'Error cargando consultas';
      if (Consultia.toast) Consultia.toast({
        type: 'error',
        title: 'No se pudo cargar el catálogo',
        message: 'Revisa tu conexión y recarga la página.'
      });
    }
  }

  /* â”€â”€ Selección de consulta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function setConsulta(c) {
    currentConsulta = c;
    $('filterComboText').textContent = c.nombre;
    $('filter-desc').textContent = c.descripcion || '';
    var creditsEl = $('filter-credits');
    if (creditsEl) {
      var isPrem = c.categoria === 'premium' || c.requires_subscription;
      var BOLT = '<svg viewBox="0 0 24 24" fill="#141d1c" stroke="none" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;" aria-hidden="true"><path d="M13 2L4.5 13.5H11L10 22L20.5 10.5H14L13 2Z"/></svg>';
      creditsEl.innerHTML = isPrem ? BOLT + 'Premium' : c.precio_venta + ' crédito' + (c.precio_venta === 1 ? '' : 's');
      creditsEl.classList.toggle('is-premium', !!isPrem);
    }

    var input = $('filter-input');
    if (input) {
      input.placeholder = placeholderFor(c.tipo_dato);
      input.maxLength   = maxLenFor(c.tipo_dato);
      input.inputMode   = inputModeFor(c.tipo_dato);
      input.value       = '';
    }

    var emptyDesc = $('filter-empty-desc');
    if (emptyDesc) emptyDesc.textContent = c.descripcion || 'Ingrese el dato para realizar la consulta.';

    // Ocultar previews legacy
    ['filter-preview-pdf', 'filter-preview-txt', 'filter-preview-img', 'filter-preview-data'].forEach(function (id) {
      var el = $(id); if (el) el.hidden = true;
    });

    // Resetear resultado
    marcarConResultado(false);
    var resultPanel = $('filter-result');
    var empty = $('filter-empty');
    var body  = $('filter-result-body');
    if (resultPanel) resultPanel.hidden = true;
    if (empty) empty.hidden = false;
    if (body) { body.hidden = true; body.innerHTML = ''; }
    var status = $('filterResultStatus');
    if (status) {
      status.classList.remove('status-ok', 'status-loading');
      status.classList.add('status-empty');
      status.innerHTML = '';   // el chip vacío está oculto por CSS
    }

    // El Reporte Completo enseña de entrada todo lo que va a traer.
    if (REPORTE_EN_IMPLEMENTACION && esMetapla(c)) mostrarReporteEnImplementacion();
  }

  /* â”€â”€ Estado de carga â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function mostrarCargando() {
    var body  = $('filter-result-body');
    var empty = $('filter-empty');
    var rp = $('filter-result');
    if (rp) rp.hidden = false;
    if (empty) empty.hidden = true;
    if (body) {
      body.hidden = false;
      body.innerHTML =
        '<div class="cr-loading">' +
          '<div class="cr-spinner"></div>' +
          '<div class="cr-loading-text">Consultando…</div>' +
          '<div class="cr-loading-hint">Estamos recuperando los datos, puede demorar unos segundos.</div>' +
        '</div>';
    }
    var status = $('filterResultStatus');
    if (status) {
      status.classList.remove('status-empty', 'status-ok');
      status.classList.add('status-loading');
      status.innerHTML = '<span class="status-dot"></span> Consultando';
    }
  }

  function volverEstadoInicial() {
    var body  = $('filter-result-body');
    var empty = $('filter-empty');
    if (body) { body.hidden = true; body.innerHTML = ''; }
    if (empty) empty.hidden = false;
    var status = $('filterResultStatus');
    if (status) {
      status.classList.remove('status-loading', 'status-ok');
      status.classList.add('status-empty');
      status.innerHTML = '';   // el chip vacío está oculto por CSS
    }
  }

  /* â”€â”€ Ejecución de consulta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async function ejecutar() {
    if (!currentConsulta) return;
    var input = $('filter-input');
    var valor = input.value.trim();
    if (!valor) {
      input.focus();
      if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Falta el dato', message: 'Ingresa el dato para consultar.' });
      return;
    }
    var err = validarValor(currentConsulta.tipo_dato, valor);
    if (err) {
      if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Formato inválido', message: err });
      input.focus();
      return;
    }

    /* El Reporte Completo todavía no se entrega: se enseña lo que traerá y
       no se cobra ni se llama al bot. El día que se abra, se pone
       REPORTE_EN_IMPLEMENTACION en false y el resto del flujo —enfriamiento
       incluido— sigue donde estaba. */
    if (REPORTE_EN_IMPLEMENTACION && esMetapla(currentConsulta)) {
      mostrarReporteEnImplementacion();
      abrirModalReporte();
      return;
    }

    // Antispam: sólo el reporte /metapla queda en enfriamiento tras entregarse.
    if (esMetapla(currentConsulta)) {
      var restanteMs = metaplaCooldownUntil - Date.now();
      if (restanteMs > 0) {
        var restanteS = Math.ceil(restanteMs / 1000);
        if (Consultia.toast) Consultia.toast({
          type: 'warning',
          title: 'Espera un momento',
          message: 'Podrás pedir otro reporte en ' + restanteS + ' s.'
        });
        return;
      }
    }

    var user = await Consultia.Auth.getUser();
    if (!user) {
      if (Consultia.AuthModals) Consultia.AuthModals.openLogin();
      return;
    }

    var btn = $('filter-consultar');
    btn.disabled = true;
    btn.dataset.orig = btn.dataset.orig || btn.innerHTML;
    btn.innerHTML = 'Consultando…';
    mostrarCargando();

    try {
      var resp = await Consultia.ConsultaRunner.ejecutarConsultaConCobro(user.id, currentConsulta, valor);
      renderResultado(resp, valor);
      // La información ya se entregó: arrancar el enfriamiento de 60 s del reporte.
      if (esMetapla(currentConsulta)) metaplaCooldownUntil = Date.now() + METAPLA_COOLDOWN_MS;
      if (Consultia.SearchHistory) Consultia.SearchHistory.add(valor, currentConsulta && currentConsulta.categoria);
      if (Consultia.Favorites && Consultia.Favorites.injectStar) {
        var _rp = document.getElementById('filter-result-panel');
        if (_rp) Consultia.Favorites.injectStar(_rp, valor, currentConsulta && currentConsulta.categoria);
      }
      if (Consultia.renderDashboardStats) Consultia.renderDashboardStats();
      if (Consultia.AuthUI && Consultia.AuthUI.refresh) Consultia.AuthUI.refresh();
      if (Consultia.Subscription && Consultia.Subscription.refresh) Consultia.Subscription.refresh();
    } catch (e) {
      volverEstadoInicial();
      if (e && e.code === 'CANCELLED') return;
      console.error('Error ejecutando consulta filter:', e);
      if (e && e.message && /cr[eé]ditos?\s+insuficientes?/i.test(e.message)) {
        if (Consultia.SubscriptionGate && Consultia.SubscriptionGate.openNoCreditsModal) {
          Consultia.SubscriptionGate.openNoCreditsModal(currentConsulta);
        } else if (Consultia.toast) {
          Consultia.toast({ type: 'warning', title: 'Saldo insuficiente', message: 'Necesitas ' + currentConsulta.precio_venta + ' créditos.' });
        }
      } else {
        var errTitle = (e && e.code === 'EMPTY_RESPONSE') ? 'Búsqueda sin resultados' : 'No se pudo consultar';
        if (Consultia.toast) Consultia.toast({ type: 'error', title: errTitle, message: (e && e.message) || 'Intenta de nuevo.' });
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.orig;
    }
  }

  /* â”€â”€ Botones de respuesta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  // Conecta los botones inline que el bot devuelve como opciones
  /* Mismo cableado que las vistas de categoria: la implementacion vive en
     render-helpers.js. Esta copia se habia quedado atras —sin visor a
     pantalla completa, sin aviso de espera, con el colapsable «Ver
     detalles» ya retirado y buscando una ilustracion que ya no se
     dibuja—, que es justo lo que pasa cuando el mismo flujo se escribe
     dos veces. */
  function wireResultButtons(container) {
    H.wireOpcionesDelBot(container, {
      consulta:        function () { return currentConsulta; },
      status:          function () { return $('filterResultStatus'); },
      prefix:          'fl',
      alNuevaConsulta: volverAlFormulario,
      alResultado:     function () { marcarConResultado(true); },
      alFallback:      function (resp) { renderResultado(resp); }
    });
  }

  /* â”€â”€ Renderizado de resultado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  // `valorConsultado` es lo que escribió el cliente. Llega como argumento
  // y no se relee del campo: al reintentar o al cambiar de consulta el
  // campo puede estar ya vacío o con otra cosa.
  function renderResultado(resp, valorConsultado) {
    revokeActiveBlobUrls();
    var p       = H.recortarAlResumen(resp.parsed || {}, currentConsulta && currentConsulta.comando);
    // Con `H.` por delante: un navegador que arrastre la versión vieja de
    // render-helpers en caché no las tiene, y sin la guarda reventaría la
    // pantalla entera por un sello.
    if (H.fijarEmision) H.fijarEmision(resp);   // fecha y folio de la ficha
    var htmlMtc = (currentConsulta && /^\/mtc\b/i.test(currentConsulta.comando || '') && H.renderMtc)
      ? H.renderMtc(p) : '';
    var pdfs    = H.pdfsDe(p);
    var photos  = (p.medios || []).filter(function (m) { return m.tipo === 'photo'; });
    var botones = p.botones || [];
    var _metaRe = /^(cr[eé]ditos?|credits?|user(name)?|comando|plan|monedas?|consultado\s+por|usuario|mensaje|costo|uso|info|id)\s*$/i;
    var _valRe = /^(la\s+consulta\s+se\s+hizo|consulta\s+(exitosa|realizada)|resultado\s+(exitoso|listo)|obteniendo|consultando|buscando|procesando|generando|cargando|#\w+|∞|♾)/i;
    var hasData = (p.secciones || []).some(function (s) {
      return (s.campos || []).some(function (c) {
        if (c.campo && _metaRe.test(c.campo.trim())) return false;
        if (!c.campo && c.valor && _valRe.test(c.valor.trim())) return false;
        return !!(c.campo || (c.valor && c.valor.trim()));
      });
    });
    var hasMedia = pdfs.length > 0 || photos.length > 0;

    // La misma comprobación de arriba, no una copia: repetida a mano se
    // quedó con el nombre viejo del comando cuando el reporte cambió de
    // bot, y el render propio del reporte dejaba de aplicarse.
    var esReporte = esMetapla(currentConsulta);

    var body = $('filter-result-body');
    var html;
    // Cuando la respuesta es solo texto suelto (sin PDF ni tabla), el botón
    // genérico igual arma un informe propio a partir de esas líneas.
    var pParaPdf = p;
    var abrirVisor = false;   // el documento es el resultado, no un adjunto

    if (H.esRespuestaEnProceso(p)) {
      /* El acuse de recibo del proveedor trae SU logo adjunto: ni el aviso
         ni el logo son el resultado. */
      html = H.htmlEnProceso();
    } else if (esErrorTecnicoRespuesta(p, resp)) {
      html = htmlMantenimiento();
    } else if (esReporte) {
      // Los datos van como tabla + placeholder para el PDF rediseñado.
      html = renderMetaplaData(p, valorConsultado) + '<div id="metapla-pdf-area"><div class="cr-pdf-loading">Generando reporte PDF...</div></div>';
    } else if (botones.length > 0 && !hasMedia) {
      html = renderButtonList(p, botones);
    } else if (htmlMtc) {
      // La licencia tiene su propia ficha: membrete, rejilla y papeletas.
      html = (pdfs.length > 0 ? renderPdfDlBar(pdfs) : renderPdfTopButton()) +
        htmlMtc + renderDocumentCard(pdfs) + H.renderOpcionesSueltas(botones);
    } else if (hasData || photos.length > 0) {
      // Mismo trato que las vistas de categoria: previsualización real del
      // PDF debajo y su «Descargar» sube a la cabecera junto a «Nueva consulta».
      html = (pdfs.length > 0 ? renderPdfDlBar(pdfs) : renderPdfTopButton()) +
        renderDataWithMedia(p, photos) + renderDocumentCard(pdfs) +
        // Opciones junto a la ficha: antes se perdían y no se podía elegir.
        H.renderOpcionesSueltas(botones);
      /* Con ficha delante no se tapa al cliente con el visor: lo abre él.
         Salvo que el catálogo lo pida para esta consulta (`abrir_visor`). */
      abrirVisor = pdfs.length === 1 && !!(currentConsulta && (currentConsulta.respuesta_formato || {}).abrir_visor);
    } else if (pdfs.length > 0) {
      // Solo vino un PDF, sin datos: el documento ES el resultado, así que se
      // enseña en el visor en vez de dejarlo tras un clic en la miniatura.
      html = renderPdfDlBar(pdfs) + renderDocumentCard(pdfs) + H.renderOpcionesSueltas(botones);
      abrirVisor = pdfs.length === 1 && !botones.length;
    } else {
      var rawText = (p.raw || '').trim();
      var _rawH3 = /^(obteniendo|consultando|buscando|procesando|generando|cargando|la\s+consulta\s+se\s+hizo|consulta\s+(exitosa|realizada)|resultado\s+(exitoso|listo)|cr[eé]ditos?|credits?|nombre|user(name)?|comando|plan\b|monedas?|consultado\s+por|usuario|mensaje|estado|#\w+|∞|♾)/i;
      rawText = rawText.split(/\r?\n/).filter(function (l) { var t = l.replace(/\[\s*[^\]]*\]\s*/g, '').trim(); return t && !_rawH3.test(t); }).join('\n').trim();
      var doc = (p.medios || []).find(function (m) { return m.tipo === 'document' && m.filename && m.filename.endsWith('.txt'); });
      if (doc && doc.base64) {
        try { rawText += '\n\n' + decodeURIComponent(escape(atob(doc.base64))); } catch (e) { rawText += '\n\n' + atob(doc.base64); }
      }
      if (rawText.length > 5) {
        if (esErrorTecnico(rawText)) {
          html = htmlMantenimiento();
        } else {
          // El generador trabaja con secciones: el texto va linea por linea.
          pParaPdf = { secciones: [{ titulo: '', campos: rawText.split(/\r?\n/).map(function (l) { return { valor: l }; }) }] };
          html = renderPdfTopButton() +
            '<div class="cr-txt-layout"><div class="cr-txt-data" style="padding: 16px;"><div style="white-space: pre-wrap; font-family: monospace; font-size: var(--fs-sm); line-height: 1.5;">' + escapeHtml(rawText) + '</div></div></div>';
        }
      } else {
        html = '<div class="cr-loading"><div class="cr-loading-text">No se encontraron datos para mostrar.</div></div>';
      }
    }

    body.innerHTML = html;
    if (esReporte) pintarVeredicto(p, valorConsultado);
    body.hidden = false;

    // Se cablean siempre que existan en el DOM, traiga o no medios.
    if (botones.length > 0) wireResultButtons(body);

    // «Descargar» de la cabecera: arma el informe al vuelo con los datos que
    // ya estan en pantalla. No existe cuando ya hay una tarjeta de PDF (esa
    // trae su propio Visualizar/Descargar) ni en /metapla (botón aparte).
    var pdfBtn = body.querySelector('.cr-btn-pdf-generic');
    if (pdfBtn) {
      var valorPdf = valorConsultado || ($('filter-input') ? $('filter-input').value.trim() : '');
      pdfBtn.addEventListener('click', function () {
        descargarPdfConOverlay(function () {
          return Consultia.ReportGenerator.generate(pParaPdf, {
            consultaNombre: currentConsulta ? currentConsulta.nombre : 'Consulta',
            valor: valorPdf,
            fecha: new Date().toLocaleDateString('es-PE', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })
          }, photos);
        });
      });
    }

    // /metapla: rediseñar por completo el PDF del bot con el estilo FV+
    // (extrae texto + imágenes del original y arma un documento nuevo).
    var metaplaPdfArea = document.getElementById('metapla-pdf-area');
    if (metaplaPdfArea && esReporte && pdfs.length && pdfs[0].base64 && Consultia.MetaplaReport) {
      (function (pdfsRef, valorRef) {
        (async function () {
          try {
            var result = await Consultia.MetaplaReport.generate(pdfsRef[0].base64, {
              valor: valorRef || '',
              fecha: new Date().toLocaleDateString('es-PE', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              }),
              // El veredicto del PDF sale de los mismos campos que el de
              // pantalla, no de las secciones deducidas del documento.
              parsed: p
            }, function (n, total) {
              metaplaPdfArea.innerHTML =
                '<div class="cr-pdf-loading">Generando reporte PDF… ' + n + ' de ' + total + '</div>';
            });
            if (!result) throw new Error('MetaplaReport devolvió null');
            // Mismo componente que el resto de la plataforma: «Descargar»
            // reutiliza el reporte ya generado (result.blobUrl/base64), no
            // el PDF original del bot.
            var reportePdf = [{ base64: result.base64, filename: result.filename || 'reporte.pdf', mimeType: 'application/pdf' }];
            metaplaPdfArea.innerHTML = renderPdfDlBar(reportePdf, 'Descargar Reporte PDF') + renderDocumentCard(reportePdf);
          } catch (e) {
            console.error('[metapla-report]', e);
            // Fallback: el PDF original del bot, para no dejar al usuario sin documento.
            metaplaPdfArea.innerHTML = renderPdfDlBar(pdfsRef, 'Descargar Reporte PDF') + renderDocumentCard(pdfsRef);
          }
        })();
      // La placa consultada, no lo que haya en el campo ahora: para cuando
      // el PDF termina de armarse, el cliente puede haber escrito otra cosa.
      })(pdfs, valorConsultado || ($('filter-input') ? $('filter-input').value.trim() : ''));
    }

    var empty = $('filter-empty');
    if (empty) empty.hidden = true;

    var status = $('filterResultStatus');
    if (status) {
      status.classList.remove('status-empty', 'status-loading');
      if (botones.length > 0 && !hasMedia) {
        status.classList.remove('status-ok');
        status.classList.add('status-empty');
        status.innerHTML = '<span class="status-dot"></span> Elige una opción';
      } else {
        status.classList.add('status-ok');
        status.innerHTML = '<span class="status-dot"></span> Completado';
        if (resp.costo_deducido > 0 && Consultia.toast) {
          Consultia.toast({
            type: 'info',
            title: 'Cobro exitoso',
            message: 'Se han descontado ' + resp.costo_deducido + ' créditos.',
            duration: 4000
          });
        }
      }
    }

    /* Mismo trato que en las vistas de categoria (category-view.js): con
       el resultado delante se esconden el selector y el formulario, y la
       pagina sube arriba del todo.

       Antes habia aqui un `scrollIntoView()` al cuerpo del resultado, que
       llevaba por debajo de la cabecera; con los dos cuadros escondidos
       el resultado ya esta en lo alto y ese salto dejaba la ficha a
       medias. */
    marcarConResultado(true);
    // Después de `marcarConResultado`: esa llamada sube «Descargar» a la
    // cabecera, y el visor tiene que encontrar la ficha ya montada.
    if (abrirVisor) H.abrirVisorDelResultado(body, volverAlFormulario);
  }

  /* Modo resultado, exactamente el mismo que en las vistas de categoria:
     la implementacion vive en render-helpers.js. Esta vista tiene su
     propio modulo y no sale de la fabrica de category-view.js, pero
     comparte el comportamiento entero — antes estaba duplicado aqui y
     era cuestion de tiempo que las dos copias se separaran. */
  function marcarConResultado(hay) {
    var vista = document.getElementById('view-filter');
    if (!vista) return;
    if (hay) H.entrarModoResultado(vista, volverAlFormulario);
    else H.salirModoResultado(vista);
  }

  function volverAlFormulario() {
    var body = $('filter-result-body');
    if (body) { body.hidden = true; body.innerHTML = ''; }
    var prev = $('filter-preview-data');
    if (prev) { prev.hidden = true; prev.innerHTML = ''; }
    var rp = $('filter-result');
    if (rp) rp.hidden = true;
    var empty = $('filter-empty');
    if (empty) empty.hidden = false;
  }

  /* â”€â”€ API pública â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  Consultia.initFilterCombo = function () {
    var combo    = $('filterCombo');
    var comboBtn = $('filterComboBtn');
    if (!combo || !comboBtn) return;

    comboBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = combo.classList.toggle('open');
      comboBtn.setAttribute('aria-expanded', String(open));
      if (open) Consultia.RenderHelpers.ajustarComboPanel($('filterComboPanel'));
    });
    // Cierre al pulsar fuera. Se pregunta por el BOTÓN y por el PANEL, no
    // por el `.combo` entero: el velo del cuadro flotante es un
    // pseudoelemento del propio `.combo`, así que un clic en él llega con
    // `e.target` apuntando al `.combo` y con la condición anterior
    // —`!combo.contains(e.target)`— el cuadro no se cerraba nunca.
    document.addEventListener('click', function (e) {
      if (comboBtn.contains(e.target)) return;
      var panel = $('filterComboPanel');
      if (panel && panel.contains(e.target)) return;
      combo.classList.remove('open');
      comboBtn.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        combo.classList.remove('open');
        comboBtn.setAttribute('aria-expanded', 'false');
      }
    });

    var btn   = $('filter-consultar');
    var input = $('filter-input');
    if (btn)   btn.addEventListener('click', ejecutar);
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ejecutar(); });

    catalogReadyPromise = cargarCatalogo();

    /* CTA «Reporte completo»: cambia el tipo de consulta al reporte y, si
       la placa ya está escrita, lo lanza. Ya estamos en view-filter, no
       hay que navegar.

       Dos cosas que hacía mal. Buscaba la consulta por `/metapla`, y el
       reporte cambió de bot y de comando a `/mpla`: no encontraba nada y
       el botón no hacía absolutamente nada. Y vaciaba el campo, así que
       la placa que el cliente acababa de escribir —justo encima, en la
       misma caja— se perdía y había que teclearla otra vez.

       Ahora la placa se guarda antes de cambiar de consulta y se repone
       después, porque `setConsulta` limpia el campo al cambiar de tipo.
       Con placa, se ejecuta; sin ella, el foco cae en el campo y basta
       con escribirla y pulsar Enter. */
    var ctaBtn = $('ctaReporteBtn');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', async function () {
        try { await catalogReadyPromise; } catch (_) {}
        var item = catalog.find(esMetapla);
        if (!item) {
          if (Consultia.toast) Consultia.toast({
            type: 'error',
            title: 'No disponible',
            message: 'El Reporte Completo no está en el catálogo ahora mismo.',
          });
          return;
        }
        var placa = input ? input.value.trim() : '';
        selectByOptionId(item.id);
        if (input) {
          input.value = placa;
          input.focus();
        }
        if (placa) ejecutar();
      });
    }
  };

  function selectByOptionId(optionId) {
    if (!optionId || !catalog.length) return;
    var c = catalog.find(function (x) { return x.id === optionId; });
    if (!c) return;
    setConsulta(c);
    var panel = $('filterComboPanel');
    if (panel) {
      panel.querySelectorAll('.combo-option').forEach(function (o) {
        o.classList.toggle('selected', o.dataset.id === optionId);
      });
    }
  }

  Consultia.setFilterOption = selectByOptionId;

  // API pública para otros módulos (ej. CTAs) que necesiten leer el catálogo.
  Consultia.FilterView = {
    getCatalog: function () { return catalog; },
    whenReady: function () { return catalogReadyPromise || Promise.resolve(); },
  };
})();
