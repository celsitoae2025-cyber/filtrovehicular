/* ============================================================
   RENDER HELPERS — utilidades compartidas de renderizado
   Usadas por category-view.js y filter.js.
   Carga ANTES que ambos módulos.

   Expone: Consultia.RenderHelpers  (objeto con todas las funciones)
           Consultia.renderPdfIntoContainer  (compat. con código existente)
============================================================ */

(function () {
  'use strict';
  window.Consultia = window.Consultia || {};

  /* â”€â”€ Error detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var ERROR_TECNICO_RE = /ECONN|ETIMEDOUT|ENOTFOUND|socket hang|network error|error en la consulta|no se pudo extraer|error al procesar|timeout|connection reset/i;

  function esErrorTecnico(texto) {
    return ERROR_TECNICO_RE.test(texto);
  }

  function esErrorTecnicoRespuesta(p, resp) {
    if (esErrorTecnico(resp && resp.raw || '')) return true;
    if (esErrorTecnico(p.titulo || '')) return true;
    if (esErrorTecnico(p.mensaje || '')) return true;
    var texto = (p.raw || '');
    (p.secciones || []).forEach(function (s) {
      (s.campos || []).forEach(function (c) {
        texto += ' ' + (c.campo || '') + ' ' + (c.valor || '');
      });
    });
    return esErrorTecnico(texto);
  }

  function htmlMantenimiento() {
    return [
      '<div class="cr-mantenimiento">',
      '  <h4 class="cr-mant-titulo">Servicio en mantenimiento</h4>',
      '  <p class="cr-mant-texto">Esta consulta no está disponible en este momento. Nuestro equipo ya está trabajando para restablecer el servicio a la brevedad.</p>',
      '  <p class="cr-mant-sugerencia">Te recomendamos intentar con una consulta diferente o volver a intentarlo en unos minutos.</p>',
      '  <p class="cr-mant-creditos">Sin cargo — tus créditos están protegidos.</p>',
      '</div>',
    ].join('');
  }

  /* â”€â”€ Text helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  // Quita emojis y caracteres decorativos del texto visible al usuario
  var EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2190}-\u{21FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

  function stripEmoji(s) {
    return String(s || '').replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
  }

  function escapeHtml(s) {
    return stripEmoji(String(s || '')).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /* â”€â”€ Input helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function placeholderFor(t) {
    if (t === 'dni')      return 'Ingresa el DNI (8 dígitos)';
    if (t === 'placa')    return 'Ingresa la placa';
    if (t === 'ruc')      return 'Ingresa el RUC (11 dígitos)';
    if (t === 'telefono') return 'Ingresa el teléfono (9 dígitos)';
    return 'Ingresa el dato';
  }

  function maxLenFor(t) {
    if (t === 'dni')      return 8;
    if (t === 'placa')    return 8;
    if (t === 'ruc')      return 11;
    if (t === 'telefono') return 9;
    return 80;
  }

  function inputModeFor(t) {
    if (t === 'dni' || t === 'ruc' || t === 'telefono') return 'numeric';
    return 'text';
  }

  function validarValor(t, v) {
    v = (v || '').trim();
    if (t === 'dni'      && !/^\d{8}$/.test(v))  return 'El DNI debe tener 8 dígitos.';
    if (t === 'ruc'      && !/^\d{11}$/.test(v)) return 'El RUC debe tener 11 dígitos.';
    if (t === 'telefono' && !/^\d{9}$/.test(v))  return 'El teléfono debe tener 9 dígitos.';
    if (t === 'placa'    && v.length < 5)         return 'La placa debe tener al menos 5 caracteres.';
    if (v.length < 2) return 'Ingrese un valor válido.';
    return null;
  }

  /* â”€â”€ Blob URL tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var activeBlobUrls = [];

  function base64ToBlobUrl(b64, mimeType) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'application/pdf' }));
    activeBlobUrls.push(url);
    return url;
  }

  function revokeActiveBlobUrls() {
    activeBlobUrls.forEach(function (url) {
      try { URL.revokeObjectURL(url); } catch (_) {}
    });
    activeBlobUrls = [];
  }

  /* â”€â”€ PDF fallback UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function pdfFallbackUI(blobUrl, dataUrl, fileName) {
    return '<div class="cr-pdf-fallback">' +
      '<div class="cr-pdf-fallback-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
      '<div class="cr-pdf-fallback-name">' + escapeHtml(fileName) + '</div>' +
      '<div class="cr-pdf-fallback-actions">' +
        '<a class="cr-pdf-fallback-btn cr-pdf-fallback-btn-ghost" href="' + blobUrl + '" target="_blank" rel="noopener">Abrir PDF</a>' +
        '<a class="cr-pdf-fallback-btn" href="' + dataUrl + '" download="' + escapeHtml(fileName) + '">Descargar</a>' +
      '</div>' +
    '</div>';
  }

  /* â”€â”€ PDF.js renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async function renderPdfIntoContainer(container, blobUrl, fileName, base64) {
    var dataUrl = base64 ? ('data:application/pdf;base64,' + base64) : blobUrl;
    if (!window.pdfjsLib) {
      container.innerHTML = pdfFallbackUI(blobUrl, dataUrl, fileName);
      return;
    }
    try {
      // Pasamos los bytes directamente (más confiable en móvil que el blob URL)
      var docInput;
      if (base64) {
        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        docInput = { data: bytes };
      } else {
        docInput = blobUrl;
      }
      var pdf = await pdfjsLib.getDocument(docInput).promise;
      var total = pdf.numPages;
      container.innerHTML = '';
      var stage = document.createElement('div');
      stage.className = 'cr-pdf-stage';
      var canvas = document.createElement('canvas');
      canvas.className = 'cr-pdf-canvas';
      stage.appendChild(canvas);
      container.appendChild(stage);
      var nav = null, pageLabel = null;
      if (total > 1) {
        nav = document.createElement('div');
        nav.className = 'cr-pdf-nav';
        nav.innerHTML =
          '<button type="button" class="cr-pdf-nav-btn" data-act="prev" aria-label="Anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
          '<span class="cr-pdf-nav-label">1 / ' + total + '</span>' +
          '<button type="button" class="cr-pdf-nav-btn" data-act="next" aria-label="Siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>';
        container.appendChild(nav);
        pageLabel = nav.querySelector('.cr-pdf-nav-label');
      }
      var current = 1;
      async function renderPage(num) {
        var page = await pdf.getPage(num);
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var baseViewport = page.getViewport({ scale: 1 });
        // Calcular escala para que el PDF encaje en el contenedor visible
        var displayWidth = stage.clientWidth || 600;
        var cssScale = displayWidth / baseViewport.width;
        var renderScale = cssScale * dpr;
        // Cap absoluto: nunca más de ~6MP para evitar OOM en móviles low-end
        var pixels = baseViewport.width * renderScale * baseViewport.height * renderScale;
        if (pixels > 6e6) renderScale = renderScale * Math.sqrt(6e6 / pixels);
        var viewport = page.getViewport({ scale: renderScale });
        var ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // CSS: mostrar a tamaño real del contenedor (nítido, sin stretching)
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = (displayWidth * baseViewport.height / baseViewport.width) + 'px';
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        if (pageLabel) pageLabel.textContent = num + ' / ' + total;
        if (nav) {
          nav.querySelector('[data-act="prev"]').disabled = (num <= 1);
          nav.querySelector('[data-act="next"]').disabled = (num >= total);
        }
      }
      if (nav) {
        nav.querySelector('[data-act="prev"]').addEventListener('click', function () { if (current > 1) { current--; renderPage(current); } });
        nav.querySelector('[data-act="next"]').addEventListener('click', function () { if (current < total) { current++; renderPage(current); } });
      }
      await renderPage(1);
    } catch (err) {
      console.error('PDF.js render error:', err);
      container.innerHTML = pdfFallbackUI(blobUrl, dataUrl, fileName);
    }
  }

  /* â”€â”€ Record splitting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function isRecordStart(cu) {
    if (!cu) return false;
    if (cu === 'DNI' || cu === 'NUMERO' || cu === 'NÃšMERO' ||
        cu.indexOf('DNI ') === 0 || cu.indexOf('DNI(') === 0) return true;
    // Campos tipo "NÂº DENUNCIA", "N° EXPEDIENTE", "NRO CASO", etc.
    if (/^N[°ÂºRO.]*\s*(DENUNCIA|EXPEDIENTE|CASO|PARTIDA|ORDEN|REGISTRO|RESOLUCI[OÃ“]N)/i.test(cu)) return true;
    return false;
  }

  function splitIntoRecords(campos) {
    var list = campos || [];
    var recs = [], cur = [];
    list.forEach(function (c) {
      var cu = (c.campo || '').toUpperCase().trim();
      if (isRecordStart(cu) && cur.length > 0) { recs.push(cur); cur = []; }
      cur.push(c);
    });
    if (cur.length > 0) recs.push(cur);
    // Dedup de registros idénticos
    var seen = Object.create(null);
    return recs.filter(function (r) {
      var k = r.map(function (c) { return (c.campo || '_') + '::' + (c.valor || ''); }).join('|');
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  /* â”€â”€ Data row rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function isEmptyValue(v) {
    if (!v) return true;
    var t = v.trim().toUpperCase();
    var EMPTY = [
      'N/A', 'NA', 'N/D', 'ND', '-', '--', '---',
      'NO DISPONIBLE', 'NO REGISTRA', 'SIN DATO', 'SIN DATOS', 'NO APLICA',
      '[]', '[ ]', '[-]', '[ - ]', 'âŒ', '[âŒ]', '[ âŒ ]',
    ];
    if (EMPTY.indexOf(t) !== -1) return true;
    if (/^\[\s*\]$/.test(t))  return true;
    if (/^\[\s*-\s*\]$/.test(t)) return true;
    if (/^\s*âŒ\s*$/.test(t)) return true;
    return false;
  }

  function renderDataRows(p) {
    var prettyLabel = Consultia.ConsultaRunner ? Consultia.ConsultaRunner.prettyLabel : function (s) { return s; };
    var toTitleCase = Consultia.ConsultaRunner ? Consultia.ConsultaRunner.toTitleCase : function (s) { return s; };
    var dataHtml = [];
    if (p.titulo) dataHtml.push('<div class="cr-tit">' + escapeHtml(p.titulo) + '</div>');

    // Dedup secciones idénticas
    var seenSec = Object.create(null);
    var uniqSec = [];
    (p.secciones || []).forEach(function (s) {
      var sig = (s.campos || []).map(function (c) { return (c.campo || '_') + '::' + (c.valor || ''); }).join('Â§Â§');
      if (!sig || seenSec[sig]) return;
      seenSec[sig] = true;
      uniqSec.push(s);
    });

    function renderCampo(c) {
      if (c.campo && isEmptyValue(c.valor)) return '';
      if (c.campo) return '<div class="cr-row"><span class="cr-k">' + escapeHtml(prettyLabel(c.campo)) + '</span><span class="cr-v">' + escapeHtml(c.valor) + '</span></div>';
      if (c.valor && !isEmptyValue(c.valor)) return '<div class="cr-row"><span class="cr-v">' + escapeHtml(c.valor) + '</span></div>';
      return '';
    }

    uniqSec.forEach(function (s, idx) {
      var isFirst = idx === 0 && (s.titulo === 'General' || s.titulo === 'Datos principales');
      var campos = s.campos || [];
      if (!campos.length) return;
      var recs = splitIntoRecords(campos);

      dataHtml.push('<div class="cr-sect">');
      if (!isFirst) {
        if (s.titulo) dataHtml.push('<h4>' + escapeHtml(toTitleCase(s.titulo)) + '</h4>');
        dataHtml.push('<div class="cr-sect-body">');
      }
      if (recs.length > 1) {
        dataHtml.push('<div class="cr-2col-wrapper">');
        var mid = Math.ceil(recs.length / 2);
        var leftRecs  = recs.slice(0, mid);
        var rightRecs = recs.slice(mid);

        // Suprime el índice si el primer campo ya identifica al registro
        function skipIndex(fld) {
          if (fld === 'NUMERO' || fld === 'NÃšMERO') return true;
          if (/^N[°ÂºRO.]*\s*(DENUNCIA|EXPEDIENTE|CASO|PARTIDA|ORDEN|RESOLUCI)/i.test(fld)) return true;
          return false;
        }

        // Columna izquierda
        dataHtml.push('<div class="cr-col-box">');
        leftRecs.forEach(function (rec, ri) {
          dataHtml.push('<div class="cr-record' + (ri > 0 ? ' cr-record-next' : '') + '">');
          var firstF = (rec[0] && rec[0].campo) ? rec[0].campo.toUpperCase().trim() : '';
          if (!skipIndex(firstF)) {
            dataHtml.push('<div class="cr-record-index">Registro ' + (ri + 1) + ' de ' + recs.length + '</div>');
          }
          rec.forEach(function (c) { dataHtml.push(renderCampo(c)); });
          dataHtml.push('</div>');
        });
        dataHtml.push('</div>');

        // Columna derecha
        if (rightRecs.length > 0) {
          dataHtml.push('<div class="cr-col-box">');
          rightRecs.forEach(function (rec, ri) {
            var actualIndex = mid + ri;
            dataHtml.push('<div class="cr-record' + (ri > 0 ? ' cr-record-next' : '') + '">');
            var firstF = (rec[0] && rec[0].campo) ? rec[0].campo.toUpperCase().trim() : '';
            if (!skipIndex(firstF)) {
              dataHtml.push('<div class="cr-record-index">Registro ' + (actualIndex + 1) + ' de ' + recs.length + '</div>');
            }
            rec.forEach(function (c) { dataHtml.push(renderCampo(c)); });
            dataHtml.push('</div>');
          });
          dataHtml.push('</div>');
        }
        dataHtml.push('</div>');
      } else {
        recs.forEach(function (rec) {
          rec.forEach(function (c) { dataHtml.push(renderCampo(c)); });
        });
      }
      if (!isFirst) dataHtml.push('</div>');
      dataHtml.push('</div>');
    });
    return dataHtml.join('');
  }

  /* â”€â”€ Media helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  // Devuelve el sufijo de clase segun la cantidad de fotos.
  // El CSS define layouts específicos para 1..4 fotos; 5+ usa un grid auto-fit.
  function mediaCountClass(prefix, n) {
    if (n <= 0) return '';
    if (n <= 4) return prefix + '-' + n;
    return prefix + '-n';
  }

  // Mide la saturación de color promedio de un <img> ya cargado.
  // Huellas y firmas son grises (sat ~0); el rostro tiene tonos de piel (sat > 0.1).
  // Samplea a 32x32 = 1024 pixels, < 5 ms por imagen.
  function measureSaturation(img) {
    try {
      var SZ = 32;
      var canvas = document.createElement('canvas');
      canvas.width = SZ; canvas.height = SZ;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, SZ, SZ);
      var data = ctx.getImageData(0, 0, SZ, SZ).data;
      var totalSat = 0, count = 0;
      for (var i = 0; i < data.length; i += 4) {
        var r = data[i], g = data[i + 1], b = data[i + 2];
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        // Ignorar píxeles casi negros (fondo) para evitar ruido
        if (max < 30) continue;
        totalSat += (max - min) / max;
        count++;
      }
      return count > 0 ? totalSat / count : 0;
    } catch (e) {
      return 0;
    }
  }

  // Cuando hay exactamente 4 fotos (caso DNI/RENIEC Full: rostro + firma + 2 huellas)
  // las clasifica para aplicar el layout estilo DNI peruano.
  function applyDniLayout(container) {
    if (!container) return;
    var imgs = container.querySelectorAll('img');
    if (imgs.length !== 4) return;
    var promises = Array.prototype.map.call(imgs, function (img) {
      return new Promise(function (res) {
        function compute() {
          var w = img.naturalWidth || 1;
          var h = img.naturalHeight || 1;
          res({ img: img, w: w, h: h, ratio: w / h, sat: measureSaturation(img) });
        }
        if (img.complete && img.naturalWidth) compute();
        else {
          img.addEventListener('load', compute, { once: true });
          img.addEventListener('error', function () {
            res({ img: img, w: 1, h: 1, ratio: 1, sat: 0 });
          }, { once: true });
        }
      });
    });
    Promise.all(promises).then(function (results) {
      // Rostro: la foto con mayor saturación (única a color)
      var bySat = results.slice().sort(function (a, b) { return b.sat - a.sat; });
      var face = bySat[0];
      // Si la saturación es muy baja no es el patrón DNI típico — dejamos el layout 2Ã—2
      if (face.sat < 0.08) return;
      var rest = results.filter(function (r) { return r !== face; });
      // Firma: la más ancha entre las 3 grises (ratio mayor)
      rest.sort(function (a, b) { return b.ratio - a.ratio; });
      var sign = rest[0];
      if (sign.ratio < 1.05) return;
      var fps = rest.slice(1);
      if (fps.length < 2) return;
      face.img.classList.add('cr-photo-face');
      sign.img.classList.add('cr-photo-sign');
      fps[0].img.classList.add('cr-photo-fp1');
      fps[1].img.classList.add('cr-photo-fp2');
      if (container.classList.contains('cr-media-4')) {
        container.classList.remove('cr-media-4');
        container.classList.add('cr-media-4-dni');
      } else if (container.classList.contains('cr-gallery-4')) {
        container.classList.remove('cr-gallery-4');
        container.classList.add('cr-gallery-4-dni');
      }
    });
  }

  /* ── Marca de agua institucional ──────────────────────────────────
     Sella la esquina inferior derecha de una foto biométrica con un
     rectángulo del color institucional FV+ y el texto "Filtro
     Vehicular+" encima — tapa la marca del proveedor de datos
     original antes de mostrar/descargar la imagen. */
  function applyWatermark(base64, mimeType) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          var ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          var w = c.width, h = c.height;
          var boxW = Math.round(w * 0.45);
          var boxH = Math.round(h * 0.065);
          var bx = w - boxW, by = h - boxH;
          ctx.fillStyle = '#141d1c';
          ctx.fillRect(bx, by, boxW, boxH);
          var fontSize = Math.max(13, Math.round(boxH * 0.55));
          ctx.font = 'bold ' + fontSize + 'px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Filtro Vehicular+', bx + boxW / 2, by + boxH / 2);
          resolve(c.toDataURL('image/jpeg', 0.95).split(',')[1]);
        } catch (e) {
          resolve(base64);
        }
      };
      img.onerror = function () { resolve(base64); };
      img.src = 'data:' + (mimeType || 'image/jpeg') + ';base64,' + base64;
    });
  }

  // Sella todas las fotos "biométricas" normales de medios (tipo photo,
  // NO candidatos de reconocimiento facial — esos se muestran sin sellar,
  // igual que en VeriNexo) mutando su base64 in-place. Se llama una vez
  // antes de renderResultado() para que tanto la galería como el PDF
  // autogenerado usen la versión ya sellada.
  function applyWatermarksToPhotos(medios) {
    var targets = (medios || []).filter(function (m) { return m.tipo === 'photo' && !m.esCandidato; });
    if (!targets.length) return Promise.resolve();
    return Promise.all(targets.map(function (m) {
      return applyWatermark(m.base64, m.mimeType).then(function (b64) { m.base64 = b64; });
    }));
  }

  function renderGallery(titulo, photos) {
    var parts = [];
    if (titulo) parts.push('<div class="cr-tit">' + escapeHtml(titulo) + '</div>');
    var galleryClass = ('cr-gallery ' + mediaCountClass('cr-gallery', photos.length)).trim();
    parts.push('<div class="' + galleryClass + '">');
    photos.forEach(function (m, i) {
      var src = 'data:' + (m.mimeType || 'image/jpeg') + ';base64,' + m.base64;
      parts.push('<img src="' + src + '" alt="Imagen ' + (i + 1) + '">');
    });
    parts.push('</div>');
    return '<div class="cr-gallery-layout">' + parts.join('') + '</div>';
  }

  // Render de datos + fotos al costado (cuando el bot manda texto + imagen)
  // Columna de imágenes biométricas — mismo criterio de VeriNexo:
  // documento escaneado (DNI) => columna más ancha; anverso+reverso (2
  // imágenes de documento) => el doble de ancho en 2 columnas; caso por
  // defecto (foto+firma+huellas) => columna angosta de una sola foto por
  // fila, apiladas en el orden en que llegan.
  function renderDataWithMedia(p, photos) {
    var mediaParts = [];
    if (photos.length) {
      var esDniDoc = /dni/i.test((photos[0] && photos[0].filename) || '');
      var esAnversoReverso = esDniDoc && photos.length === 2;
      var colW = esAnversoReverso ? 620 : esDniDoc ? 320 : 160;
      var tileH = esAnversoReverso ? 240 : esDniDoc ? 200 : 150;
      var gridCols = esAnversoReverso ? 'repeat(2, 1fr)' : '1fr';
      mediaParts.push(
        '<div class="cr-bio-col" style="width:' + colW + 'px;max-width:100%;display:grid;grid-template-columns:' + gridCols + ';gap:12px;">'
      );
      photos.forEach(function (m, i) {
        var src = 'data:' + (m.mimeType || 'image/jpeg') + ';base64,' + m.base64;
        mediaParts.push(
          '<div class="cr-bio-tile" style="height:' + tileH + 'px;" data-full="' + src + '">' +
            '<img src="' + src + '" alt="Foto ' + (i + 1) + '">' +
          '</div>'
        );
      });
      mediaParts.push('</div>');
    }
    return '<div class="cr-layout">' +
      '<div class="cr-data">' + renderDataRows(p) + '</div>' +
      '<div class="cr-media">' + mediaParts.join('') + '</div>' +
    '</div>';
  }

  // Mapea el NOMBRE de columna al campo correspondiente de la fila —
  // portado 1:1 de VeriNexo (page.tsx columnaValor). Las tablas del bot
  // llegan con nombres de campo en minúscula (dni, nombres, tipo...)
  // pero las columnas mostradas están en mayúscula.
  function columnaValor(col, f) {
    var upper = (col || '').trim().toUpperCase();
    if (upper === '#' || upper === 'N°' || upper === 'Nº' || upper === 'N' || upper === 'NO' || upper === 'NRO') return String(f.num != null ? f.num : '');
    if (upper === 'RELACIÓN' || upper === 'TIPO' || upper === 'PARENTESCO') return String(f.tipo || '');
    if (upper === 'DNI') return f.dni || '';
    if (upper === 'NOMBRES') return f.nombres || '';
    if (upper === 'APELLIDOS') return f.apellidos || '';
    if (upper === 'NACIMIENTO') return f.nacimiento || '';
    if (upper === 'EDAD') return f.edad || '';
    if (upper === 'NÚMERO' || upper === 'NUMERO') return f.numero || '';
    if (upper === 'OPERADOR') return f.operador || '';
    if (upper === 'PERÍODO' || upper === 'PERIODO') return f.periodo || '';
    if (upper === 'GÉNERO' || upper === 'GENERO' || upper === 'SEXO') {
      var g = (f.genero || '').trim().toUpperCase();
      if (g === 'M' || g === 'MASCULINO') return 'MASCULINO';
      if (g === 'F' || g === 'FEMENINO') return 'FEMENINO';
      return f.genero || '';
    }
    return String(f[col] != null ? f[col] : (f[(col || '').toLowerCase()] || ''));
  }

  // Tabla real de resultados (árbol genealógico / homónimos) — mismo
  // diseño que VeriNexo: header con fondo oscuro institucional, filas
  // alternadas, ancho completo, scroll horizontal si no entra.
  function renderTabla(tabla) {
    if (!tabla || !tabla.filas || !tabla.filas.length) return '';
    var parts = [];
    parts.push('<div class="cr-tabla-wrap">');
    parts.push('<div class="cr-tabla-head">');
    parts.push('<span class="cr-tabla-tit">' + escapeHtml(tabla.titulo || 'Resultados') + '</span>');
    parts.push('<span class="cr-tabla-total">' + (tabla.total || tabla.filas.length) + ' resultados</span>');
    parts.push('</div>');
    parts.push('<div class="cr-tabla-scroll"><table class="cr-tabla">');
    parts.push('<thead><tr>');
    (tabla.columnas || []).forEach(function (col) {
      parts.push('<th>' + escapeHtml(col) + '</th>');
    });
    parts.push('</tr></thead><tbody>');
    tabla.filas.forEach(function (f, fi) {
      parts.push('<tr class="' + (fi % 2 === 0 ? 'cr-tabla-even' : 'cr-tabla-odd') + '">');
      (tabla.columnas || []).forEach(function (col) {
        parts.push('<td>' + escapeHtml(columnaValor(col, f)) + '</td>');
      });
      parts.push('</tr>');
    });
    parts.push('</tbody></table></div>');
    parts.push('</div>');
    return parts.join('');
  }

  // Tarjeta simple "Documento adjunto" — Visualizar (visor lazy, colapsable)
  // + Descargar. Se usa cuando YA hay datos mostrados como filas/tabla y el
  // PDF es solo un adjunto extra, no el contenido principal — mismo patrón
  // que VeriNexo (tarjeta "Documento PDF" con Visualizar/Descargar, en vez
  // del visor grande embebido de renderPdfPreview).
  function renderDocumentCard(pdfs, uniqPrefix) {
    if (!pdfs || !pdfs.length) return '';
    var parts = [];
    parts.push('<div class="cr-doccards">');
    pdfs.forEach(function (m, i) {
      var mime = m.mimeType || 'application/pdf';
      var blobUrl = base64ToBlobUrl(m.base64, mime);
      var fn = m.filename || ('documento-' + (i + 1) + '.pdf');
      var titulo = pdfs.length > 1 ? ('Documento ' + (i + 1)) : 'Documento adjunto';
      var cid = (uniqPrefix || 'rh') + '-doc-' + Date.now() + '-' + i;
      parts.push(
        '<div class="cr-doccard">' +
          '<div class="cr-doccard-head">' +
            '<span class="cr-doccard-tit">' + escapeHtml(titulo) + '</span>' +
            '<div class="cr-doccard-actions">' +
              '<button type="button" class="cr-doccard-view" data-target="' + cid + '" data-blob="' + blobUrl + '" data-fn="' + escapeHtml(fn) + '">Visualizar</button>' +
              '<a class="cr-doccard-dl" href="' + blobUrl + '" download="' + escapeHtml(fn) + '">Descargar</a>' +
            '</div>' +
          '</div>' +
          '<div class="cr-doccard-viewer" id="' + cid + '" hidden></div>' +
        '</div>'
      );
    });
    parts.push('</div>');
    return parts.join('');
  }

  function renderPdfPreview(p, pdfs, hasData, uniqPrefix) {
    var parts = [];
    var wrapClass = hasData ? 'cr-pdf-split' : 'cr-pdf-nosplit';
    parts.push('<div class="' + wrapClass + '">');
    // Preparar datos de PDFs antes del HTML para usarlos en la columna de datos
    var toRender = [];
    var multi = pdfs.length > 1;
    var pdfMetas = [];
    pdfs.forEach(function (m, i) {
      var mime = m.mimeType || 'application/pdf';
      var blobUrl = base64ToBlobUrl(m.base64, mime);
      var fn = m.filename || ('reporte-' + (i + 1) + '.pdf');
      var cid = (uniqPrefix || 'rh') + '-pdf-' + Date.now() + '-' + i;
      var sizeKB = m.base64 ? Math.round((m.base64.length * 3 / 4) / 1024) : 0;
      pdfMetas.push({ cid: cid, blobUrl: blobUrl, fn: fn, base64: m.base64, mime: mime, sizeKB: sizeKB });
    });

    // Columna izquierda: datos (colapsable) + info del documento
    if (hasData) {
      parts.push('<div class="cr-pdf-data">');
      var duid = 'cr-pdf-det-' + Date.now();
      parts.push(
        '<div class="cr-btn-details">' +
          '<button type="button" class="cr-btn-details-toggle" aria-expanded="false" data-target="' + duid + '">' +
            '<svg class="cr-btn-details-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
            '<span>Ver detalles de la consulta</span>' +
          '</button>' +
          '<div class="cr-btn-details-body" id="' + duid + '" hidden>' +
            renderDataRows(p) +
            '<button type="button" class="cr-btn-details-close" data-target="' + duid + '">' +
              '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>' +
              '<span>Cerrar detalles</span>' +
            '</button>' +
          '</div>' +
        '</div>'
      );
      // Panel de info del documento para llenar espacio vacío
      parts.push('<div class="cr-pdf-doc-info">');
      parts.push('<div class="cr-pdf-doc-info-title">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        '<span>Documento adjunto</span></div>');
      pdfMetas.forEach(function (pm, i) {
        var sizeStr = pm.sizeKB >= 1024 ? (pm.sizeKB / 1024).toFixed(1) + ' MB' : pm.sizeKB + ' KB';
        parts.push('<div class="cr-pdf-doc-row">');
        parts.push('<span class="cr-pdf-doc-name">' + escapeHtml(pm.fn) + '</span>');
        parts.push('<span class="cr-pdf-doc-size">' + sizeStr + '</span>');
        parts.push('</div>');
      });
      var now = new Date();
      var dateStr = now.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
      var timeStr = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      parts.push('<div class="cr-pdf-doc-meta">');
      parts.push('<div class="cr-pdf-doc-meta-row"><span>Fecha</span><strong>' + dateStr + '</strong></div>');
      parts.push('<div class="cr-pdf-doc-meta-row"><span>Hora</span><strong>' + timeStr + '</strong></div>');
      parts.push('<div class="cr-pdf-doc-meta-row"><span>Formato</span><strong>PDF</strong></div>');
      if (pdfMetas.length > 0) {
        parts.push('<div class="cr-pdf-doc-meta-row"><span>Documentos</span><strong>' + pdfMetas.length + '</strong></div>');
      }
      parts.push('</div>');
      // Botón de descarga por cada PDF (oculto hasta que el PDF renderice)
      if (pdfMetas.length > 0) {
        parts.push('<div class="cr-pdf-doc-downloads" hidden>');
        pdfMetas.forEach(function (pm, i) {
          var label = pdfMetas.length === 1 ? 'Descargar PDF' : 'Descargar ' + (i + 1) + ' de ' + pdfMetas.length;
          parts.push('<a class="cr-pdf-doc-dl" href="' + pm.blobUrl + '" download="' + escapeHtml(pm.fn) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            '<span>' + label + '</span></a>');
        });
        parts.push('</div>');
      }
      parts.push('</div>'); // cierra cr-pdf-doc-info
      parts.push('</div>'); // cierra cr-pdf-data
    }

    // Columna derecha: visor PDF
    parts.push('<div class="cr-pdf-viewer">');
    pdfMetas.forEach(function (pm, i) {
      parts.push('<div class="cr-pdf-block' + (multi ? ' cr-pdf-block-multi' : '') + '">');
      if (multi) {
        parts.push('<div class="cr-pdf-block-header">' +
          '<span class="cr-pdf-block-num">Documento ' + (i + 1) + ' de ' + pdfs.length + '</span>' +
          '<span class="cr-pdf-block-name">' + escapeHtml(pm.fn) + '</span>' +
        '</div>');
      }
      parts.push('<div class="cr-pdf-block-inner">');
      parts.push('<div class="cr-pdf-canvas-wrap" id="' + pm.cid + '"><div class="cr-pdf-loading">Cargando PDF…</div></div>');
      parts.push('</div>');
      toRender.push(pm);
      parts.push('</div>');
    });
    parts.push('</div></div>');
    setTimeout(function () {
      var pending = toRender.length;
      toRender.forEach(function (r) {
        var el = document.getElementById(r.cid);
        if (el) {
          // Click en el thumbnail = descarga el PDF (mismo patrón que ReportGenerator)
          el.addEventListener('click', function () {
            var a = document.createElement('a');
            a.href = r.blobUrl;
            a.download = r.fn || 'documento.pdf';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { document.body.removeChild(a); }, 200);
          });
          renderPdfIntoContainer(el, r.blobUrl, r.fn, r.base64).then(function () {
            pending--;
            if (pending <= 0) {
              var dls = el.closest('.cr-pdf-layout');
              if (dls) {
                var dlBox = dls.querySelector('.cr-pdf-doc-downloads[hidden]');
                if (dlBox) dlBox.hidden = false;
              }
            }
          });
        } else {
          pending--;
        }
      });
    }, 0);
    return '<div class="cr-pdf-layout">' + parts.join('') + '</div>';
  }

  // Silueta decorativa de documento (SVG inline)
  var DOC_ILLUST =
    '<svg class="cr-btn-illust-svg" viewBox="0 0 180 250" fill="none">' +
      '<rect x="6" y="6" width="160" height="230" rx="4" fill="#f5f5f5"/>' +
      '<rect x="2" y="2" width="160" height="230" rx="4" fill="#fff" stroke="#f5f5f5" stroke-width=".8"/>' +
      '<rect x="2" y="2" width="160" height="38" rx="4" fill="#f5f5f5"/>' +
      '<line x1="2" y1="40" x2="162" y2="40" stroke="#f5f5f5" stroke-width=".6"/>' +
      '<path d="M74 10h16v18c0 4-8 8-8 8s-8-4-8-8V10z" fill="#f5f5f5"/>' +
      '<rect x="44" y="48" width="76" height="4" rx="2" fill="#f5f5f5"/>' +
      '<rect x="54" y="56" width="56" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<line x1="18" y1="68" x2="146" y2="68" stroke="#f5f5f5" stroke-width=".5"/>' +
      '<rect x="18" y="78" width="34" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="66" y="78" width="78" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="18" y="90" width="42" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="66" y="90" width="60" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="18" y="102" width="28" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="66" y="102" width="70" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="18" y="114" width="38" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="66" y="114" width="52" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<line x1="18" y1="128" x2="146" y2="128" stroke="#f5f5f5" stroke-width=".5"/>' +
      '<rect x="18" y="138" width="36" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="66" y="138" width="66" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="18" y="150" width="44" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="66" y="150" width="56" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="18" y="162" width="32" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="66" y="162" width="78" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<line x1="18" y1="176" x2="146" y2="176" stroke="#f5f5f5" stroke-width=".5"/>' +
      '<rect x="18" y="186" width="126" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="18" y="194" width="110" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<rect x="18" y="202" width="90" height="3" rx="1.5" fill="#f5f5f5"/>' +
      '<circle cx="126" cy="218" r="12" fill="none" stroke="#f5f5f5" stroke-width=".7" stroke-dasharray="2 1.5"/>' +
      '<line x1="18" y1="222" x2="76" y2="222" stroke="#f5f5f5" stroke-dasharray="4 2" stroke-width=".7"/>' +
    '</svg>';

  // Renderiza una lista de botones inline enviados por el bot.
  // Datos completos van dentro de un colapsable "Ver detalles".
  // Incluye un área de resultado donde el PDF aparecerá sin reemplazar los botones.
  function renderButtonList(p, botones) {
    var prettyLabel = Consultia.ConsultaRunner ? Consultia.ConsultaRunner.prettyLabel : function (s) { return s; };
    var parts = [];
    if (p && p.titulo) parts.push('<div class="cr-tit">' + escapeHtml(p.titulo) + '</div>');

    // Separar campos cabecera de registros individuales
    var headerCampos = [];
    var recordDetails = [];
    (p.secciones || []).forEach(function (s) {
      var recs = splitIntoRecords(s.campos || []);
      recs.forEach(function (rec) {
        var firstF = (rec[0] && rec[0].campo) ? rec[0].campo.toUpperCase().trim() : '';
        if (isRecordStart(firstF)) {
          var tip = '', fecha = '';
          rec.forEach(function (c) {
            var cf = (c.campo || '').toUpperCase().trim();
            if (!tip && (cf.indexOf('TIPIFICACION') !== -1 || cf.indexOf('TIPIFICACIÃ“N') !== -1 ||
                cf === 'TIPO' || cf === 'DELITO' || cf.indexOf('DESCRIPCION') !== -1 ||
                cf.indexOf('DESCRIPCIÃ“N') !== -1 || cf === 'MOTIVO' || cf === 'CONCEPTO')) {
              tip = c.valor || '';
            }
            if (!fecha && (cf.indexOf('FECHA') !== -1 || cf.indexOf('F.') !== -1 || cf === 'F. REGISTRO' || cf === 'REGISTRO')) {
              fecha = c.valor || '';
            }
          });
          recordDetails.push({ tip: tip, fecha: fecha });
        } else {
          rec.forEach(function (c) {
            if (c.campo && !isEmptyValue(c.valor)) headerCampos.push(c);
          });
        }
      });
    });

    // Ãrea de resultado (full-width, arriba del grid)
    parts.push('<div class="cr-btn-result-area" hidden></div>');

    // Grid: columna izquierda (contenido) + columna derecha (ilustración)
    parts.push('<div class="cr-btn-grid">');
    parts.push('<div class="cr-btn-main">');

    // Cabecera compacta
    if (headerCampos.length > 0) {
      parts.push('<div class="cr-btn-summary">');
      headerCampos.forEach(function (c) {
        parts.push('<span class="cr-btn-summary-item"><span class="cr-btn-summary-k">' +
          escapeHtml(prettyLabel(c.campo)) + '</span> <strong>' + escapeHtml(c.valor) + '</strong></span>');
      });
      parts.push('</div>');
    }

    // Colapsable "Ver detalles"
    var hasData = (p.secciones || []).some(function (s) { return (s.campos || []).length > 0; });
    if (hasData) {
      var uid = 'cr-details-' + Date.now();
      parts.push('<div class="cr-btn-details">');
      parts.push(
        '<button type="button" class="cr-btn-details-toggle" aria-expanded="false" data-target="' + uid + '">' +
          '<svg class="cr-btn-details-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
          '<span>Ver detalles de la consulta</span>' +
        '</button>'
      );
      parts.push('<div class="cr-btn-details-body" id="' + uid + '" hidden>');
      parts.push(renderDataRows(p));
      // Botón "Cerrar detalles" al final del contenido expandido
      parts.push(
        '<button type="button" class="cr-btn-details-close" data-target="' + uid + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>' +
          '<span>Cerrar detalles</span>' +
        '</button>'
      );
      parts.push('</div>'); // cierra details-body
      parts.push('</div>'); // cierra details
    }

    // Botones de selección
    parts.push('<div class="cr-btn-section">');
    parts.push('<div class="cr-btn-hint">Elige una opción:</div>');
    parts.push('<div class="cr-btn-list">');
    botones.forEach(function (b, idx) {
      var detail = recordDetails[idx] || {};
      var tipHtml = detail.tip
        ? '<span class="cr-btn-option-tip">' + escapeHtml(detail.tip) + '</span>'
        : '';
      parts.push(
        '<button type="button" class="cr-btn-option" ' +
          'data-msgid="' + escapeHtml(String(b.msgId)) + '" ' +
          'data-callback="' + escapeHtml(b.data) + '">' +
          '<div class="cr-btn-option-body">' +
            '<span class="cr-btn-option-text">' + escapeHtml(b.text) + '</span>' +
            tipHtml +
          '</div>' +
          '<svg class="cr-btn-option-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
        '</button>'
      );
    });
    parts.push('</div></div>'); // cierra list + section
    parts.push('</div>'); // cierra cr-btn-main

    // Ilustración decorativa (columna derecha)
    parts.push(
      '<div class="cr-btn-illust">' +
        DOC_ILLUST +
        '<span class="cr-btn-illust-label">Selecciona una opción<br>para ver el documento</span>' +
      '</div>'
    );

    parts.push('</div>'); // cierra cr-btn-grid
    return '<div class="cr-btn-layout">' + parts.join('') + '</div>';
  }

  // Devuelve el % numérico de un string tipo "85.7%" para poder ordenar.
  function pctNum(s) {
    var n = parseFloat(String(s || '').replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  /* ── Reconocimiento facial: mejor coincidencia destacada + resto en
     tarjetas — mismo diseño que VeriNexo, con la paleta institucional
     de FV+ (sin sombras, solo bold/normal). Consume parsed.facial
     (candidatos con dni/nombres/edad/ubigeo/confianza/foto), extraído
     directo del PDF del bot por enrich.js — no depende de botones. */
  function renderFacialHero(facial) {
    if (!facial || !facial.length) return '';
    var ordenados = facial.slice().sort(function (a, b) { return pctNum(b.similitud) - pctNum(a.similitud); });
    var mejor = ordenados[0];
    var resto = ordenados.slice(1);
    var parts = [];

    parts.push('<div class="cr-facial-layout">');
    parts.push('<div class="cr-facial-eyebrow">Reconocimiento facial</div>');
    parts.push('<div class="cr-facial-headrow">');
    parts.push('<h3 class="cr-facial-title">Coincidencias encontradas</h3>');
    parts.push('<span class="cr-facial-count">' + facial.length + ' candidatos</span>');
    parts.push('</div>');

    // Tarjeta destacada — mejor coincidencia
    parts.push('<div class="cr-facial-hero">');
    var heroSrc = mejor.foto ? ('data:' + (mejor.foto.mime || 'image/jpeg') + ';base64,' + mejor.foto.base64) : '';
    parts.push('<div class="cr-facial-hero-row">');
    parts.push(
      mejor.foto
        ? '<div class="cr-facial-hero-photo" data-full="' + heroSrc + '"><img src="' + heroSrc + '" alt="' + escapeHtml(mejor.nombres || 'Candidato') + '"></div>'
        : '<div class="cr-facial-hero-photo cr-facial-photo-empty"></div>'
    );
    parts.push('<div class="cr-facial-hero-info">');
    parts.push('<div class="cr-facial-badge">Mejor coincidencia</div>');
    if (mejor.nombres) parts.push('<div class="cr-facial-hero-name">' + escapeHtml(mejor.nombres) + '</div>');
    parts.push('<div class="cr-facial-hero-sim"><span class="cr-facial-sim-num">' + escapeHtml(mejor.similitud || '') + '</span><span class="cr-facial-sim-label">Similitud</span></div>');
    parts.push('</div></div>');
    parts.push('<div class="cr-facial-hero-fields">');
    [['DNI', mejor.dni], ['Edad', mejor.edad], ['Confianza', mejor.confianza], ['Ubigeo', mejor.ubigeo]].forEach(function (pair) {
      if (!pair[1]) return;
      parts.push('<div><div class="cr-facial-field-k">' + pair[0] + '</div><div class="cr-facial-field-v">' + escapeHtml(pair[1]) + '</div></div>');
    });
    parts.push('</div>');
    parts.push('</div>');

    // Resto de coincidencias — galería de tarjetas
    if (resto.length > 0) {
      parts.push('<div class="cr-facial-rest-tit">Otras coincidencias</div>');
      parts.push('<div class="cr-facial-rest-grid">');
      resto.forEach(function (c) {
        var src = c.foto ? ('data:' + (c.foto.mime || 'image/jpeg') + ';base64,' + c.foto.base64) : '';
        parts.push('<div class="cr-facial-card">');
        parts.push('<div class="cr-facial-card-photo' + (c.foto ? '' : ' cr-facial-photo-empty') + '"' + (c.foto ? ' data-full="' + src + '"' : '') + '>');
        if (c.foto) parts.push('<img src="' + src + '" alt="' + escapeHtml(c.nombres || 'Candidato') + '">');
        parts.push('<span class="cr-facial-card-sim">' + escapeHtml(c.similitud || '') + '</span>');
        parts.push('</div>');
        parts.push('<div class="cr-facial-card-body">');
        if (c.nombres) parts.push('<div class="cr-facial-card-name">' + escapeHtml(c.nombres) + '</div>');
        if (c.dni) parts.push('<div class="cr-facial-card-row"><span>DNI</span>' + escapeHtml(c.dni) + '</div>');
        if (c.edad) parts.push('<div class="cr-facial-card-row"><span>Edad</span>' + escapeHtml(c.edad) + '</div>');
        if (c.ubigeo) parts.push('<div class="cr-facial-card-ubigeo">' + escapeHtml(c.ubigeo) + '</div>');
        parts.push('</div></div>');
      });
      parts.push('</div>');
    }
    parts.push('</div>');
    return parts.join('');
  }

  /* ── Lightbox simple para ampliar una foto a pantalla completa ────── */
  function openLightbox(src) {
    var el = document.getElementById('cr-lightbox');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cr-lightbox';
      el.className = 'cr-lightbox';
      el.innerHTML = '<div class="cr-lightbox-backdrop"></div>' +
        '<button type="button" class="cr-lightbox-close" aria-label="Cerrar">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
        '<img class="cr-lightbox-img" alt="">';
      document.body.appendChild(el);
    }
    el.querySelector('.cr-lightbox-img').src = src;
    el.hidden = false;
    document.body.classList.add('cr-lightbox-open');
  }
  function closeLightbox() {
    var el = document.getElementById('cr-lightbox');
    if (el) el.hidden = true;
    document.body.classList.remove('cr-lightbox-open');
  }

  /* â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  Consultia.RenderHelpers = {
    esErrorTecnico:          esErrorTecnico,
    esErrorTecnicoRespuesta: esErrorTecnicoRespuesta,
    htmlMantenimiento:       htmlMantenimiento,
    stripEmoji:              stripEmoji,
    escapeHtml:              escapeHtml,
    placeholderFor:          placeholderFor,
    maxLenFor:               maxLenFor,
    inputModeFor:            inputModeFor,
    validarValor:            validarValor,
    base64ToBlobUrl:         base64ToBlobUrl,
    revokeActiveBlobUrls:    revokeActiveBlobUrls,
    pdfFallbackUI:           pdfFallbackUI,
    renderPdfIntoContainer:  renderPdfIntoContainer,
    isRecordStart:           isRecordStart,
    splitIntoRecords:        splitIntoRecords,
    isEmptyValue:            isEmptyValue,
    renderDataRows:          renderDataRows,
    mediaCountClass:         mediaCountClass,
    measureSaturation:       measureSaturation,
    applyDniLayout:          applyDniLayout,
    renderGallery:           renderGallery,
    renderDataWithMedia:     renderDataWithMedia,
    renderPdfPreview:        renderPdfPreview,
    renderButtonList:        renderButtonList,
    applyWatermark:          applyWatermark,
    applyWatermarksToPhotos: applyWatermarksToPhotos,
    renderFacialHero:        renderFacialHero,
    renderTabla:             renderTabla,
    renderDocumentCard:      renderDocumentCard,
    columnaValor:            columnaValor,
  };

  // Compat: category-view.js lo expone en Consultia.renderPdfIntoContainer
  Consultia.renderPdfIntoContainer = renderPdfIntoContainer;

  /* â”€â”€ Delegación global: toggles "Ver detalles" / "Cerrar detalles" â”€â”€ */
  document.addEventListener('click', function (e) {
    // Lightbox: candidatos faciales y fotos biométricas
    var photo = e.target.closest('.cr-facial-hero-photo[data-full], .cr-facial-card-photo[data-full], .cr-bio-tile[data-full]');
    if (photo) { openLightbox(photo.getAttribute('data-full')); return; }
    if (e.target.closest('.cr-lightbox-close') || e.target.closest('.cr-lightbox-backdrop')) {
      closeLightbox();
      return;
    }
    // Tarjeta de documento: "Visualizar" abre/cierra un visor lazy (solo
    // renderiza el PDF con PDF.js la primera vez que se abre).
    var docToggle = e.target.closest('.cr-doccard-view');
    if (docToggle) {
      var dtid = docToggle.getAttribute('data-target');
      var dbody = document.getElementById(dtid);
      if (!dbody) return;
      var dopen = dbody.hidden;
      dbody.hidden = !dopen;
      docToggle.textContent = dopen ? 'Ocultar' : 'Visualizar';
      if (dopen && !dbody.dataset.rendered) {
        dbody.dataset.rendered = '1';
        renderPdfIntoContainer(dbody, docToggle.getAttribute('data-blob'), docToggle.getAttribute('data-fn'));
      }
      return;
    }
    // Toggle abrir/cerrar
    var toggle = e.target.closest('.cr-btn-details-toggle');
    if (toggle) {
      var tid = toggle.getAttribute('data-target');
      var body = document.getElementById(tid);
      if (!body) return;
      var open = body.hidden;
      body.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.classList.toggle('is-open', open);
      var sp = toggle.querySelector('span');
      if (sp) sp.textContent = open ? 'Ocultar detalles' : 'Ver detalles de la consulta';
      return;
    }
    // Cerrar detalles (botón al final)
    var closer = e.target.closest('.cr-btn-details-close');
    if (closer) {
      var cid = closer.getAttribute('data-target');
      var cbody = document.getElementById(cid);
      if (!cbody) return;
      cbody.hidden = true;
      // Buscar el toggle hermano para resetear estado
      var parent = cbody.parentElement;
      if (parent) {
        var tgl = parent.querySelector('.cr-btn-details-toggle');
        if (tgl) {
          tgl.setAttribute('aria-expanded', 'false');
          tgl.classList.remove('is-open');
          var s = tgl.querySelector('span');
          if (s) s.textContent = 'Ver detalles de la consulta';
          tgl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  });
})();
