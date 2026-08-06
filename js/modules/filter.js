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

  function esMetapla(c) {
    return !!(c && c.comando && c.comando.indexOf('/metapla') === 0);
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
  var renderPdfPreview        = H.renderPdfPreview;
  var renderButtonList        = H.renderButtonList;
  var renderDataWithMedia     = H.renderDataWithMedia;
  var renderDocumentCard      = H.renderDocumentCard;
  var isEmptyValue            = H.isEmptyValue;

  // Render dedicado para "Reporte Completo" (/metapla): filas simples,
  // sin título del bot, sin duplicar campos repetidos y sin el partido en
  // 2 columnas que usa renderDataRows para listas de varios registros
  // (ese modo no aplica acá — /metapla es un solo vehículo).
  function renderMetaplaData(p) {
    var prettyLabel = Consultia.ConsultaRunner ? Consultia.ConsultaRunner.prettyLabel : function (s) { return s; };
    var seen = Object.create(null);
    var rows = [];
    (p.secciones || []).forEach(function (s) {
      (s.campos || []).forEach(function (c) {
        if (!c.campo) return;
        var key = c.campo.toUpperCase().trim();
        if (seen[key]) return; // el bot a veces repite el mismo campo 2 veces
        seen[key] = true;
        if (isEmptyValue(c.valor)) return;
        rows.push(
          '<div class="cr-row"><span class="cr-k">' + escapeHtml(prettyLabel(c.campo)) +
          '</span><span class="cr-v">' + escapeHtml(c.valor) + '</span></div>'
        );
      });
    });
    if (!rows.length) return '';
    return '<div class="cr-sect"><div class="cr-sect-body">' + rows.join('') + '</div></div>';
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

      // Mostrar/ocultar escáner de placa según tipo de consulta
      var existingBtn = (input.closest('.ps-input-wrap') || input.parentNode).querySelector('.ps-trigger');
      if (c.tipo_dato === 'placa') {
        if (!existingBtn && Consultia.PlateScanner) Consultia.PlateScanner.attach(input);
      } else if (existingBtn) {
        existingBtn.style.display = 'none';
        input.style.paddingRight = '';
      }
      if (existingBtn && c.tipo_dato === 'placa') existingBtn.style.display = '';
    }

    var emptyDesc = $('filter-empty-desc');
    if (emptyDesc) emptyDesc.textContent = c.descripcion || 'Ingrese el dato para realizar la consulta.';

    // Ocultar previews legacy
    ['filter-preview-pdf', 'filter-preview-txt', 'filter-preview-img', 'filter-preview-data'].forEach(function (id) {
      var el = $(id); if (el) el.hidden = true;
    });

    if (Consultia.LayoutEditor && Consultia.LayoutEditor.setActiveProfile) {
      Consultia.LayoutEditor.setActiveProfile(c.id, c.nombre, c);
    }

    // Resetear resultado
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
      status.innerHTML = '<span class="status-dot"></span> Esperando consulta';
    }
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
      status.innerHTML = '<span class="status-dot"></span> Esperando consulta';
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
      renderResultado(resp);
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
  function wireResultButtons(container) {
    var btns = container.querySelectorAll('.cr-btn-option');
    var resultArea = container.querySelector('.cr-btn-result-area');

    // Toggles "Ver detalles" / "Cerrar detalles" se manejan por delegación global (render-helpers.js)

    // Ilustración decorativa
    var illust = container.querySelector('.cr-btn-illust');

    btns.forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!currentConsulta) return;
        var msgId = parseInt(btn.dataset.msgid, 10);
        var data  = btn.dataset.callback;
        if (!msgId || !data) return;

        // â”€â”€ Modo nuevo: renderizar en el área sin reemplazar botones â”€â”€
        if (resultArea) {
          if (illust) illust.hidden = true;
          btns.forEach(function (b) { b.disabled = true; b.classList.remove('is-selected'); });
          btn.classList.add('is-selected', 'is-loading');

          resultArea.hidden = false;
          resultArea.innerHTML =
            '<div class="cr-loading">' +
              '<div class="cr-spinner"></div>' +
              '<div class="cr-loading-text">Consultando…</div>' +
              '<div class="cr-loading-hint">Generando el documento, puede demorar unos segundos.</div>' +
            '</div>';
          resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });

          var status = $('filterResultStatus');
          if (status) {
            status.classList.remove('status-empty', 'status-ok');
            status.classList.add('status-loading');
            status.innerHTML = '<span class="status-dot"></span> Consultando';
          }

          try {
            var resp = await Consultia.ConsultaRunner.ejecutarCallback(currentConsulta, msgId, data);
            var rp = resp.parsed || {};
            var RH = Consultia.RenderHelpers;
            var pdfs = (rp.medios || []).filter(function (m) { return m.tipo === 'pdf'; });
            var hasDataR = (rp.secciones || []).some(function (s) { return (s.campos || []).length > 0; });

            if (RH.esErrorTecnicoRespuesta(rp, resp)) {
              resultArea.innerHTML = RH.htmlMantenimiento();
            } else if (pdfs.length > 0) {
              resultArea.innerHTML = RH.renderDocumentCard(pdfs, 'filter');
            } else if (hasDataR) {
              var duid = 'cr-cb-det-' + Date.now();
              resultArea.innerHTML =
                '<div class="cr-txt-layout"><div class="cr-txt-data" style="padding:16px;">' +
                  '<div class="cr-btn-details">' +
                    '<button type="button" class="cr-btn-details-toggle" aria-expanded="false" data-target="' + duid + '">' +
                      '<svg class="cr-btn-details-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
                      '<span>Ver detalles de la consulta</span>' +
                    '</button>' +
                    '<div class="cr-btn-details-body" id="' + duid + '" hidden>' +
                      RH.renderDataRows(rp) +
                      '<button type="button" class="cr-btn-details-close" data-target="' + duid + '">' +
                        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>' +
                        '<span>Cerrar detalles</span>' +
                      '</button>' +
                    '</div>' +
                  '</div>' +
                '</div></div>';
            } else {
              var rawText = (rp.raw || '').trim().replace(/\[\s*\]/g, '').replace(/\[\s*-\s*\]/g, '').trim();
              var _rawH2 = /^(obteniendo|consultando|buscando|procesando|generando|cargando|la\s+consulta\s+se\s+hizo|consulta\s+(exitosa|realizada)|resultado\s+(exitoso|listo)|cr[eé]ditos?|credits?|nombre|user(name)?|comando|plan\b|monedas?|consultado\s+por|usuario|mensaje|estado|#\w+|∞|♾)/i;
              rawText = rawText.split(/\r?\n/).filter(function (l) { var t = l.replace(/\[\s*[^\]]*\]\s*/g, '').trim(); return t && !_rawH2.test(t); }).join('\n').trim();
              if (rawText.length > 5 && !RH.esErrorTecnico(rawText)) {
                resultArea.innerHTML = '<div style="white-space:pre-wrap;font-family:monospace;font-size: var(--fs-sm);line-height:1.5;padding:16px;">' + RH.escapeHtml(rawText) + '</div>';
              } else {
                resultArea.innerHTML = '<div class="cr-loading"><div class="cr-loading-text">No se encontraron datos.</div></div>';
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
            console.error('[filter] Error en callback:', e);
            if (Consultia.toast) Consultia.toast({ type: 'error', title: 'No se pudo procesar', message: (e && e.message) || 'Intenta de nuevo.' });
            resultArea.innerHTML = '';
            resultArea.hidden = true;
            btns.forEach(function (b) { b.disabled = false; });
            btn.classList.remove('is-loading', 'is-selected');
          }
          return;
        }

        // â”€â”€ Fallback: comportamiento original â”€â”€
        var savedHtml = container.innerHTML;
        btns.forEach(function (b) { b.disabled = true; });
        btn.classList.add('is-loading');
        mostrarCargando();

        try {
          var resp = await Consultia.ConsultaRunner.ejecutarCallback(currentConsulta, msgId, data);
          renderResultado(resp);
        } catch (e) {
          console.error('[filter] Error en callback:', e);
          if (Consultia.toast) Consultia.toast({ type: 'error', title: 'No se pudo procesar', message: (e && e.message) || 'Intenta de nuevo.' });
          var body = $('filter-result-body');
          if (body) { body.innerHTML = savedHtml; wireResultButtons(body); }
        }
      });
    });
  }

  /* â”€â”€ Renderizado de resultado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function renderResultado(resp) {
    revokeActiveBlobUrls();
    var p       = resp.parsed || {};
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

    // El "Reporte Completo" (/metapla) pide su propio texto en el botón de
    // descarga; el resto de consultas mantiene el genérico "Descargar".
    var esMetapla = currentConsulta && currentConsulta.comando &&
      currentConsulta.comando.indexOf('/metapla') === 0;
    var docOpts = esMetapla ? { downloadLabel: 'Descargar Reporte PDF' } : undefined;

    var body = $('filter-result-body');
    var html;

    if (esErrorTecnicoRespuesta(p, resp)) {
      html = htmlMantenimiento();
    } else if (esMetapla) {
      // Sin título del bot, sin "Ver detalles" ni botón "Siguiente" — el
      // bridge ya hizo ese clic automático (auto_click en el catálogo).
      html = renderMetaplaData(p) + renderDocumentCard(pdfs, 'fl', docOpts);
    } else if (botones.length > 0 && !hasMedia) {
      html = renderButtonList(p, botones);
    } else if (hasData || photos.length > 0) {
      html = renderDataWithMedia(p, photos) + renderDocumentCard(pdfs, 'fl', docOpts);
    } else if (pdfs.length > 0) {
      html = renderDocumentCard(pdfs, 'fl', docOpts);
    } else {
      var rawText = (p.raw || '').trim();
      var _rawH3 = /^(obteniendo|consultando|buscando|procesando|generando|cargando|la\s+consulta\s+se\s+hizo|consulta\s+(exitosa|realizada)|resultado\s+(exitoso|listo)|cr[eé]ditos?|credits?|nombre|user(name)?|comando|plan\b|monedas?|consultado\s+por|usuario|mensaje|estado|#\w+|∞|♾)/i;
      rawText = rawText.split(/\r?\n/).filter(function (l) { var t = l.replace(/\[\s*[^\]]*\]\s*/g, '').trim(); return t && !_rawH3.test(t); }).join('\n').trim();
      var doc = (p.medios || []).find(function (m) { return m.tipo === 'document' && m.filename && m.filename.endsWith('.txt'); });
      if (doc && doc.base64) {
        try { rawText += '\n\n' + decodeURIComponent(escape(atob(doc.base64))); } catch (e) { rawText += '\n\n' + atob(doc.base64); }
      }
      if (rawText.length > 5) {
        html = esErrorTecnico(rawText)
          ? htmlMantenimiento()
          : '<div class="cr-txt-layout"><div class="cr-txt-data" style="padding: 16px;"><div style="white-space: pre-wrap; font-family: monospace; font-size: var(--fs-sm); line-height: 1.5;">' + escapeHtml(rawText) + '</div></div></div>';
      } else {
        html = '<div class="cr-loading"><div class="cr-loading-text">No se encontraron datos para mostrar.</div></div>';
      }
    }

    body.innerHTML = html;
    body.hidden = false;

    if (botones.length > 0 && !hasMedia) wireResultButtons(body);

    // Auto-generar informe PDF para respuestas de datos/fotos
    var filterReportArea = document.getElementById('filter-report-area');
    if (filterReportArea && Consultia.ReportGenerator) {
      (function (consultaRef, valorRef, photosRef) {
        (async function () {
          try {
            var result = Consultia.ReportGenerator.generate(p, {
              consultaNombre: consultaRef ? consultaRef.nombre : 'Consulta',
              valor: valorRef || '',
              fecha: new Date().toLocaleDateString('es-PE', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            }, photosRef);
            if (!result) throw new Error('No se pudo generar');

            filterReportArea.innerHTML =
              '<div class="cr-report-preview">' +
                '<div class="cr-report-canvas-wrap">' +
                  '<div class="cr-report-canvas" id="filter-report-canvas"></div>' +
                '</div>' +
              '</div>';

            // Limpiar cualquier botón rojo de descarga heredado de renders previos:
            // ahora el thumbnail completo es clickeable y muestra "Click para descargar".
            var oldActions = filterReportArea.closest('.result-panel').querySelector('.result-header-actions');
            if (oldActions) oldActions.remove();

            var canvasEl = document.getElementById('filter-report-canvas');
            if (canvasEl && Consultia.renderPdfIntoContainer) {
              try {
                await Consultia.renderPdfIntoContainer(canvasEl, result.blobUrl, result.filename, result.base64);
              } catch (pe) {
                canvasEl.innerHTML = '<div class="cr-pdf-loading">Vista previa no disponible.</div>';
              }
            }
            // El thumbnail entero también descarga al hacer click
            var wrap = filterReportArea.querySelector('.cr-report-canvas-wrap');
            if (wrap) {
              wrap.addEventListener('click', function () {
                Consultia.ReportGenerator.download(result);
              });
            }
          } catch (e) {
            console.error('[filter-report]', e);
            filterReportArea.innerHTML = '<div class="cr-txt-layout"><div class="cr-txt-data">' + renderDataRows(p) + '</div></div>';
          }
        })();
      })(currentConsulta, $('filter-input') ? $('filter-input').value.trim() : '', photos);
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

    setTimeout(function () { if (body.isConnected) body.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
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
    });
    document.addEventListener('click', function (e) {
      if (!combo.contains(e.target)) {
        combo.classList.remove('open');
        comboBtn.setAttribute('aria-expanded', 'false');
      }
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

    // CTA "Obtén tu reporte": selecciona /metapla (Reporte Completo) y deja
    // el campo de placa listo. Ya estamos en view-filter, no hay que navegar.
    var ctaBtn = $('ctaReporteBtn');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', async function () {
        try { await catalogReadyPromise; } catch (_) {}
        var item = catalog.find(function (c) {
          return c.comando && c.comando.indexOf('/metapla') === 0;
        });
        if (item) selectByOptionId(item.id);
        if (input) { input.value = ''; input.focus(); }
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
