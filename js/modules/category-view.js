/* ============================================================
   CATEGORY VIEW FACTORY
   Genera la lógica común para cada vista de consulta (reniec,
   telefonia, familiares, etc.) a partir de un prefijo de IDs
   y la categoría del catálogo.

   Uso:
     Consultia.createCategoryView({
       prefix: 'reniec',
       categoria: 'reniec',
       initName: 'initReniecCombo',
     });

   Requiere que el HTML use estos IDs:
     #{prefix}Combo, #{prefix}ComboBtn, #{prefix}ComboText, #{prefix}ComboPanel
     #{prefix}-desc, #{prefix}-credits
     #{prefix}-input, #{prefix}-consultar
     #{prefix}-empty, #{prefix}-empty-desc, #{prefix}-empty-credits (opcional)
     #{prefix}ResultStatus
     #{prefix}-result-body

   Las funciones de renderizado compartidas (escapeHtml, renderDataRows,
   renderPdfPreview, etc.) viven en render-helpers.js y se acceden a
   través de Consultia.RenderHelpers.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  // Shared registry: each combo registers itself so a single global
  // click/keydown listener can close all open combos.
  var _combos = [];
  var _globalBound = false;

  // Alias render helpers — render-helpers.js carga antes que este módulo.
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
  var renderGallery           = H.renderGallery;
  var renderDataWithMedia     = H.renderDataWithMedia; // ya estaba aliasado, ahora sí se usa
  var renderPdfPreview        = H.renderPdfPreview;
  var renderButtonList        = H.renderButtonList;
  var applyDniLayout          = H.applyDniLayout;
  var mediaCountClass         = H.mediaCountClass;
  var renderFacialHero        = H.renderFacialHero;
  var renderTabla             = H.renderTabla;
  var renderDocumentCard      = H.renderDocumentCard;
  var renderPdfDlBar          = H.renderPdfDlBar;
  var renderNmPersonas        = H.renderNmPersonas;
  var renderArbolGenealogico  = H.renderArbolGenealogico;
  var renderPdfTopButton      = H.renderPdfTopButton;

  function bindGlobalComboListeners() {
    if (_globalBound) return;
    _globalBound = true;
    // Cierre al pulsar fuera. Se pregunta por el BOTÓN y por el PANEL, no
    // por el `.combo` entero: el velo del cuadro flotante es un
    // pseudoelemento del propio `.combo`, así que un clic en él llega con
    // `e.target` apuntando al `.combo` y el cuadro no se cerraría nunca.
    document.addEventListener('click', function (e) {
      _combos.forEach(function (c) {
        if (c.btn.contains(e.target)) return;
        var panel = c.combo.querySelector('.combo-panel');
        if (panel && panel.contains(e.target)) return;
        c.combo.classList.remove('open');
        c.btn.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        _combos.forEach(function (c) {
          c.combo.classList.remove('open');
          c.btn.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  // ============================================================
  // Factory
  // ============================================================
  Consultia.createCategoryView = function (opts) {
    var prefix = opts.prefix;
    var categoria = opts.categoria;
    var $ = function (id) { return document.getElementById(id); };

    var catalog = [];
    var currentConsulta = null;
    var selectedFile = null;        // File seleccionado (para tipo_dato="foto")
    var selectedFileBase64 = null;  // base64 del archivo sin el prefijo data:

    /* Modo resultado: esconder el selector y el formulario, subir
       «Descargar» a la cabecera, poner «Nueva consulta» y llevar la
       pagina arriba. La implementacion esta en render-helpers.js
       (entrarModoResultado) para que sea LA MISMA en todas las vistas,
       incluida «Consulta Vehicular», que no sale de esta fabrica. */
    function vistaEl() {
      var body = $(bodyId());
      return body ? body.closest('.view') : null;
    }

    function marcarConResultado(hay) {
      var vista = vistaEl();
      if (!vista) return;
      if (hay) H.entrarModoResultado(vista, volverEstadoInicial);
      else H.salirModoResultado(vista);
    }

    function bodyId()   { return prefix + '-result-body'; }
    function emptyId()  { return prefix + '-empty'; }
    function statusId() { return prefix + 'ResultStatus'; }

    async function cargarCatalogo() {
      var comboText = $(prefix + 'ComboText');
      var panel = $(prefix + 'ComboPanel');
      try {
        catalog = await Consultia.ConsultaRunner.loadCatalog(categoria);
        if (!catalog.length) {
          if (comboText) comboText.textContent = 'Sin consultas activas';
          if (panel) panel.innerHTML = '<div class="combo-empty">No hay consultas disponibles.</div>';
          return;
        }
        if (panel) {
          // Agrupar por subcategoria si algún item la tiene
          var hasSubs = catalog.some(function (c) { return c.subcategoria; });
          if (hasSubs) {
            var groups = [];
            var groupMap = Object.create(null);
            catalog.forEach(function (c) {
              var g = c.subcategoria || '';
              if (!groupMap[g]) { groupMap[g] = []; groups.push(g); }
              groupMap[g].push(c);
            });
            var firstItem = true;
            panel.innerHTML = groups.map(function (g) {
              var header = g ? '<div class="combo-group-header">' + escapeHtml(g) + '</div>' : '';
              var opts = groupMap[g].map(function (c) {
                var sel = firstItem ? ' selected' : '';
                firstItem = false;
                return '<div class="combo-option' + sel + '" data-id="' + c.id + '" role="option">' +
                  '<span class="combo-opt-text">' + escapeHtml(c.nombre) + '</span>' +
                '</div>';
              }).join('');
              return header + opts;
            }).join('');
          } else {
            panel.innerHTML = catalog.map(function (c, i) {
              return '<div class="combo-option' + (i === 0 ? ' selected' : '') + '" data-id="' + c.id + '" role="option">' +
                '<span class="combo-opt-text">' + escapeHtml(c.nombre) + '</span>' +
              '</div>';
            }).join('');
          }
        }
        setConsulta(catalog[0]);
        if (panel) panel.querySelectorAll('.combo-option').forEach(function (opt) {
          opt.addEventListener('click', function () {
            var id = opt.dataset.id;
            var c = catalog.find(function (x) { return x.id === id; });
            if (c) {
              setConsulta(c);
              panel.querySelectorAll('.combo-option').forEach(function (o) { o.classList.toggle('selected', o === opt); });
              var combo = $(prefix + 'Combo');
              if (combo) combo.classList.remove('open');
              $(prefix + 'ComboBtn').setAttribute('aria-expanded', 'false');
            }
          });
        });
      } catch (err) {
        console.error('Error cargando catálogo ' + categoria + ':', err);
        if (comboText) comboText.textContent = 'Error cargando consultas';
      }
    }

    // Muestra/oculta los 3 campos de búsqueda por nombre cuando el comando es /nm
    function renderCommandHint(c) {
      var hostId = prefix + '-hint';
      var existing = $(hostId);
      if (existing) existing.remove();

      var formRow = document.querySelector('#' + prefix + '-input')
        ? document.querySelector('#' + prefix + '-input').closest('.form-row')
        : null;
      var nmRow = $(prefix + '-nm-row');

      if (c && c.comando && c.comando.indexOf('/nm') === 0) {
        if (formRow) formRow.style.display = 'none';
        if (!nmRow) {
          var panelParent = formRow ? formRow.parentNode : null;
          if (!panelParent) return;
          nmRow = document.createElement('div');
          nmRow.id = prefix + '-nm-row';
          nmRow.className = 'nm-fields';
          nmRow.innerHTML =
            '<p class="nm-hint">Completa al menos 2 campos: nombre + apellido, o ambos apellidos.</p>' +
            '<div class="nm-inputs">' +
              '<input type="text" class="input nm-input" id="' + prefix + '-nm-nombres" placeholder="Nombres" autocomplete="off">' +
              '<input type="text" class="input nm-input" id="' + prefix + '-nm-appat" placeholder="Apellido paterno" autocomplete="off">' +
              '<input type="text" class="input nm-input" id="' + prefix + '-nm-apmat" placeholder="Apellido materno" autocomplete="off">' +
            '</div>' +
            '<button class="btn btn-primary" type="button" id="' + prefix + '-nm-consultar">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
              ' Consultar' +
            '</button>';
          if (formRow) panelParent.insertBefore(nmRow, formRow.nextSibling);
          else panelParent.appendChild(nmRow);
          var nmBtn = $(prefix + '-nm-consultar');
          if (nmBtn) nmBtn.addEventListener('click', ejecutar);
          nmRow.querySelectorAll('.nm-input').forEach(function (inp) {
            inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') ejecutar(); });
          });
        }
        nmRow.style.display = '';
        nmRow.querySelectorAll('.nm-input').forEach(function (inp) { inp.value = ''; });
      } else {
        if (formRow) formRow.style.display = '';
        if (nmRow) nmRow.style.display = 'none';
      }
    }

    // Formatea el valor según el comando antes de mandarlo al bot.
    // /nm — valida 3 segmentos separados por "|" y reemplaza espacios internos
    //       por "+" (apellidos) o "," (nombres).
    function formatValueForCommand(consulta, valor) {
      if (!consulta || !consulta.comando) return { value: valor };
      if (consulta.comando.indexOf('/nm') === 0) {
        // Si el usuario pegó "/nm ..." por error, quitamos el prefijo
        valor = valor.replace(/^\/nm\s+/i, '').trim();
        var partes = valor.split('|').map(function (p) { return p.trim(); });
        if (partes.length !== 3) {
          return { error: 'El formato debe ser: nombres|apellido paterno|apellido materno (3 campos separados por |)' };
        }
        var nombres = partes[0];
        var apPat = partes[1];
        var apMat = partes[2];
        var filled = (nombres ? 1 : 0) + (apPat ? 1 : 0) + (apMat ? 1 : 0);
        if (filled < 2) {
          return { error: 'Completa al menos 2 de los 3 campos.' };
        }
        // Espacios internos: , para nombres, + para apellidos
        nombres = nombres.replace(/\s+/g, ',');
        apPat = apPat.replace(/\s+/g, '+');
        apMat = apMat.replace(/\s+/g, '+');
        return { value: nombres + '|' + apPat + '|' + apMat };
      }
      return { value: valor };
    }

    function setConsulta(c) {
      currentConsulta = c;
      var comboText = $(prefix + 'ComboText');
      var desc = $(prefix + '-desc');
      var credits = $(prefix + '-credits');
      if (comboText) comboText.textContent = c.nombre;
      if (desc) desc.textContent = c.descripcion || '';
      if (credits) {
        var isPrem = c.categoria === 'premium' || c.requires_subscription;
        var BOLT = '<svg viewBox="0 0 24 24" fill="#141d1c" stroke="none" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;" aria-hidden="true"><path d="M13 2L4.5 13.5H11L10 22L20.5 10.5H14L13 2Z"/></svg>';
        credits.innerHTML = isPrem ? BOLT + 'Premium' : c.precio_venta + ' crédito' + (c.precio_venta === 1 ? '' : 's');
        credits.classList.toggle('is-premium', !!isPrem);
      }

      var input = $(prefix + '-input');
      if (input) {
        // Placeholder especial para /nm (búsqueda por nombres)
        if (c.comando && c.comando.indexOf('/nm') === 0) {
          input.placeholder = 'nombres|apellido paterno|apellido materno';
          input.maxLength = 120;
          input.inputMode = 'text';
        } else {
          input.placeholder = placeholderFor(c.tipo_dato);
          input.maxLength = maxLenFor(c.tipo_dato);
          input.inputMode = inputModeFor(c.tipo_dato);
        }
        input.value = '';
      }
      // Para tipo_dato="foto" — solo habilitamos el botón si ya hay archivo
      if (c.tipo_dato === 'foto') {
        var btnFoto = $(prefix + '-consultar');
        if (btnFoto) btnFoto.disabled = !selectedFile;
      }

      // Hint especial para comandos que requieren formato específico (ej: /nm)
      renderCommandHint(c);

      var emptyDesc = $(prefix + '-empty-desc');
      if (emptyDesc) emptyDesc.textContent = c.descripcion || 'Ingrese el dato para realizar la consulta.';
      var emptyCredits = $(prefix + '-empty-credits');
      if (emptyCredits) {
        emptyCredits.textContent = 'La consulta requiere ' + c.precio_venta + ' crédito' + (c.precio_venta === 1 ? '' : 's');
      }

      if (Consultia.LayoutEditor && Consultia.LayoutEditor.setActiveProfile) {
        Consultia.LayoutEditor.setActiveProfile(c.id, c.nombre, c);
      }

      var empty = $(emptyId());
      var body = $(bodyId());
      marcarConResultado(false);
      if (empty) empty.hidden = false;
      if (body) { body.hidden = true; body.innerHTML = ''; }
      var status = $(statusId());
      if (status) {
        status.classList.remove('status-ok', 'status-loading');
        status.classList.add('status-empty');
        status.innerHTML = '<span class="status-dot"></span> Esperando consulta';
      }
    }

    function mostrarCargando() {
      var body = $(bodyId());
      var empty = $(emptyId());
      var rp = body ? body.closest('.result-panel') : null;
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
      var status = $(statusId());
      if (status) {
        status.classList.remove('status-empty', 'status-ok');
        status.classList.add('status-loading');
        status.innerHTML = '<span class="status-dot"></span> Consultando';
      }
    }

    function volverEstadoInicial() {
      var body = $(bodyId());
      var empty = $(emptyId());
      marcarConResultado(false);
      if (body) { body.hidden = true; body.innerHTML = ''; }
      if (empty) empty.hidden = false;
      var status = $(statusId());
      if (status) {
        status.classList.remove('status-loading', 'status-ok');
        status.classList.add('status-empty');
        status.innerHTML = '<span class="status-dot"></span> Esperando consulta';
      }
    }

    function renderResultado(resp, valorConsultado) {
      // Liberar blob URLs de resultados anteriores
      revokeActiveBlobUrls();
      var p = resp.parsed || {};
      var pdfs    = (p.medios || []).filter(function (m) { return m.tipo === 'pdf'; });
      var photos  = (p.medios || []).filter(function (m) { return m.tipo === 'photo'; });
      var botones = p.botones || [];
      var _metaRe = /^(cr[eé]ditos?|credits?|nombre|user(name)?|comando|plan|monedas?|consultado\s+por|usuario|mensaje|estado|costo|uso|info|id)\s*$/i;
      var _valRe = /^(la\s+consulta\s+se\s+hizo|consulta\s+(exitosa|realizada)|resultado\s+(exitoso|listo)|obteniendo|consultando|buscando|procesando|generando|cargando|#\w+|∞|♾)/i;
      var hasData = (p.secciones || []).some(function (s) {
        return (s.campos || []).some(function (c) {
          if (c.campo && _metaRe.test(c.campo.trim())) return false;
          if (!c.campo && c.valor && _valRe.test(c.valor.trim())) return false;
          return !!(c.campo || (c.valor && c.valor.trim()));
        });
      });
      var hasMedia = pdfs.length > 0 || photos.length > 0;
      var hasFacial = p.facial && p.facial.length > 0;
      var hasTabla  = p.tabla && p.tabla.filas && p.tabla.filas.length > 0;
      var esArbol = currentConsulta && currentConsulta.comando && /^\/ag\s/i.test(currentConsulta.comando);
      var htmlArbol = esArbol ? renderArbolGenealogico(p, valorConsultado) : '';

      var body = $(bodyId());
      var html;
      // Cuando la respuesta es solo texto suelto (sin PDF ni tabla), el botón
      // genérico igual arma un informe propio a partir de esas líneas.
      var pParaPdf = p;
      if (esErrorTecnicoRespuesta(p, resp)) {
        html = htmlMantenimiento();
      } else if (hasFacial) {
        html = renderPdfTopButton() + renderFacialHero(p.facial);
      } else if (hasTabla) {
        html = renderPdfTopButton() + renderTabla(p.tabla);
      } else if (currentConsulta && currentConsulta.comando && currentConsulta.comando.indexOf('/nm') === 0) {
        html = renderNmPersonas(p, botones, valorConsultado);
      } else if (htmlArbol) {
        html = htmlArbol;
      } else if (botones.length > 0 && !hasMedia) {
        html = renderButtonList(p, botones);
      } else if (hasData || photos.length > 0) {
        // Datos visibles de inmediato (tabla + fotos al costado); si además
        // vino un PDF, la previsualización real va debajo y su «Descargar»
        // sube a la cabecera junto a «Nueva consulta» — igual que VeriNexo,
        // nunca se esconden los datos detrás del visor de PDF.
        html = (pdfs.length > 0 ? renderPdfDlBar(pdfs) : renderPdfTopButton()) +
          renderDataWithMedia(p, photos) + renderDocumentCard(pdfs, prefix);
      } else if (pdfs.length > 0) {
        // Solo vino un PDF, sin datos: previsualización debajo, «Descargar»
        // sube a la cabecera igual que en cualquier otra vista.
        html = renderPdfDlBar(pdfs) + renderDocumentCard(pdfs, prefix);
      } else {
        var rawText = (p.raw || '').trim();
        rawText = rawText.replace(/\[\s*\]/g, '').replace(/\[\s*-\s*\]/g, '').trim();
        var _rawHide = /^(obteniendo|consultando|buscando|procesando|generando|cargando|la\s+consulta\s+se\s+hizo|consulta\s+(exitosa|realizada)|resultado\s+(exitoso|listo)|cr[eé]ditos?|credits?|nombre|user(name)?|comando|plan\b|monedas?|consultado\s+por|usuario|mensaje|estado|#\w+|∞|♾)/i;
        rawText = rawText.split(/\r?\n/).filter(function (l) {
          var t = l.replace(/\[\s*[^\]]*\]\s*/g, '').trim();
          return t && !_rawHide.test(t);
        }).join('\n').trim();
        var doc = (p.medios || []).find(function (m) { return m.tipo === 'document' && m.filename && m.filename.endsWith('.txt'); });
        if (doc && doc.base64) {
          try { rawText += '\n\n' + decodeURIComponent(escape(atob(doc.base64))); } catch (e) { rawText += '\n\n' + atob(doc.base64); }
        }
        if (rawText.length > 5) {
          if (esErrorTecnico(rawText)) {
            html = htmlMantenimiento();
          } else {
            // El generador de informes trabaja con secciones; el texto suelto
            // se le entrega linea por linea (las que son «CLAVE: valor» las
            // reconoce y salen como fila normal).
            pParaPdf = { secciones: [{ titulo: '', campos: rawText.split(/\r?\n/).map(function (l) { return { valor: l }; }) }] };
            html = renderPdfTopButton() +
              '<div class="cr-txt-layout"><div class="cr-txt-data" style="padding: 16px;"><div style="white-space: pre-wrap; font-family: monospace; font-size: var(--fs-sm); line-height: 1.5;">' + escapeHtml(rawText) + '</div></div></div>';
          }
        } else {
          html = '<div class="cr-loading"><div class="cr-loading-text">No se encontraron datos para mostrar.</div></div>';
        }
      }

      body.innerHTML = html;
      body.hidden = false;
      var isNm = currentConsulta && currentConsulta.comando && currentConsulta.comando.indexOf('/nm') === 0;
      if (isNm) wireNmButtons(body, valorConsultado);
      else if (html === htmlArbol) { body.__arbolRaw = p.raw || ''; wireArbolButtons(body, valorConsultado); }
      else if (botones.length > 0 && !hasMedia && !hasFacial && !hasTabla) wireResultButtons(body);
      wireGenericPdfButton(body, pParaPdf, valorConsultado, photos);

      var empty = $(emptyId());
      if (empty) empty.hidden = true;
      marcarConResultado(true);

      var status = $(statusId());
      if (status) {
        status.classList.remove('status-empty', 'status-loading');
        if (botones.length > 0 && !hasMedia && !isNm) {
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

      /* Aqui habia un `body.scrollIntoView()` a los 80ms que llevaba al
         CUERPO del resultado, o sea por debajo de la cabecera del panel.
         Tenia sentido cuando el selector y el formulario seguian arriba y
         habia que bajar hasta la ficha. Ahora esos dos se esconden y el
         resultado queda en lo alto, asi que ese salto dejaba la pagina a
         media ficha — y encima pisaba la subida de `entrarModoResultado`,
         que corre antes. De la subida se encarga ahora esa funcion. */
    }

    // ── Búsqueda por nombre (/nm) ──────────────────────────────────────
    // La respuesta inicial viene paginada; el botón "Descargar" pide al bot
    // el TXT con TODOS los resultados. Lo parseamos, redibujamos la tabla
    // completa y habilitamos la exportación a PDF.
    function b64ToTexto(b64) {
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      try {
        return new TextDecoder('utf-8').decode(bytes);
      } catch (_) {
        return bin;
      }
    }

    // Arma un PDF mostrando el overlay de descarga. La implementación vive
    // en render-helpers.js: la comparten estas vistas y «Consulta Vehicular».
    var descargarPdfConOverlay = H.descargarPdfConOverlay;

    function wireNmButtons(container, valorConsultado) {
      var RH = Consultia.RenderHelpers;

      // Exportar a PDF con los registros ya cargados
      var pdfBtn = container.querySelector('.cr-btn-nm-pdf');
      if (pdfBtn) {
        pdfBtn.addEventListener('click', function () {
          var regs = container.__nmRegs || [];
          if (!regs.length) return;
          descargarPdfConOverlay(function () {
            return Consultia.ReportGenerator.generateNm(regs, {
              valor: valorConsultado,
              total: container.__nmTotal || String(regs.length)
            });
          });
        });
      }

      // Pedir al bot el TXT completo
      var txtBtn = container.querySelector('.cr-btn-nm-txt');
      if (!txtBtn) return;

      txtBtn.addEventListener('click', async function () {
        if (!currentConsulta) return;
        var msgId = parseInt(txtBtn.dataset.msgid, 10);
        var data = txtBtn.dataset.callback;
        if (!msgId || !data) return;

        txtBtn.disabled = true;
        var textoOriginal = txtBtn.innerHTML;
        // El bot arma el archivo con TODOS los resultados y puede tardar
        // más de un minuto: overlay a pantalla completa con contador para
        // que se vea que sigue trabajando.
        var detener = RH.openDownloadOverlay({
          titulo: 'Generando el archivo',
          detalle: 'Estamos pidiendo al proveedor el listado completo. Puede tardar hasta un par de minutos.',
          contador: true
        });

        try {
          // El bot arma el archivo con todos los resultados: puede tardar más
          // de un minuto, así que le damos margen amplio antes de cortar.
          var resp = await Consultia.ConsultaRunner.ejecutarCallback(currentConsulta, msgId, data, { timeoutMs: 150000 });
          var rp = resp.parsed || {};

          // El TXT llega como documento adjunto. Telegram puede reportarlo como
          // text/plain o como application/octet-stream, así que aceptamos
          // cualquier adjunto que no sea imagen ni PDF e intentamos leerlo.
          var candidatos = (rp.medios || []).filter(function (m) {
            if (!m.base64) return false;
            if (/text\//i.test(m.mimeType || '') || /\.txt$/i.test(m.filename || '')) return true;
            var esImagen = m.tipo === 'photo' || /^image\//i.test(m.mimeType || '');
            var esPdf = m.tipo === 'pdf' || /pdf/i.test(m.mimeType || '');
            return !esImagen && !esPdf;
          });

          var regs = [];
          for (var i = 0; i < candidatos.length && !regs.length; i++) {
            try {
              regs = RH.parseNmTexto(b64ToTexto(candidatos[i].base64));
            } catch (_) { /* adjunto ilegible: probamos el siguiente */ }
          }
          // Si no vino adjunto, el bot pudo mandar el listado como texto
          if (!regs.length) regs = RH.nmRegistros(rp);
          if (!regs.length && rp.raw) regs = RH.parseNmTexto(rp.raw);

          console.log('[/nm descarga] adjuntos:', (rp.medios || []).map(function (m) {
            return { tipo: m.tipo, mime: m.mimeType, archivo: m.filename, bytes: m.size };
          }), 'registros:', regs.length);

          if (!regs.length) {
            detener();
            if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Sin datos', message: 'El archivo no trajo resultados legibles.' });
            txtBtn.innerHTML = textoOriginal;
            txtBtn.disabled = false;
            return;
          }
          detener();

          var total = String(regs.length);
          container.__nmRegs = regs;
          container.__nmTotal = total;
          container.innerHTML = RH.renderNmTabla(regs, {
            valor: valorConsultado,
            total: total,
            pie: RH.nmBotonPdf()
          });
          wireNmButtons(container, valorConsultado);
          container.__nmRegs = regs;
          container.__nmTotal = total;

          if (resp.costo_deducido > 0 && Consultia.toast) {
            Consultia.toast({ type: 'info', title: 'Cobro exitoso', message: 'Se han descontado ' + resp.costo_deducido + ' créditos.', duration: 4000 });
          }
        } catch (e) {
          detener();
          console.error('Error al descargar resultados /nm:', e);
          if (Consultia.toast) Consultia.toast({ type: 'error', title: 'No se pudo descargar', message: (e && e.message) || 'Intenta de nuevo.' });
          txtBtn.innerHTML = textoOriginal;
          txtBtn.disabled = false;
        }
      });
    }

    // Árbol genealógico (/ag): el bot manda todo en una sola respuesta, así
    // que el PDF se arma al vuelo con lo que ya está en pantalla — sin
    // callback adicional al bridge.
    function wireArbolButtons(container, valorConsultado) {
      var pdfBtn = container.querySelector('.cr-btn-arbol-pdf');
      if (!pdfBtn) return;
      pdfBtn.addEventListener('click', function () {
        var RH = Consultia.RenderHelpers;
        var regs = RH.parseArbolGenealogico(container.__arbolRaw || '');
        if (!regs.length) return;
        descargarPdfConOverlay(function () {
          return Consultia.ReportGenerator.generateArbol(regs, { valor: valorConsultado });
        });
      });
    }

    // Botón "Descargar PDF" genérico (facial, tabla, datos con/sin foto):
    // arma el informe al vuelo con los datos ya parseados en pantalla,
    // eligiendo el generador según el tipo de resultado.
    function wireGenericPdfButton(container, p, valorConsultado, photos) {
      var btn = container.querySelector('.cr-btn-pdf-generic');
      if (!btn) return;
      btn.addEventListener('click', function () {
        descargarPdfConOverlay(function () {
          if (p.facial && p.facial.length > 0) {
            return Consultia.ReportGenerator.generateFacial(p.facial, valorConsultado);
          }
          if (p.tabla && p.tabla.filas && p.tabla.filas.length > 0) {
            return Consultia.ReportGenerator.generateTabla(p.tabla, valorConsultado, currentConsulta ? currentConsulta.nombre : '');
          }
          return Consultia.ReportGenerator.generate(p, {
            consultaNombre: currentConsulta ? currentConsulta.nombre : 'Consulta',
            valor: valorConsultado || '',
            fecha: new Date().toLocaleDateString('es-PE', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })
          }, photos);
        });
      });
    }

    /* ¿La respuesta del callback es la misma ficha que ya está arriba? Se
       comparan los textos, no el HTML: el navegador normaliza comillas y
       orden de atributos al leer innerHTML, y una diferencia así daría un
       falso negativo. */
    function esElMismoListado(container, htmlNuevo) {
      var ficha = container.querySelector('.cr-btn-details');
      if (!ficha) return false;
      var tmp = document.createElement('div');
      tmp.innerHTML = htmlNuevo;
      var norm = function (s) { return (s || '').replace(/\s+/g, ' ').trim(); };
      return norm(tmp.textContent) === norm(ficha.textContent);
    }

    function wireResultButtons(container) {
      var btns = container.querySelectorAll('.cr-btn-option');
      var resultArea = container.querySelector('.cr-btn-result-area');

      // Toggles "Ver detalles" / "Cerrar detalles" se manejan por delegación global (render-helpers.js)

      // Ilustración decorativa (se oculta al mostrar resultado)
      var illust = container.querySelector('.cr-btn-illust');

      btns.forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!currentConsulta) return;
          var msgId = parseInt(btn.dataset.msgid, 10);
          var data = btn.dataset.callback;
          if (!msgId || !data) return;

          // â"€â"€ Modo nuevo: renderizar en el área de resultado sin reemplazar botones â"€â"€
          if (resultArea) {
            if (illust) illust.hidden = true;
            btns.forEach(function (b) { b.disabled = true; b.classList.remove('is-selected'); });
            btn.classList.add('is-selected', 'is-loading');

            var RH = Consultia.RenderHelpers;
            resultArea.hidden = false;
            resultArea.innerHTML = '';
            /* Pedirle el documento al proveedor puede tardar. Mismo aviso a
               pantalla completa con contador que la descarga del listado por
               nombres: bloquea la página, así el cliente no pulsa otra
               partida creyendo que no pasó nada. */
            var cerrarEspera = RH.openDownloadOverlay({
              titulo: 'Generando el documento',
              detalle: 'Estamos pidiendo el documento al proveedor. Puede tardar unos segundos.'
            });

            var status = $(statusId());
            if (status) {
              status.classList.remove('status-empty', 'status-ok');
              status.classList.add('status-loading');
              status.innerHTML = '<span class="status-dot"></span> Consultando';
            }

            try {
              var resp = await Consultia.ConsultaRunner.ejecutarCallback(currentConsulta, msgId, data);
              cerrarEspera();
              var rp = resp.parsed || {};
              var pdfs = (rp.medios || []).filter(function (m) { return m.tipo === 'pdf'; });
              var hasDataR = (rp.secciones || []).some(function (s) { return (s.campos || []).length > 0; });

              if (RH.esErrorTecnicoRespuesta(rp, resp)) {
                resultArea.innerHTML = RH.htmlMantenimiento();
              } else if (pdfs.length > 0) {
                // La barra de descarga va delante para que `marcarConResultado`
                // la suba a la cabecera, igual que en cualquier otra consulta;
                // el CSS esconde la lista de opciones al detectar el visor.
                resultArea.innerHTML = RH.renderPdfDlBar(pdfs) + RH.renderDocumentCard(pdfs, prefix);
                marcarConResultado(true);
                /* El documento es lo que se vino a buscar: se abre solo en el
                   visor a pantalla completa, con sus páginas, zoom e impresión.
                   Al cerrarlo queda la previsualización en el panel —no la
                   lista de partidas—, y un clic sobre ella lo reabre. */
                var docAbrir = pdfs[0];
                var vistaPrevia = resultArea.querySelector('.cr-doccard-view[data-blob]');
                if (vistaPrevia) {
                  RH.openPdfModal(
                    vistaPrevia.getAttribute('data-blob'),
                    vistaPrevia.getAttribute('data-fn') || (docAbrir.filename || 'documento.pdf')
                  );
                }
              } else if (hasDataR && esElMismoListado(container, RH.renderDataRows(rp))) {
                /* El proveedor devolvió otra vez el listado de partidas en vez
                   del documento. Repintarlo dejaba la misma tabla dos veces en
                   pantalla y ninguna previsualización: se dice lo que pasó y
                   se deja la lista para reintentar. */
                resultArea.innerHTML =
                  '<div class="cr-loading"><div class="cr-loading-text">El proveedor devolvió el listado, no el documento.</div>' +
                  '<div class="cr-loading-hint">Vuelve a pulsar la partida en unos segundos.</div></div>';
              } else if (hasDataR) {
                // Los datos, a la vista. Estaban detrás de un «Ver detalles de
                // la consulta» que dejaba la respuesta escondida tras un clic
                // más, justo encima de la lista que el cliente acababa de usar.
                resultArea.innerHTML =
                  '<div class="cr-txt-layout"><div class="cr-txt-data" style="padding:16px;">' +
                    RH.renderDataRows(rp) +
                  '</div></div>';
              } else {
                var rawText = (rp.raw || '').trim().replace(/\[\s*\]/g, '').replace(/\[\s*-\s*\]/g, '').trim();
                if (rawText.length > 5 && !RH.esErrorTecnico(rawText)) {
                  resultArea.innerHTML = '<div style="white-space:pre-wrap;font-family:monospace;font-size: var(--fs-sm);line-height:1.5;padding:16px;">' + RH.escapeHtml(rawText) + '</div>';
                } else if (RH.esErrorTecnico(rawText)) {
                  resultArea.innerHTML = RH.htmlMantenimiento();
                } else {
                  resultArea.innerHTML = '<div class="cr-loading"><div class="cr-loading-text">No se encontraron datos para esta opción.</div></div>';
                }
              }

              if (status) {
                status.classList.remove('status-empty', 'status-loading');
                status.classList.add('status-ok');
                status.innerHTML = '<span class="status-dot"></span> Completado';
              }
              if (resp.costo_deducido > 0 && Consultia.toast) {
                Consultia.toast({ type: 'info', title: 'Cobro exitoso', message: 'Se han descontado ' + resp.costo_deducido + ' créditos.', duration: 4000 });
              }

              btns.forEach(function (b) { b.disabled = false; });
              btn.classList.remove('is-loading');
              resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (e) {
              cerrarEspera();   // idempotente: no pasa nada si ya se cerró
              console.error('Error en callback:', e);
              if (Consultia.toast) Consultia.toast({ type: 'error', title: 'No se pudo procesar', message: (e && e.message) || 'Intenta de nuevo.' });
              resultArea.innerHTML = '';
              resultArea.hidden = true;
              btns.forEach(function (b) { b.disabled = false; });
              btn.classList.remove('is-loading', 'is-selected');
            }
            return;
          }

          // â"€â"€ Fallback: comportamiento original (sin cr-btn-result-area) â"€â"€
          var savedHtml = container.innerHTML;
          btns.forEach(function (b) { b.disabled = true; });
          btn.classList.add('is-loading');
          mostrarCargando();
          try {
            var resp = await Consultia.ConsultaRunner.ejecutarCallback(currentConsulta, msgId, data);
            renderResultado(resp);
          } catch (e) {
            console.error('Error en callback:', e);
            if (Consultia.toast) Consultia.toast({ type: 'error', title: 'No se pudo procesar', message: (e && e.message) || 'Intenta de nuevo.' });
            var body = $(bodyId());
            if (body) { body.innerHTML = savedHtml; wireResultButtons(body); }
          }
        });
      });
    }

    async function ejecutar() {
      if (!currentConsulta) return;
      var isPhotoQuery = currentConsulta.tipo_dato === 'foto';

      var valor = '';
      var photoOpts = null;
      if (isPhotoQuery) {
        if (!selectedFile || !selectedFileBase64) {
          if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Falta la foto', message: 'Sube una imagen JPG o PNG antes de consultar.' });
          return;
        }
        valor = selectedFile.name;
        photoOpts = { base64: selectedFileBase64, filename: selectedFile.name };
      } else if (currentConsulta.comando && currentConsulta.comando.indexOf('/nm') === 0) {
        var nmNombres = $(prefix + '-nm-nombres');
        var nmApPat = $(prefix + '-nm-appat');
        var nmApMat = $(prefix + '-nm-apmat');
        var apPat = (nmApPat ? nmApPat.value : '').trim();
        var apMat = (nmApMat ? nmApMat.value : '').trim();
        var nombres = (nmNombres ? nmNombres.value : '').trim();
        var filledCount = (nombres ? 1 : 0) + (apPat ? 1 : 0) + (apMat ? 1 : 0);
        if (filledCount < 2) {
          if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Faltan datos', message: 'Completa al menos 2 de los 3 campos.' });
          return;
        }
        nombres = nombres.replace(/\s+/g, ',');
        apPat = apPat.replace(/\s+/g, '+');
        apMat = apMat.replace(/\s+/g, '+');
        valor = nombres + '|' + apPat + '|' + apMat;
      } else {
        var input = $(prefix + '-input');
        valor = input.value.trim();
        if (!valor) {
          input.focus();
          if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Falta el dato', message: 'Ingresa el dato para consultar.' });
          return;
        }
        // Formato específico por comando (ej: /nm requiere 3 segmentos con |)
        var formatted = formatValueForCommand(currentConsulta, valor);
        if (formatted.error) {
          if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Formato inválido', message: formatted.error });
          input.focus();
          return;
        }
        valor = formatted.value;
        // Validación genérica por tipo_dato (solo si no es un comando con formato propio)
        if (currentConsulta.comando && currentConsulta.comando.indexOf('/nm') !== 0) {
          var err = validarValor(currentConsulta.tipo_dato, valor);
          if (err) {
            if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Formato inválido', message: err });
            input.focus();
            return;
          }
        }
      }

      var user = await Consultia.Auth.getUser();
      if (!user) {
        if (Consultia.AuthModals) Consultia.AuthModals.openLogin();
        return;
      }
      var tieneSaldo = await Consultia.ConsultaRunner.verificarSaldo(user.id, currentConsulta.precio_venta);
      if (!tieneSaldo) {
        if (Consultia.SubscriptionGate && Consultia.SubscriptionGate.openNoCreditsModal) {
          Consultia.SubscriptionGate.openNoCreditsModal(currentConsulta);
        } else if (Consultia.toast) {
          Consultia.toast({ type: 'warning', title: 'Saldo insuficiente', message: 'Necesitas ' + currentConsulta.precio_venta + ' créditos.' });
        }
        return;
      }
      var btn = $(prefix + '-consultar');
      if (btn.disabled) return;
      btn.disabled = true;
      btn.dataset.orig = btn.dataset.orig || btn.innerHTML;
      btn.innerHTML = 'Consultando…';
      mostrarCargando();
      try {
        var resp = await Consultia.ConsultaRunner.ejecutarConsultaConCobro(
          user.id, currentConsulta, valor, photoOpts ? { photo: photoOpts } : undefined
        );
        renderResultado(resp, valor);
        if (Consultia.SearchHistory && valor) Consultia.SearchHistory.add(valor, categoria);
        if (Consultia.Favorites && Consultia.Favorites.injectStar) {
          var _rp = document.getElementById(prefix + '-result-panel');
          if (_rp) Consultia.Favorites.injectStar(_rp, valor, categoria);
        }
        if (Consultia.renderDashboardStats) await Consultia.renderDashboardStats();
        if (Consultia.AuthUI && Consultia.AuthUI.refresh) await Consultia.AuthUI.refresh();
        if (Consultia.Subscription && Consultia.Subscription.refresh) await Consultia.Subscription.refresh();
      } catch (e) {
        volverEstadoInicial();
        if (e && e.code === 'CANCELLED') return;
        console.error('Error ejecutando consulta ' + categoria + ':', e);
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

    // Wiring del dropzone para tipo_dato="foto"
    function wirePhotoDropzone() {
      var dz = $(prefix + '-dropzone');
      var fileInput = $(prefix + '-file');
      var placeholder = $(prefix + '-dropzone-placeholder');
      var preview = $(prefix + '-dropzone-preview');
      var previewImg = $(prefix + '-preview-img');
      var previewName = $(prefix + '-preview-name');
      var removeBtn = $(prefix + '-remove-btn');
      var consultarBtn = $(prefix + '-consultar');
      if (!dz || !fileInput) return;

      function setFile(file) {
        if (!file) return;
        if (!/^image\/(jpeg|png)$/i.test(file.type)) {
          if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Formato inválido', message: 'Solo se aceptan imágenes JPG o PNG.' });
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          if (Consultia.toast) Consultia.toast({ type: 'error', title: 'Imagen muy grande', message: 'El archivo no debe superar 10 MB.' });
          return;
        }
        selectedFile = file;
        var reader = new FileReader();
        reader.onload = function (e) {
          var dataUrl = e.target.result;
          if (!dataUrl) return;
          selectedFileBase64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/i, '');
          if (previewImg) previewImg.src = dataUrl;
          if (previewName) previewName.textContent = file.name;
          if (placeholder) placeholder.hidden = true;
          if (preview) preview.hidden = false;
          if (consultarBtn) consultarBtn.disabled = false;
        };
        reader.readAsDataURL(file);
      }

      function clearFile() {
        selectedFile = null;
        selectedFileBase64 = null;
        fileInput.value = '';
        if (placeholder) placeholder.hidden = false;
        if (preview) preview.hidden = true;
        if (consultarBtn) consultarBtn.disabled = true;
      }

      dz.addEventListener('click', function (e) {
        if (e.target.closest('.facial-dropzone-remove')) return;
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) setFile(fileInput.files[0]);
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('is-dragover'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('is-dragover'); });
      });
      dz.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          setFile(e.dataTransfer.files[0]);
        }
      });
      if (removeBtn) removeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        clearFile();
      });
    }

    function init() {
      var combo = $(prefix + 'Combo');
      var comboBtn = $(prefix + 'ComboBtn');
      if (!combo || !comboBtn) return;

      comboBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = combo.classList.toggle('open');
        comboBtn.setAttribute('aria-expanded', String(open));
      });
      _combos.push({ combo: combo, btn: comboBtn });
      bindGlobalComboListeners();

      var btn = $(prefix + '-consultar');
      if (btn) btn.addEventListener('click', ejecutar);
      var input = $(prefix + '-input');
      if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ejecutar(); });

      // Si la vista tiene dropzone de foto, lo conectamos (solo facial por ahora)
      if ($(prefix + '-dropzone')) wirePhotoDropzone();

      cargarCatalogo();
    }

    if (opts.initName) Consultia[opts.initName] = init;
    return { init: init, selectConsulta: setConsulta };
  };

  // Exponer renderPdfIntoContainer (render-helpers.js lo inicializa;
  // esta línea mantiene compatibilidad por si algo cargara antes del orden normal)
  Consultia.renderPdfIntoContainer = H.renderPdfIntoContainer;
})();
