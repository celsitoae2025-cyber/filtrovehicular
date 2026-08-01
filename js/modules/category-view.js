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

  function bindGlobalComboListeners() {
    if (_globalBound) return;
    _globalBound = true;
    document.addEventListener('click', function (e) {
      _combos.forEach(function (c) {
        if (!c.combo.contains(e.target)) {
          c.combo.classList.remove('open');
          c.btn.setAttribute('aria-expanded', 'false');
        }
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

    // Renderiza un hint visual cuando el comando activo requiere formato especial.
    function renderCommandHint(c) {
      var hostId = prefix + '-hint';
      var existing = $(hostId);
      if (existing) existing.remove();
      if (!c || !c.comando) return;

      // /nm: búsqueda por nombres
      if (c.comando.indexOf('/nm') === 0) {
        var input = $(prefix + '-input');
        if (!input) return;
        var panelParent = input.closest('.panel');
        if (!panelParent) return;
        var hint = document.createElement('div');
        hint.id = hostId;
        hint.className = 'cr-cmd-hint';
        hint.innerHTML =
          '<div class="cr-cmd-hint-title">Usa el formato correcto</div>' +
          '<ul class="cr-cmd-hint-list">' +
            '<li>Apellido paterno y apellido materno son <b>requeridos</b>.</li>' +
            '<li>Si un apellido tiene más de una palabra, une con <b>+</b>. Ej: <code>del+sol</code></li>' +
            '<li>Si los nombres tienen más de una palabra, sepáralos con <b>,</b>. Ej: <code>juan,manuel</code></li>' +
          '</ul>' +
          '<div class="cr-cmd-hint-title cr-cmd-hint-sub">Formato</div>' +
          '<code class="cr-cmd-hint-code">nombres|apellido paterno|apellido materno</code>' +
          '<div class="cr-cmd-hint-title cr-cmd-hint-sub">Ejemplos</div>' +
          '<ul class="cr-cmd-hint-examples">' +
            '<li><code>juan|perez|lopez</code></li>' +
            '<li><code>juan|del+sol|lopez</code></li>' +
            '<li><code>juan,manuel|perez|lopez</code></li>' +
            '<li><code>|perez|lopez</code> <span>(sin nombre)</span></li>' +
          '</ul>';
        // Insertar justo antes del form-row (debajo del consumo-row)
        var formRow = panelParent.querySelector('.form-row');
        if (formRow) panelParent.insertBefore(hint, formRow);
        else panelParent.appendChild(hint);
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
        if (!apPat || !apMat) {
          return { error: 'Ambos apellidos son obligatorios (apellido paterno y apellido materno).' };
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

      var body = $(bodyId());
      var html;
      if (esErrorTecnicoRespuesta(p, resp)) {
        html = htmlMantenimiento();
      } else if (hasFacial) {
        html = renderFacialHero(p.facial);
      } else if (hasTabla) {
        html = renderTabla(p.tabla);
      } else if (botones.length > 0 && !hasMedia) {
        html = renderButtonList(p, botones);
      } else if (hasData || photos.length > 0) {
        // Datos visibles de inmediato (tabla + fotos al costado); si además
        // vino un PDF, se agrega como tarjeta "Documento adjunto" debajo
        // (Visualizar/Descargar) — igual que VeriNexo, nunca se esconden
        // los datos detrás del visor de PDF. El PDF propio (autogenerado)
        // se genera aparte, en segundo plano, sin bloquear la vista.
        html = renderDataWithMedia(p, photos) + renderDocumentCard(pdfs, prefix);
      } else if (pdfs.length > 0) {
        html = renderDocumentCard(pdfs, prefix);
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
          html = esErrorTecnico(rawText)
            ? htmlMantenimiento()
            : '<div class="cr-txt-layout"><div class="cr-txt-data" style="padding: 16px;"><div style="white-space: pre-wrap; font-family: monospace; font-size: 13px; line-height: 1.5;">' + escapeHtml(rawText) + '</div></div></div>';
        } else {
          html = '<div class="cr-loading"><div class="cr-loading-text">No se encontraron datos para mostrar.</div></div>';
        }
      }

      body.innerHTML = html;
      body.hidden = false;
      if (botones.length > 0 && !hasMedia && !hasFacial && !hasTabla) wireResultButtons(body);

      var empty = $(emptyId());
      if (empty) empty.hidden = true;

      var status = $(statusId());
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

      setTimeout(function () {
        // Guard: el usuario pudo cambiar de vista en estos 80ms y `body`
        // puede haber salido del DOM.
        if (body && body.isConnected) body.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
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

          // â”€â”€ Modo nuevo: renderizar en el área de resultado sin reemplazar botones â”€â”€
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

            var status = $(statusId());
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
                resultArea.innerHTML = RH.renderDocumentCard(pdfs, prefix);
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
                if (rawText.length > 5 && !RH.esErrorTecnico(rawText)) {
                  resultArea.innerHTML = '<div style="white-space:pre-wrap;font-family:monospace;font-size:13px;line-height:1.5;padding:16px;">' + RH.escapeHtml(rawText) + '</div>';
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
              console.error('Error en callback:', e);
              if (Consultia.toast) Consultia.toast({ type: 'error', title: 'No se pudo procesar', message: (e && e.message) || 'Intenta de nuevo.' });
              resultArea.innerHTML = '';
              resultArea.hidden = true;
              btns.forEach(function (b) { b.disabled = false; });
              btn.classList.remove('is-loading', 'is-selected');
            }
            return;
          }

          // â”€â”€ Fallback: comportamiento original (sin cr-btn-result-area) â”€â”€
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
