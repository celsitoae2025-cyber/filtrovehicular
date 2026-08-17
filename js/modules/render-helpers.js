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

  /* â"€â"€ Error detection â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
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

  /* â"€â"€ Text helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
  /* Quita emojis y caracteres decorativos del texto visible al usuario.

     Del bloque de flechas (U+2190–U+21FF) se salvan ← → ↔: el bot las usa
     como parte del dato, no como adorno —«VIGENCIA: 01/08/2026 → 01/08/2027»
     perdía la flecha y quedaban dos fechas pegadas sin decir nada—. Las
     decorativas de otros bloques (➾, ⌞) siguen fuera. */
  var EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2191}\u{2193}\u{2195}-\u{21FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

  function stripEmoji(s) {
    return String(s || '').replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
  }

  function escapeHtml(s) {
    return stripEmoji(String(s || '')).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /* â"€â"€ Input helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
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

  /* â"€â"€ Blob URL tracking â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
  var activeBlobUrls = [];
  var _pdfBase64Map = {};

  function base64ToBlobUrl(b64, mimeType) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'application/pdf' }));
    activeBlobUrls.push(url);
    _pdfBase64Map[url] = b64;
    return url;
  }

  /* El bot no siempre tipa el adjunto como 'pdf': lo manda como 'document'
     con mimeType application/pdf, y a veces sin mimeType pero con el .pdf
     en el nombre. Mirar sólo `tipo` dejaba el documento de SUNAT por DNI
     fuera del resultado —ni previsualización, ni visor, ni descarga—. */
  function esPdf(m) {
    // Sin los bytes no hay nada que previsualizar ni descargar, y
    // `base64ToBlobUrl` reventaría al montar el blob.
    if (!m || !m.base64) return false;
    if (m.tipo === 'photo' || /^image\//i.test(m.mimeType || '')) return false;
    return m.tipo === 'pdf' ||
           /pdf/i.test(m.mimeType || '') ||
           /\.pdf$/i.test(m.filename || '');
  }
  function pdfsDe(p) {
    return ((p && p.medios) || []).filter(esPdf);
  }

  function revokeActiveBlobUrls() {
    activeBlobUrls.forEach(function (url) {
      try { URL.revokeObjectURL(url); } catch (_) {}
    });
    activeBlobUrls = [];
  }

  /* â"€â"€ PDF fallback UI â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
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

  /* â"€â"€ PDF.js renderer â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
  /* `opts.todasLasPaginas` pinta el documento entero, una hoja debajo de
     otra y sin navegador de páginas: es lo que hace falta cuando el PDF ES
     el resultado (SUNARP entrega partidas de 7 y de 10 hojas) y no una
     miniatura de apoyo. Sin la opción, se mantiene la hoja única con
     flechas, que es lo que quiere el resto de vistas. */
  async function renderPdfIntoContainer(container, blobUrl, fileName, base64, opts) {
    var todasLasPaginas = !!(opts && opts.todasLasPaginas);
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

      // Pinta una hoja en su propio lienzo, a lo ancho del contenedor.
      async function pintarEn(num, lienzo, ancho) {
        var page = await pdf.getPage(num);
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var baseViewport = page.getViewport({ scale: 1 });
        var displayWidth = ancho || 600;
        var renderScale = (displayWidth / baseViewport.width) * dpr;
        // Cap absoluto: nunca más de ~6MP para evitar OOM en móviles low-end
        var pixels = baseViewport.width * renderScale * baseViewport.height * renderScale;
        if (pixels > 6e6) renderScale = renderScale * Math.sqrt(6e6 / pixels);
        var viewport = page.getViewport({ scale: renderScale });
        lienzo.width = viewport.width;
        lienzo.height = viewport.height;
        lienzo.style.width = displayWidth + 'px';
        lienzo.style.height = (displayWidth * baseViewport.height / baseViewport.width) + 'px';
        await page.render({ canvasContext: lienzo.getContext('2d'), viewport: viewport }).promise;
      }

      if (todasLasPaginas) {
        var ancho = container.clientWidth || 600;
        for (var n = 1; n <= total; n++) {
          var hoja = document.createElement('div');
          hoja.className = 'cr-pdf-stage';
          var lienzo = document.createElement('canvas');
          lienzo.className = 'cr-pdf-canvas';
          hoja.appendChild(lienzo);
          container.appendChild(hoja);
          await pintarEn(n, lienzo, ancho);
        }
        return total;   // lo usa el visor para rotular «N páginas»
      }

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
        await pintarEn(num, canvas, stage.clientWidth || 600);
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
      return total;
    } catch (err) {
      console.error('PDF.js render error:', err);
      container.innerHTML = pdfFallbackUI(blobUrl, dataUrl, fileName);
    }
  }

  /* â"€â"€ Record splitting â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
  function isRecordStart(cu) {
    if (!cu) return false;
    if (cu === 'DNI' || cu === 'NUMERO' || cu === 'NÃšMERO' ||
        cu.indexOf('DNI ') === 0 || cu.indexOf('DNI(') === 0) return true;
    // Campos tipo "NÂº DENUNCIA", "N° EXPEDIENTE", "NRO CASO", etc.
    if (/^N[°ÂºRO.]*\s*(DENUNCIA|EXPEDIENTE|CASO|PARTIDA|ORDEN|REGISTRO|RESOLUCI[OÃ"]N)/i.test(cu)) return true;
    return false;
  }

  function splitIntoRecords(campos) {
    var list = campos || [];
    var recs = [], cur = [];
    var vistos = Object.create(null);
    list.forEach(function (c) {
      var cu = (c.campo || '').toUpperCase().trim();
      // Corta un registro nuevo si el campo es un "arranque" conocido
      // (DNI, N° expediente/denuncia, etc.) O si este campo YA apareció
      // en el registro actual — señal de que el bot volvió a repetir el
      // mismo bloque (ej. varios TELEFONO/OPERADOR/PERIODO seguidos en
      // /telp), sin necesidad de conocer de antemano el nombre del campo.
      var esRepetido = cu && vistos[cu];
      if ((isRecordStart(cu) || esRepetido) && cur.length > 0) {
        recs.push(cur);
        cur = [];
        vistos = Object.create(null);
      }
      if (cu) vistos[cu] = true;
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

  /* â"€â"€ Data row rendering â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
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

  function cleanTitle(t) {
    if (!t) return t;
    return t
      .replace(/\s*ONLINE\s*/gi, ' ')
      .replace(/\s*NV\s*\d+\s*/gi, ' ')
      .replace(/\s*\b(PREMIUM|GOLD|EST[AÁ]NDAR|STANDARD|FREE|BASIC|B[AÁ]SICO|PRO|VIP|PLUS)\b\s*/gi, ' ')
      .replace(/\s*#\w+/g, '')
      .replace(/\s*\[.*?\]\s*/g, ' ')
      .replace(/\s*-\s*$/g, '')
      .replace(/^\s*-\s*/g, '')
      .replace(/\s*-\s*-\s*/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Consultas en las que el resumen ES la respuesta. Revisiones técnicas
     (/citv) manda arriba placa, estado, resultado, vigencia y empresa —lo
     que el cliente viene a saber— y debajo el mismo dato desmenuzado en
     certificado, dirección, servicio y observaciones, una vez por cada
     revisión del historial. Se recorta a esa primera sección.

     Va por comando y no por heurística a propósito: es una decisión sobre
     QUÉ enseña esta consulta, no sobre cómo llega la respuesta. */
  var SOLO_RESUMEN = [/^\/citv\b/i];

  /* Revisiones técnicas (/citv) llega como un resumen, el historial entero
     de certificados y la planta que hizo cada uno. Puesto tal cual sale una
     tabla de certificados vencidos que no dice si el vehículo está al día.

     Se rearma en tres bloques —el vehículo, la revisión que rige y la
     planta que la emitió—, cada campo en su fila. Nada se inventa: solo se
     escoge el certificado en vigor y se reparte lo que ya vino. */
  var CITV_GRUPOS = [
    { titulo: 'Vehículo',          campos: /^(PLACA|N[°ºO.]*\s*PLACA)$/i },
    { titulo: 'Revisión técnica',  campos: /^(ESTADO|RESULTADO|CERTIFICADO|VIGENCIA|VIG\.?\s*INICIO|VIG\.?\s*FIN|FECHA\s*DE?\s*(INICIO|FIN)|INSPECCI[OÓ]N)$/i },
    { titulo: 'Planta de revisión', campos: /^(EMPRESA|RAZ[OÓ]N\s*SOCIAL|DIRECCI[OÓ]N|SERVICIO|OBS|OBSERVACIONES)$/i },
  ];

  function estructurarCitv(p) {
    var secciones = p.secciones || [];
    if (!secciones.length) return p;

    // El certificado que rige; si están todos vencidos, el primero que vino.
    var conCertificado = secciones.filter(function (s) {
      return (s.campos || []).some(function (c) { return c.campo && /^CERTIFICADO$/i.test(c.campo.trim()); });
    });
    var enVigor = conCertificado.filter(function (s) {
      return (s.campos || []).some(function (c) {
        return c.campo && /^ESTADO$/i.test(c.campo.trim()) && /\bVIGENTE\b/i.test(c.valor || '') && !/\bNO\s*VIGENTE\b/i.test(c.valor || '');
      });
    });
    var certificado = enVigor[0] || conCertificado[0] || null;

    /* Del resto de secciones se toma todo menos los certificados que no
       rigen: sus fechas y su estado contradirían al que sí rige. */
    var aportan = secciones.filter(function (s) {
      return conCertificado.indexOf(s) === -1 || s === certificado;
    });

    var vistos = Object.create(null);
    var grupos = CITV_GRUPOS.map(function (g) { return { titulo: g.titulo, campos: [] }; });
    var sueltos = [];
    aportan.forEach(function (s) {
      (s.campos || []).forEach(function (c) {
        if (!c.campo || isEmptyValue(c.valor)) return;
        var nombre = c.campo.trim();
        if (/^INDX$/i.test(nombre)) return;            // el número de orden del historial
        var firma = nombre.toUpperCase() + '::' + c.valor;
        if (vistos[firma]) return;
        vistos[firma] = true;
        var i = CITV_GRUPOS.findIndex(function (g) { return g.campos.test(nombre); });
        (i === -1 ? sueltos : grupos[i].campos).push(c);
      });
    });
    if (sueltos.length) grupos.push({ titulo: 'Otros datos', campos: sueltos });

    var copia = {};
    Object.keys(p).forEach(function (k) { copia[k] = p[k]; });   // medios, raw, título…
    copia.secciones = grupos.filter(function (g) { return g.campos.length; });
    return copia;
  }

  function recortarAlResumen(p, comando) {
    if (!p || !comando) return p;
    var aplica = SOLO_RESUMEN.some(function (re) { return re.test(String(comando).trim()); });
    return aplica ? estructurarCitv(p) : p;
  }

  /* «APROBADO» es el veredicto de la consulta, no un dato más: se destaca
     en verde y negrita para que se lea de un vistazo. */
  var RE_APROBADO = /^\s*APROBADO\s*$/i;
  function claseValor(v) {
    return RE_APROBADO.test(v || '') ? 'cr-v cr-v-ok' : 'cr-v';
  }

  function renderDataRows(p) {
    var prettyLabel = Consultia.ConsultaRunner ? Consultia.ConsultaRunner.prettyLabel : function (s) { return s; };
    var toTitleCase = Consultia.ConsultaRunner ? Consultia.ConsultaRunner.toTitleCase : function (s) { return s; };
    var dataHtml = [];
    var camposVistos = Object.create(null);   // campo::valor ya impresos
    if (p.titulo) dataHtml.push('<div class="cr-tit">' + escapeHtml(cleanTitle(p.titulo)) + '</div>');

    /* El bot corta un mismo registro en dos bloques cuando mete una línea
       en blanco por medio. En revisiones técnicas cada certificado llega
       así: primero INDX/ESTADO/CERTIFICADO/vigencias y debajo su
       EMPRESA/DIRECCIÓN/SERVICIO/OBS. Sin unirlos, las empresas se
       agrupaban por su cuenta y se perdía de quién era cada certificado.

       Se unen solo cuando el corte es evidente: dos bloques sin ningún
       campo en común cuyo par se REPITE más adelante (o más atrás, para el
       último). Ese patrón A,B,A,B… es el de un registro partido, no el de
       dos secciones distintas, así que sirva para 1 certificado o para 100. */
    function camposDe(k) { return k ? k.split('|') : []; }
    function sinCamposComunes(a, b) {
      var ca = camposDe(a), cb = camposDe(b);
      if (!ca.length || !cb.length) return false;
      return !ca.some(function (c) { return cb.indexOf(c) !== -1; });
    }
    var secsCrudas = p.secciones || [];
    var clavesCrudas = secsCrudas.map(function (s) { return fieldSetKey(s.campos); });
    var secsUnidas = [];
    for (var si = 0; si < secsCrudas.length; si++) {
      var parteA = clavesCrudas[si], parteB = clavesCrudas[si + 1];
      var esPar = sinCamposComunes(parteA, parteB);
      var patronSeRepite = esPar && (
        (clavesCrudas[si + 2] === parteA && clavesCrudas[si + 3] === parteB) ||
        (si >= 2 && clavesCrudas[si - 2] === parteA && clavesCrudas[si - 1] === parteB)
      );
      if (patronSeRepite) {
        secsUnidas.push({
          titulo: secsCrudas[si].titulo || secsCrudas[si + 1].titulo,
          campos: (secsCrudas[si].campos || []).concat(secsCrudas[si + 1].campos || [])
        });
        si++;   // el segundo bloque ya está dentro del registro
        continue;
      }
      secsUnidas.push(secsCrudas[si]);
    }

    // Dedup secciones idénticas
    var seenSec = Object.create(null);
    var uniqSec = [];
    secsUnidas.forEach(function (s) {
      var sig = (s.campos || []).map(function (c) { return (c.campo || '_') + '::' + (c.valor || ''); }).join('Â§Â§');
      if (!sig || seenSec[sig]) return;
      seenSec[sig] = true;
      uniqSec.push(s);
    });

    var _botMeta = /^(cr[eé]ditos?|credits?|nombre|user(name)?|comando|plan|monedas?|consultado\s+por|usuario|mensaje|estado|costo|uso|info|id)\s*$/i;
    var _botValText = /^(la\s+consulta\s+se\s+hizo|consulta\s+(exitosa|realizada)|resultado\s+(exitoso|listo)|obteniendo|consultando|buscando|procesando|generando|cargando|#\w+|∞|♾)/i;
    function renderCampo(c) {
      if (c.campo && _botMeta.test(c.campo.trim())) return '';
      if (!c.campo && c.valor && _botValText.test(c.valor.trim())) return '';
      if (c.campo && isEmptyValue(c.valor)) return '';
      if (c.campo) return '<div class="cr-row"><span class="cr-k">' + escapeHtml(prettyLabel(c.campo)) + '</span><span class="' + claseValor(c.valor) + '">' + escapeHtml(c.valor) + '</span></div>';
      if (c.valor && !isEmptyValue(c.valor)) return '<div class="cr-row"><span class="cr-v">' + escapeHtml(c.valor) + '</span></div>';
      return '';
    }

    // Detecta "corridas" de secciones consecutivas que repiten exactamente
    // el mismo conjunto de campos (ej. 3 secciones de TELEFONO/OPERADOR/
    // PERIODO/EMPRESA en /telp, una por número). El bot ya las separó con
    // líneas en blanco — cada una llega como su propia sección sin título
    // — así que sin esto se apilan como bloques idénticos sin distinguir
    // dónde empieza cada registro. Se muestran como tabla, mismo estilo
    // que /nm y /ag.
    function fieldSetKey(campos) {
      return (campos || [])
        .map(function (c) { return (c.campo || '').toUpperCase().trim(); })
        .filter(Boolean).sort().join('|');
    }
    function renderSeccionesTable(secciones) {
      var mapaDe = function (s) {
        var m = Object.create(null);
        (s.campos || []).forEach(function (c) { if (c.campo) m[c.campo.toUpperCase().trim()] = c.valor; });
        return m;
      };
      var mapas = secciones.map(mapaDe);
      var cols = (secciones[0].campos || []).filter(function (c) { return c.campo; }).map(function (c) { return c.campo; });

      /* Un campo que vale lo mismo en los ocho registros no es una columna:
         es una propiedad del grupo. Repetirlo ocho veces roba ancho a lo
         que sí distingue una partida de otra (y en SUNARP eran tres
         columnas de nueve: titular, libro y estado). Sube a la cabecera. */
      var fijos = [], varian = [];
      cols.forEach(function (col) {
        var k = col.toUpperCase().trim();
        var primero = mapas[0][k];
        var igualEnTodos = mapas.every(function (m) { return (m[k] || '') === (primero || ''); });
        if (igualEnTodos && !isEmptyValue(primero) && mapas.length > 1) fijos.push({ campo: col, valor: primero });
        else varian.push(col);
      });

      var parts = [];
      if (fijos.length) {
        parts.push('<div class="cr-tbl-fijos">');
        fijos.forEach(function (f) {
          parts.push('<span class="cr-tbl-fijo"><span class="cr-tbl-fijo-k">' + escapeHtml(prettyLabel(f.campo)) +
            '</span><span class="cr-tbl-fijo-v">' + escapeHtml(f.valor) + '</span></span>');
        });
        parts.push('</div>');
      }
      parts.push('<div class="nm-table-wrap"><table class="nm-table"><thead><tr><th>Nº</th>');
      varian.forEach(function (col) { parts.push('<th>' + escapeHtml(prettyLabel(col)) + '</th>'); });
      parts.push('</tr></thead><tbody>');
      mapas.forEach(function (map, idx) {
        parts.push('<tr><td>' + (idx + 1) + '</td>');
        varian.forEach(function (col) {
          var v = map[col.toUpperCase().trim()] || '';
          var td = RE_APROBADO.test(v) ? '<td class="cr-v-ok">' : '<td>';
          parts.push(td + escapeHtml(isEmptyValue(v) ? '' : v) + '</td>');
        });
        parts.push('</tr>');
      });
      parts.push('</tbody></table></div>');
      return parts.join('');
    }
    /* De un grupo de registros con estado, solo el que rige. Una revisión
       técnica trae el historial entero —la vigente y todas las vencidas— y
       lo que el cliente viene a ver es si el vehículo está al día; las
       caducadas solo ensucian la ficha.

       Si NINGUNO está en vigor no se esconde nada: en ese caso el
       historial es justamente la respuesta (el vehículo no está al día). */
    /* Sin anclar a la cadena entera: el estado llega a veces con una coletilla
       («VENCIDO (2025)», «VIGENTE - AL DÍA») y anclado no casaba con nada, así
       que no se filtraba. «NO VIGENTE» contiene «VIGENTE», por eso lo caducado
       se comprueba SIEMPRE primero. */
    var RE_EN_VIGOR = /\b(VIGENTE|ACTIVO|ACTIVA|AL\s*D[IÍ]A)\b/i;
    var RE_CADUCADO = /\b(VENCID[OA]|CADUCAD[OA]|NO\s*VIGENTE|EXPIRAD[OA]|INACTIV[OA]|BAJA|ANULAD[OA])\b/i;
    function estadoDe(s) {
      var v = '';
      (s.campos || []).forEach(function (c) {
        if (c.campo && /^(ESTADO|SITUACI[OÓ]N)$/i.test(c.campo.trim())) v = (c.valor || '').trim();
      });
      return v;
    }
    function soloEnVigor(grupo) {
      var hayCaducado = grupo.some(function (s) { return RE_CADUCADO.test(estadoDe(s)); });
      if (!hayCaducado) return grupo;
      var enVigor = grupo.filter(function (s) {
        var e = estadoDe(s);
        return RE_EN_VIGOR.test(e) && !RE_CADUCADO.test(e);   // «NO VIGENTE» no cuenta
      });
      return enVigor.length ? enVigor : grupo;
    }

    var runKeyOf = uniqSec.map(function (s) { return fieldSetKey(s.campos); });

    /* Se agrupa por FIRMA, no por vecindad. Antes solo se juntaban las
       secciones consecutivas con los mismos campos, y el bot no las manda
       ordenadas: en SUNARP los ocho registros llegan intercalados
       —predio, vehículo, vehículo, predio…— y salían partidos en un bloque
       vertical suelto y tres tablas con la misma cabecera repetida. Cada
       firma se pinta una sola vez, en el lugar donde apareció primero. */
    var cuentaPorFirma = Object.create(null);
    runKeyOf.forEach(function (k) { if (k) cuentaPorFirma[k] = (cuentaPorFirma[k] || 0) + 1; });
    var firmaPintada = Object.create(null);

    uniqSec.forEach(function (s, idx) {
      var key = runKeyOf[idx];
      if (key && cuentaPorFirma[key] >= 2) {
        if (firmaPintada[key]) return;          // ya se pintó con su grupo
        firmaPintada[key] = true;
        var grupo = soloEnVigor(uniqSec.filter(function (_, i) { return runKeyOf[i] === key; }));
        // Si del grupo queda un solo registro, la tabla sobra: se lee mejor
        // como ficha, con cada campo en su fila.
        if (grupo.length === 1) { renderSeccionIndividual(grupo[0], idx); return; }
        dataHtml.push('<div class="cr-sect">');
        dataHtml.push(renderSeccionesTable(grupo));
        dataHtml.push('</div>');
        return;
      }
      renderSeccionIndividual(s, idx);
    });
    function renderSeccionIndividual(s, idx) {
      var isFirst = idx === 0 && (s.titulo === 'General' || s.titulo === 'Datos principales');
      var campos = s.campos || [];
      if (!campos.length) return;
      var recs = splitIntoRecords(campos);
      var marca = dataHtml.length;   // por si la sección acaba vacía

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
        /* Un solo registro: aquí sí se puede descartar lo ya dicho. El bot
           suele mandar un resumen y debajo el detalle, y la placa, el
           resultado o la empresa salían dos y tres veces en la misma ficha.
           En el camino de varios registros no se toca: ahí un valor
           repetido pertenece a otro registro y borrarlo sería perder datos. */
        recs.forEach(function (rec) {
          rec.forEach(function (c) {
            var firma = (c.campo || '') + '::' + (c.valor || '');
            if (c.campo && camposVistos[firma]) return;
            if (c.campo) camposVistos[firma] = true;
            dataHtml.push(renderCampo(c));
          });
        });
      }
      if (!isFirst) dataHtml.push('</div>');
      dataHtml.push('</div>');

      /* Sección que se quedó sin una sola fila —todo lo suyo ya estaba
         dicho, como el bloque que solo repite la placa— se retira entera:
         si no, deja un hueco y una línea divisoria de nada. */
      var pintoAlgo = dataHtml.slice(marca).some(function (h) {
        return h && h.indexOf('cr-row') !== -1;
      });
      if (!pintoAlgo) dataHtml.length = marca;
    }
    return dataHtml.join('');
  }

  /* â"€â"€ Media helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
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
    var esDniDoc = photos.length > 0 && /dni/i.test((photos[0] && photos[0].filename) || '');
    var esAnversoReverso = esDniDoc && photos.length === 2;

    if (esAnversoReverso) {
      var dniParts = [];
      dniParts.push('<div class="cr-dni-pair">');
      photos.forEach(function (m, i) {
        var src = 'data:' + (m.mimeType || 'image/jpeg') + ';base64,' + m.base64;
        dniParts.push(
          '<div class="cr-dni-card" data-full="' + src + '">' +
            '<img src="' + src + '" alt="' + (i === 0 ? 'Anverso' : 'Reverso') + '">' +
          '</div>'
        );
      });
      dniParts.push('</div>');
      return dniParts.join('') +
        '<div class="cr-layout"><div class="cr-data">' + renderDataRows(p) + '</div><div class="cr-media"></div></div>';
    }

    var mediaParts = [];
    if (photos.length) {
      /* La maqueta de esta columna vive en views.css, NO aqui.
         Estuvo escrita en el atributo `style` —ancho fijo, `display:grid`
         y `grid-template-columns:1fr`— y por eso las cuatro fotos del DNI
         salian siempre en fila india: un estilo en linea gana a cualquier
         regla de la hoja que no lleve `!important`, asi que no habia forma
         de ponerlas en cuadricula desde el CSS.

         Aqui solo se dice CUANTAS fotos hay y de que tipo son; como se
         colocan lo decide la hoja. */
      var claseCol = 'cr-bio-col' +
        (esDniDoc ? ' cr-bio-doc' : '') +
        ' cr-bio-' + (photos.length <= 4 ? photos.length : 'n');
      mediaParts.push('<div class="' + claseCol + '">');
      photos.forEach(function (m, i) {
        var src = 'data:' + (m.mimeType || 'image/jpeg') + ';base64,' + m.base64;
        mediaParts.push(
          '<div class="cr-bio-tile" data-full="' + src + '">' +
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

  // «Descargar» del PDF original del bot, en la MISMA barra que usa
  // `subirDescargaACabecera` para subir el botón junto a «Nueva consulta»
  // en la cabecera — mismo tamaño y color oscuro que ese botón, un único
  // punto de descarga por respuesta. Solo el primer PDF: la cabecera solo
  // tiene sitio para un botón (ver `subirDescargaACabecera`).
  function renderPdfDlBar(pdfs, dlLabel) {
    if (!pdfs || !pdfs.length) return '';
    var m = pdfs[0];
    var mime = m.mimeType || 'application/pdf';
    var blobUrl = base64ToBlobUrl(m.base64, mime);
    var fn = m.filename || 'documento.pdf';
    return '<div class="cr-dl-bar">' +
      '<a class="nm-download" href="' + blobUrl + '" download="' + escapeHtml(fn) + '">' +
        '<span>' + escapeHtml(dlLabel || 'Descargar') + '</span>' +
      '</a>' +
    '</div>';
  }

  // Previsualización real del PDF (primera página, mismo renderer que el
  // resto de la plataforma): sin caja, sin borde, a todo el ancho. La
  // descarga vive en la cabecera (renderPdfDlBar), no aquí.
  function renderDocumentCard(pdfs, uniqPrefix) {
    if (!pdfs || !pdfs.length) return '';
    var parts = [];
    var toRender = [];
    parts.push('<div class="cr-doccards">');
    pdfs.forEach(function (m, i) {
      var mime = m.mimeType || 'application/pdf';
      var blobUrl = base64ToBlobUrl(m.base64, mime);
      var fn = m.filename || ('documento-' + (i + 1) + '.pdf');
      var cid = (uniqPrefix || 'rh') + '-doc-' + Date.now() + '-' + i;
      // El data-blob/data-fn es lo que lee la delegación global para abrir
      // el visor a pantalla completa (el mismo de la tarjeta «Visualizar»).
      parts.push('<div class="cr-doccard-preview-wrap"><div class="cr-pdf-canvas-wrap cr-doccard-view" id="' + cid + '" ' +
        'data-blob="' + blobUrl + '" data-fn="' + escapeHtml(fn) + '" ' +
        'title="Abrir el documento a pantalla completa">' +
        '<div class="cr-pdf-loading">Cargando PDF…</div></div></div>');
      toRender.push({ cid: cid, blobUrl: blobUrl, fn: fn, base64: m.base64 });
    });
    parts.push('</div>');
    setTimeout(function () {
      toRender.forEach(function (r) {
        var el = document.getElementById(r.cid);
        if (el) renderPdfIntoContainer(el, r.blobUrl, r.fn, r.base64, { todasLasPaginas: true });
      });
    }, 0);
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

  // Renderiza una lista de botones inline enviados por el bot: la ficha
  // completa arriba y debajo una opción por registro, en rejilla de tres.
  // Incluye un área de resultado donde el PDF aparecerá sin reemplazar los botones.
  function renderButtonList(p, botones) {
    var parts = [];
    if (p && p.titulo) parts.push('<div class="cr-tit">' + escapeHtml(cleanTitle(p.titulo)) + '</div>');

    // Un registro por boton: de cada uno se saca el rotulo que despues
    // acompaña a la opcion en la lista.
    var recordDetails = [];
    (p.secciones || []).forEach(function (s) {
      var recs = splitIntoRecords(s.campos || []);
      recs.forEach(function (rec) {
        var firstF = (rec[0] && rec[0].campo) ? rec[0].campo.toUpperCase().trim() : '';
        if (isRecordStart(firstF)) {
          var tip = '', fecha = '';
          rec.forEach(function (c) {
            var cf = (c.campo || '').toUpperCase().trim();
            if (!tip && (cf.indexOf('TIPIFICACION') !== -1 || cf.indexOf('TIPIFICACIÃ"N') !== -1 ||
                cf === 'TIPO' || cf === 'DELITO' || cf.indexOf('DESCRIPCION') !== -1 ||
                cf.indexOf('DESCRIPCIÃ"N') !== -1 || cf === 'MOTIVO' || cf === 'CONCEPTO')) {
              tip = c.valor || '';
            }
            if (!fecha && (cf.indexOf('FECHA') !== -1 || cf.indexOf('F.') !== -1 || cf === 'F. REGISTRO' || cf === 'REGISTRO')) {
              fecha = c.valor || '';
            }
          });
          recordDetails.push({ tip: tip, fecha: fecha });
        }
      });
    });

    // Ãrea de resultado (full-width, arriba del grid)
    parts.push('<div class="cr-btn-result-area" hidden></div>');

    // Grid: columna izquierda (contenido) + columna derecha (ilustración)
    parts.push('<div class="cr-btn-grid">');
    parts.push('<div class="cr-btn-main">');

    /* Aqui iba un cuadro gris repitiendo «Tipo REGISTRO DE …» una vez por
       registro: la misma frase varias veces, sin decir de que partida es
       cada una, y encima duplicando lo que ya sale en la ficha. Fuera.
       `headerCampos` sigue calculandose porque separa los registros de la
       cabecera, que es lo que alimenta `recordDetails`. */

    // La ficha, a la vista. Estaba detras de un «Ver detalles de la
    // consulta» que el cliente tenia que descubrir para leer lo que habia
    // pagado.
    var hasData = (p.secciones || []).some(function (s) { return (s.campos || []).length > 0; });
    if (hasData) {
      parts.push('<div class="cr-btn-details">');
      parts.push(renderDataRows(p));
      parts.push('</div>');
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

    /* Aqui iba una silueta de documento con «Selecciona una opción para ver
       el documento»: media pantalla de adorno que ademas estrechaba la
       tabla hasta cortarla. El texto tampoco hacia falta —«Elige una
       opción:» ya lo dice, encima de los botones. */

    parts.push('</div>'); // cierra cr-btn-grid
    return '<div class="cr-btn-layout">' + parts.join('') + '</div>';
  }

  /* ============================================================
     OPCIONES DEL BOT — el mismo comportamiento en TODA la plataforma

     Cablea la lista que devuelve `renderButtonList`: al pulsar una opción
     se pide el documento al bot con un aviso a pantalla completa, y la
     respuesta se pinta en `.cr-btn-result-area`. Si viene un PDF, se abre
     en el visor a pantalla completa y queda la previsualización debajo.

     Vive AQUI y no en cada modulo a proposito: estuvo escrito dos veces
     —las once vistas de categoria y «Consulta Vehicular»— y las copias se
     separaron. La de `filter.js` se quedó sin visor, sin aviso de espera,
     con el colapsable que ya se había quitado y apuntando a una
     ilustración que ya no se dibuja.

     Lo que cambia entre vistas se recibe en `opts`:
       consulta()        la consulta activa (cada modulo lleva la suya)
       status()          el distintivo de estado del panel
       prefix            prefijo de los id de previsualización
       alNuevaConsulta() volver al formulario (botón del visor)
       alResultado()     tras pintar un PDF: sube «Descargar» a la cabecera
       alFallback(resp)  respuesta sin `.cr-btn-result-area` en pantalla
  ============================================================ */
  function wireOpcionesDelBot(container, opts) {
    opts = opts || {};
    var btns = container.querySelectorAll('.cr-btn-option');
    var resultArea = container.querySelector('.cr-btn-result-area');
    var prefix = opts.prefix || 'rh';
    var llamar = function (fn, arg) { if (typeof fn === 'function') return fn(arg); };

    btns.forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var consulta = llamar(opts.consulta);
        if (!consulta) return;
        var msgId = parseInt(btn.dataset.msgid, 10);
        var data  = btn.dataset.callback;
        if (!msgId || !data) return;

        // Sin área de resultado en pantalla, decide el módulo qué hacer.
        if (!resultArea) {
          var guardado = container.innerHTML;
          btns.forEach(function (b) { b.disabled = true; });
          btn.classList.add('is-loading');
          try {
            llamar(opts.alFallback, await Consultia.ConsultaRunner.ejecutarCallback(consulta, msgId, data));
          } catch (e) {
            console.error('Error en callback:', e);
            if (Consultia.toast) Consultia.toast({ type: 'error', title: 'No se pudo procesar', message: (e && e.message) || 'Intenta de nuevo.' });
            container.innerHTML = guardado;
            wireOpcionesDelBot(container, opts);
          }
          return;
        }

        btns.forEach(function (b) { b.disabled = true; b.classList.remove('is-selected'); });
        btn.classList.add('is-selected', 'is-loading');
        resultArea.hidden = false;
        resultArea.innerHTML = '';

        /* Pedirle el documento al proveedor puede tardar. El aviso bloquea
           la página, así el cliente no pulsa otra opción creyendo que no
           pasó nada. */
        var cerrarEspera = openDownloadOverlay({
          titulo: 'Generando el documento',
          detalle: 'Estamos pidiendo el documento al proveedor. Puede tardar unos segundos.'
        });

        var status = llamar(opts.status);
        if (status) {
          status.classList.remove('status-empty', 'status-ok');
          status.classList.add('status-loading');
          status.innerHTML = '<span class="status-dot"></span> Consultando';
        }

        try {
          var resp = await Consultia.ConsultaRunner.ejecutarCallback(consulta, msgId, data);
          cerrarEspera();
          var rp = resp.parsed || {};
          var pdfs = pdfsDe(rp);
          var hasDataR = (rp.secciones || []).some(function (s) { return (s.campos || []).length > 0; });

          if (esErrorTecnicoRespuesta(rp, resp)) {
            resultArea.innerHTML = htmlMantenimiento();
          } else if (pdfs.length > 0) {
            // La barra de descarga va delante para que el módulo la suba a
            // la cabecera; el CSS esconde la lista al detectar el visor.
            resultArea.innerHTML = renderPdfDlBar(pdfs) + renderDocumentCard(pdfs, prefix);
            llamar(opts.alResultado);
            abrirVisorDelResultado(resultArea, opts.alNuevaConsulta);
          } else if (hasDataR && esElMismoListado(container, renderDataRows(rp))) {
            /* El proveedor devolvió otra vez el listado en vez del
               documento: repintarlo dejaba la misma tabla dos veces y
               ninguna previsualización. */
            resultArea.innerHTML =
              '<div class="cr-loading"><div class="cr-loading-text">El proveedor devolvió el listado, no el documento.</div>' +
              '<div class="cr-loading-hint">Vuelve a pulsar la opción en unos segundos.</div></div>';
          } else if (hasDataR) {
            resultArea.innerHTML =
              '<div class="cr-txt-layout"><div class="cr-txt-data" style="padding:16px;">' +
                renderDataRows(rp) +
              '</div></div>';
          } else {
            var rawText = (rp.raw || '').trim().replace(/\[\s*\]/g, '').replace(/\[\s*-\s*\]/g, '').trim();
            if (rawText.length > 5 && !esErrorTecnico(rawText)) {
              resultArea.innerHTML = '<div class="cr-txt-layout"><div class="cr-txt-data" style="padding:16px;">' +
                '<div style="white-space:pre-wrap;font-family:monospace;font-size:var(--cr-fs);line-height:1.5;">' + escapeHtml(rawText) + '</div></div></div>';
            } else if (esErrorTecnico(rawText)) {
              resultArea.innerHTML = htmlMantenimiento();
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
        } catch (e) {
          cerrarEspera();
          console.error('Error en callback:', e);
          if (Consultia.toast) Consultia.toast({ type: 'error', title: 'No se pudo procesar', message: (e && e.message) || 'Intenta de nuevo.' });
          resultArea.innerHTML = '';
          resultArea.hidden = true;
          btns.forEach(function (b) { b.disabled = false; });
          btn.classList.remove('is-loading', 'is-selected');
        }
      });
    });
  }

  /* Abre el visor con el documento que se acaba de pintar en `contenedor`.
     Cuando el PDF ES el resultado —no un adjunto al lado de la ficha—, el
     cliente no tiene por qué descubrir que la previsualización se pulsa:
     el documento se enseña directamente, con «Descargar» y «Nueva
     consulta» a mano. */
  function abrirVisorDelResultado(contenedor, alNuevaConsulta) {
    if (!contenedor) return;
    var previa = contenedor.querySelector('.cr-doccard-view[data-blob]');
    if (!previa) return;
    openPdfModal(
      previa.getAttribute('data-blob'),
      previa.getAttribute('data-fn') || 'documento.pdf',
      { alNuevaConsulta: alNuevaConsulta }
    );
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

  /* ── Overlay de descarga ──────────────────────────────────────────
     Círculo animado centrado en pantalla mientras se genera/descarga
     un archivo. Algunas descargas (el TXT completo de /nm) dependen de
     que el bot arme el archivo y tardan más de un minuto, así que el
     overlay lleva un contador para que no parezca colgado.
     Devuelve una función para cerrarlo. */
  var DL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

  function openDownloadOverlay(opts) {
    opts = opts || {};
    var el = document.getElementById('dl-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dl-overlay';
      el.className = 'dl-overlay';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.innerHTML =
        '<div class="dl-ring">' + DL_ICON + '</div>' +
        '<div class="dl-title"></div>' +
        '<div class="dl-sub"></div>';
      document.body.appendChild(el);
    }
    var titleEl = el.querySelector('.dl-title');
    var subEl = el.querySelector('.dl-sub');
    var baseTitulo = opts.titulo || 'Preparando la descarga';
    titleEl.textContent = baseTitulo;
    subEl.innerHTML = opts.detalle
      ? escapeHtml(opts.detalle)
      : 'Esto puede tardar un momento. No cierres esta ventana.';
    el.hidden = false;
    document.body.classList.add('modal-open');

    // Contador en vivo: solo si se pide (descargas largas del bot).
    var tick = null;
    if (opts.contador) {
      var t0 = Date.now();
      var pintar = function () {
        var s = Math.round((Date.now() - t0) / 1000);
        titleEl.innerHTML = escapeHtml(baseTitulo) + ' <span class="dl-timer">' + s + 's</span>';
      };
      pintar();
      tick = setInterval(pintar, 1000);
    }

    var cerrado = false;
    return function cerrar() {
      if (cerrado) return;
      cerrado = true;
      if (tick) clearInterval(tick);
      var node = document.getElementById('dl-overlay');
      if (node) node.hidden = true;
      document.body.classList.remove('modal-open');
    };
  }

  /* Arma un PDF mostrando el overlay de descarga. jsPDF es sincrono y
     bloquea el hilo, asi que cedemos un frame antes de generar para que
     el overlay alcance a pintarse (si no, no se veria nada hasta el final).

     Vive aqui, y no en cada modulo, por lo mismo que el modo resultado:
     lo usan las vistas de categoria y «Consulta Vehicular». */
  function descargarPdfConOverlay(generar) {
    var cerrar = openDownloadOverlay({
      titulo: 'Generando el PDF',
      detalle: 'Estamos armando el informe con los datos de la consulta.'
    });
    setTimeout(function () {
      var res = null;
      try {
        res = generar();
      } catch (e) {
        console.error('Error generando PDF:', e);
      } finally {
        cerrar();
      }
      if (res) Consultia.ReportGenerator.download(res);
      else if (Consultia.toast) Consultia.toast({ type: 'error', title: 'No se pudo generar el PDF' });
    }, 60);
  }

  /* ── Modal flotante para ver PDF (iframe con visor nativo de Chrome) ──
     `opts.alNuevaConsulta` añade «Nueva consulta» junto a Descargar: sin
     ella, salir del documento para pedir otra cosa eran dos pasos (cerrar
     y luego buscar el botón del panel). Los disparan la delegación global,
     no quien llamó aquí, así que la referencia se guarda en el módulo. */
  var _alNuevaConsultaPdfModal = null;
  function openPdfModal(src, fileName, opts) {
    var alNuevaConsulta = (opts && typeof opts.alNuevaConsulta === 'function') ? opts.alNuevaConsulta : null;
    /* El iframe con el visor nativo solo sirve en escritorio: en un móvil
       Chrome no lo pinta, se BAJA el archivo y lo abre en el visor del
       sistema —el cliente sale de la plataforma y se queda sin «Descargar»
       ni «Nueva consulta»—. Ahí las hojas las pinta pdf.js.

       La decisión no puede colgar de la cadena de agente: basta un
       navegador que se anuncie como escritorio (pasa en tabletas y en el
       modo escritorio de Chrome) para caer en el iframe y provocar
       justamente esa descarga. Se pregunta por lo que importa —pantalla
       angosta, o puntero grueso sin hover—, que es lo que decide si el
       visor nativo va a funcionar. */
    var esMovil = !window.matchMedia ||
      window.matchMedia('(max-width: 820px), (hover: none) and (pointer: coarse)').matches;
    _alNuevaConsultaPdfModal = alNuevaConsulta;
    var el = document.getElementById('cr-pdf-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cr-pdf-modal';
      el.className = 'cr-pdf-modal';
      el.innerHTML = '<div class="cr-pdf-modal-backdrop"></div>' +
        '<div class="cr-pdf-modal-panel">' +
          '<div class="cr-pdf-modal-header">' +
            '<span class="cr-pdf-modal-name"></span>' +
            '<span class="cr-pdf-modal-pages" hidden></span>' +
            '<div class="cr-pdf-modal-actions">' +
              '<a class="cr-pdf-modal-dl" download="">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                '<span>Descargar</span>' +
              '</a>' +
              '<button type="button" class="cr-pdf-modal-nueva" hidden>Nueva consulta</button>' +
              '<button type="button" class="cr-pdf-modal-close" aria-label="Cerrar">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '<span>Cerrar</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="cr-pdf-modal-body"></div>' +
          '<div class="cr-pdf-modal-fallback">' +
            '<span>¿No se ve el documento? </span>' +
            '<a class="cr-pdf-modal-fallback-link">Ábrelo o descárgalo aquí</a>' +
          '</div>' +
        '</div>';
      document.body.appendChild(el);
    }
    var body = el.querySelector('.cr-pdf-modal-body');
    var pages = el.querySelector('.cr-pdf-modal-pages');
    body.innerHTML = '';
    pages.hidden = true;
    if (esMovil) {
      body.classList.add('es-hojas');
      var hojas = document.createElement('div');
      hojas.className = 'cr-pdf-modal-hojas';
      hojas.innerHTML = '<div class="cr-pdf-loading">Cargando documento…</div>';
      body.appendChild(hojas);
      // El base64 se guardó al crear el blob: pdf.js pinta mejor desde los
      // bytes que desde el blob URL en móvil.
      renderPdfIntoContainer(hojas, src, fileName, _pdfBase64Map[src], { todasLasPaginas: true })
        .then(function (total) {
          if (!total) return;
          pages.textContent = total === 1 ? '1 página' : total + ' páginas';
          pages.hidden = false;
        });
    } else {
      body.classList.remove('es-hojas');
      var iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.title = fileName || 'Documento PDF';
      iframe.style.cssText = 'width:100%;height:100%;border:none';
      body.appendChild(iframe);
    }
    var dlBtn = el.querySelector('.cr-pdf-modal-dl');
    dlBtn.href = src;
    dlBtn.download = fileName || 'documento.pdf';
    el.querySelector('.cr-pdf-modal-name').textContent = fileName || 'Documento PDF';
    var fallbackLink = el.querySelector('.cr-pdf-modal-fallback-link');
    fallbackLink.href = src;
    fallbackLink.download = fileName || 'documento.pdf';
    // El modal se reutiliza entre consultas: hay que reponer el estado del
    // botón en cada apertura, no solo al crearlo.
    el.querySelector('.cr-pdf-modal-nueva').hidden = !alNuevaConsulta;
    el.hidden = false;
    document.body.classList.add('cr-lightbox-open');
  }

  function closePdfModal() {
    var el = document.getElementById('cr-pdf-modal');
    if (!el) return;
    el.hidden = true;
    el.querySelector('.cr-pdf-modal-body').innerHTML = '';
    document.body.classList.remove('cr-lightbox-open');
    _alNuevaConsultaPdfModal = null;
  }

  /* ── Búsqueda por nombre (/nm): tarjetas de persona ── */
  var NM_FIELDS = ['Nº Dni', 'N° Dni', 'Prenombres', 'Apellido Paterno', 'Apellido Materno', 'Edad', 'Género', 'Genero', 'Dpto', 'Provincia', 'Distrito'];
  var NM_FIELD_RE = new RegExp('(' + NM_FIELDS.map(function (f) { return f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\s+', 'gi');

  // Normaliza un nombre de campo: sin tildes, sin símbolos, en mayúsculas.
  // "Nº Dni" / "N° DNI" / "nro. dni" → "NDNI"; "Género" / "SEXO" → "GENERO" / "SEXO"
  function nmNorm(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  // Orden posicional de respaldo (solo si los valores llegan sin nombre de campo)
  var NM_SLOTS = [
    { key: 'dni',    re: /DNI|DOCUMENTO/ },
    { key: 'nombre', re: /^(PRENOMBRES?|NOMBRES?|NOMBRESCOMPLETOS?)$/ },
    { key: 'apPat',  re: /PATERNO/ },
    { key: 'apMat',  re: /MATERNO/ },
    { key: 'edad',   re: /^EDAD$/ },
    { key: 'sexo',   re: /GENERO|SEXO/ },
    { key: 'dpto',   re: /^(DPTO|DEPARTAMENTO|DEPTO|REGION)$/ },
    { key: 'prov',   re: /PROVINCIA/ },
    { key: 'dist',   re: /DISTRITO/ }
  ];

  // Metadata del bot / del usuario que consulta — nunca son datos de la persona.
  var NM_SKIP_RE = /^(TOTALRESULTADOS|RESULTADOS|PAGINASTOTALES|PAGINAS|PAGINA|MENSAJE|CONSULTA|CONSULTADOPOR|COMANDO|USUARIO|USER|USERNAME|CREDITOS|CREDITS|MONEDAS|ID|PLAN|NOMBRE|ESTADO|COSTO|FUENTE)$/;

  // Línea de la respuesta que no aporta datos (branding, separadores, cabeceras)
  function nmIsRuido(linea) {
    var t = String(linea || '').trim();
    if (!t) return true;
    if (/^[\s\-─━=_·.•▫◆*|]+$/.test(t)) return true;          // separadores
    if (/^\[?#[A-Z_]+/i.test(t)) return true;                  // [#LAIN_DATA] ➤ #NOMBRES
    if (/B[UÚ]SQUEDAS?\s+PERSONAS/i.test(t)) return true;      // cabecera
    if (/^P[aá]ginas?\s+totales/i.test(t)) return true;
    if (/^CONSULTADO\s+POR/i.test(t)) return true;
    if (/^MENSAJE\s*:/i.test(t)) return true;
    return false;
  }

  function nmSplitApellidos(s) {
    var t = String(s || '').trim().replace(/\s+/g, ' ');
    if (!t) return ['', ''];
    var parts = t.split(' ');
    if (parts.length === 1) return [parts[0], ''];
    return [parts[0], parts.slice(1).join(' ')];
  }

  // "PIURA - MORROPON - MORROPON" → [dpto, provincia, distrito]
  function nmSplitUbigeo(s) {
    var t = String(s || '').trim();
    if (!t) return ['', '', ''];
    var parts = t.split(/\s+-\s+/).map(function (x) {
      x = x.trim();
      return /^-*$/.test(x) ? '' : x;
    });
    if (parts.length > 3) parts = parts.slice(parts.length - 3);
    while (parts.length < 3) parts.unshift('');
    return parts;
  }

  function nmField(per, re) {
    var keys = Object.keys((per && per.f) || {});
    for (var i = 0; i < keys.length; i++) {
      if (re.test(keys[i])) return String(per.f[keys[i]] || '').trim();
    }
    return '';
  }

  // Convierte una persona cruda en el registro de 9 columnas de la tabla.
  // Acepta tanto campos separados (Apellido Paterno / Dpto) como los
  // combinados que manda el bot real (APELLIDOS / UBIGEO).
  function nmRecord(per, idx) {
    var dni     = nmField(per, /DNI|DOCUMENTO/);
    var nombres = nmField(per, /^(PRENOMBRES?|NOMBRES)$/);
    var apPat   = nmField(per, /PATERNO/);
    var apMat   = nmField(per, /MATERNO/);
    if (!apPat && !apMat) {
      var ap = nmField(per, /^APELLIDOS?$/);
      if (ap) { var sp = nmSplitApellidos(ap); apPat = sp[0]; apMat = sp[1]; }
    }
    var edad = nmField(per, /^EDAD$/);
    var sexo = nmField(per, /GENERO|SEXO/);
    var dpto = nmField(per, /^(DPTO|DEPARTAMENTO|DEPTO|REGION)$/);
    var prov = nmField(per, /PROVINCIA/);
    var dist = nmField(per, /DISTRITO/);
    if (!dpto && !prov && !dist) {
      var ub = nmField(per, /UBIGEO|UBICACION|DOMICILIO/);
      if (ub) { var u3 = nmSplitUbigeo(ub); dpto = u3[0]; prov = u3[1]; dist = u3[2]; }
    }

    var rec = {
      persona: (per && per.persona) || String(idx + 1),
      dni: dni, nombres: nombres, apPat: apPat, apMat: apMat,
      edad: edad, sexo: sexo, dpto: dpto, prov: prov, dist: dist
    };

    // Respaldo posicional: valores sin nombre de campo, alineados desde el DNI
    if (!dni && !nombres && per && per.loose && per.loose.length) {
      var l = per.loose.slice();
      for (var j = 0; j < l.length && j < 3; j++) {
        if (/^\d{7,9}$/.test(String(l[j]).trim())) { l = l.slice(j); break; }
      }
      var order = ['dni', 'nombres', 'apPat', 'apMat', 'edad', 'sexo', 'dpto', 'prov', 'dist'];
      order.forEach(function (k, i) { if (!rec[k]) rec[k] = l[i] || ''; });
    }
    return rec;
  }

  function nmNewPersona() { return { f: {}, loose: [] }; }

  function nmAddCampo(per, campo, valor) {
    if (!per) return;
    var key = nmNorm(campo);
    if (!key) {
      // Valor suelto: puede seguir siendo "CAMPO: valor" si el bridge no
      // reconoció el separador (p.ej. "➤ TOTAL RESULTADOS: 17").
      var fm = String(valor || '').match(/^(.{2,40}?)\s*(?::{1,2}|→|➾|➤|►|»)\s*(.*)$/);
      if (fm) {
        var k2 = nmNorm(fm[1]);
        if (k2 && !NM_SKIP_RE.test(k2)) per.f[k2] = fm[2].trim();
        return;
      }
      if (valor) per.loose.push(valor);
      return;
    }
    if (NM_SKIP_RE.test(key)) return;
    per.f[key] = valor;
  }

  // ¿Este campo marca el inicio de una persona nueva? (el DNI se repite por persona)
  function nmIsRepeatedDni(per, campo) {
    if (!per) return false;
    var key = nmNorm(campo);
    return /DNI|DOCUMENTO/.test(key) && per.f[key] !== undefined;
  }

  function nmHasData(per) {
    return per && (Object.keys(per.f).length > 0 || per.loose.length > 0);
  }

  function parseNmFromSecciones(secciones) {
    var personas = [];
    var current = null;
    var push = function () { if (nmHasData(current)) personas.push(current); };

    (secciones || []).forEach(function (s) {
      if (/PERSONA\s*\d+/i.test((s.titulo || '').trim())) {
        push();
        current = nmNewPersona();
      }
      (s.campos || []).forEach(function (c) {
        var val = (c.valor || '').trim();
        var campo = (c.campo || '').trim();
        // Marcador de persona: "PERSONA: 1" (campo) o "Persona 1" (línea suelta)
        if (nmNorm(campo) === 'PERSONA') {
          push();
          current = nmNewPersona();
          current.persona = val;
          return;
        }
        if (!campo && /^PERSONA\s*:?\s*\d+$/i.test(val)) {
          push();
          current = nmNewPersona();
          current.persona = (val.match(/\d+/) || [''])[0];
          return;
        }
        if (!campo && (!val || nmIsRuido(val))) return;
        if (campo && NM_SKIP_RE.test(nmNorm(campo))) return;
        if (!current) current = nmNewPersona();
        if (nmIsRepeatedDni(current, campo)) {
          push();
          current = nmNewPersona();
        }
        nmAddCampo(current, campo, val);
      });
    });
    push();
    return personas;
  }

  function parseNmFromRaw(rawText) {
    var text = String(rawText || '')
      .replace(/Total\s+Resultados\s*[:→➾]?\s*\d+/i, '')
      .replace(/Mensaje\s*[:→➾]?\s*La consulta se hizo.*$/i, '')
      .trim();
    if (!text) return [];

    var personas = [];
    var current = null;
    var push = function () { if (nmHasData(current)) personas.push(current); };
    var lines = text.split(/\r?\n/);

    if (lines.length > 1) {
      lines.forEach(function (line) {
        // Quita prefijos decorativos del bot: "  ⌞ ", "➤ ", "[ ☑️ ] ", viñetas
        var t = String(line)
          .replace(/^[\s⌞⌜⌝⌟┌┐└┘├┤│▫•·►➤➾→]+/, '')
          .replace(/^\[[^\]]{0,6}\]\s*/, '')
          .trim();
        if (!t || nmIsRuido(t)) return;

        var fm = t.match(/^(.{2,40}?)\s*(?::{1,2}|→|➾|➤|►|»)\s*(.*)$/);
        var campo = fm ? fm[1].trim() : '';
        var val = fm ? fm[2].trim() : '';

        // Marcador de persona: "PERSONA: 1" o "Persona 1"
        if ((campo && nmNorm(campo) === 'PERSONA') || (!fm && /^PERSONA\s*\d+$/i.test(t))) {
          push();
          current = nmNewPersona();
          current.persona = fm ? val : (t.match(/\d+/) || [''])[0];
          return;
        }
        if (!current) current = nmNewPersona();
        if (fm) {
          if (NM_SKIP_RE.test(nmNorm(campo))) return;
          if (nmIsRepeatedDni(current, campo)) {
            push();
            current = nmNewPersona();
          }
          nmAddCampo(current, campo, val);
        } else {
          current.loose.push(t);
        }
      });
      push();
      if (personas.length > 0) return personas;
      current = null;
    }

    // Último recurso: texto continuo "Persona 1  Nº Dni 123  Prenombres ..."
    var chunks = text.split(/Persona\s+\d+/i).filter(function (c) { return c.trim(); });
    return chunks.map(function (chunk) {
      var per = nmNewPersona();
      var remaining = chunk.trim();
      var matches = [];
      var m;
      var re = new RegExp('(' + NM_FIELDS.map(function (f) { return f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\s+', 'gi');
      while ((m = re.exec(remaining)) !== null) {
        matches.push({ field: m[1], index: m.index, endIndex: re.lastIndex });
      }
      for (var i = 0; i < matches.length; i++) {
        var start = matches[i].endIndex;
        var end = (i + 1 < matches.length) ? matches[i + 1].index : remaining.length;
        nmAddCampo(per, matches[i].field, remaining.substring(start, end).trim());
      }
      return per;
    }).filter(nmHasData);
  }

  // Extrae los registros de una respuesta del bot (secciones o texto crudo).
  function nmRegistros(p) {
    var personas = parseNmFromSecciones(p && p.secciones);
    if (!personas.length) {
      var rawText = ((p && p.raw) || '').trim();
      if (!rawText && p && p.secciones) {
        p.secciones.forEach(function (s) {
          (s.campos || []).forEach(function (c) {
            rawText += (c.campo ? c.campo + ': ' : '') + (c.valor || '') + '\n';
          });
        });
      }
      personas = parseNmFromRaw(rawText);
    }
    return personas.map(nmRecord).filter(nmRegistroValido);
  }

  // Una fila sin DNI ni nombres es basura de cabecera, no una persona.
  function nmRegistroValido(r) {
    return !!(r && ((r.dni && /\d/.test(r.dni)) || r.nombres));
  }

  // Parsea el TXT completo que devuelve el bot al pulsar "Descargar".
  function parseNmTexto(texto) {
    return parseNmFromRaw(String(texto || '')).map(nmRecord).filter(nmRegistroValido);
  }

  function nmTotalResultados(p, fallback) {
    var total = '';
    ((p && p.secciones) || []).forEach(function (s) {
      (s.campos || []).forEach(function (c) {
        if (total) return;
        if (nmNorm(c.campo) === 'TOTALRESULTADOS') {
          total = (c.valor || '').trim();
          return;
        }
        // También puede venir sin separador reconocido: "TOTAL RESULTADOS: 17"
        if (!c.campo) {
          var lm = String(c.valor || '').match(/TOTAL\s+RESULTADOS\s*[:→➾]?\s*(\d+)/i);
          if (lm) total = lm[1];
        }
      });
    });
    if (!total) {
      var tm = String((p && p.raw) || '').match(/TOTAL\s+RESULTADOS\s*[:→➾]?\s*(\d+)/i);
      total = tm ? tm[1] : String(fallback);
    }
    return total;
  }

  var NM_COLS = ['dni', 'nombres', 'apPat', 'apMat', 'edad', 'sexo', 'dpto', 'prov', 'dist'];

  // Tabla de resultados. `regs` son registros ya normalizados (nmRecord).
  function renderNmTabla(regs, opts) {
    opts = opts || {};
    if (!regs || !regs.length) return '';
    var queryLabel = (opts.valor || '').replace(/\|/g, ' ').replace(/[+,]/g, ' ').trim().toUpperCase() || 'NOMBRE';
    var total = opts.total || String(regs.length);

    var parts = [];
    parts.push('<div class="nm-results">');
    if (opts.pie) parts.push(opts.pie);
    parts.push('<div class="nm-header">DATOS DEL TITULAR</div>');
    parts.push('<div class="nm-query-bar">BÚSQUEDAS PERSONAS – ' + escapeHtml(queryLabel) + ' –</div>');
    parts.push('<div class="nm-meta"><span>TOTAL RESULTADOS</span><span>' + escapeHtml(total) + '</span></div>');
    parts.push('<div class="nm-meta"><span class="nm-meta-bold">REGISTROS</span><span class="nm-meta-italic">' + regs.length + ' resultados</span></div>');

    parts.push('<div class="nm-table-wrap">');
    parts.push('<table class="nm-table">');
    parts.push('<thead><tr>');
    parts.push('<th>Nº</th><th>Nº DNI</th><th>NOMBRES</th><th>AP. PATERNO</th><th>AP. MATERNO</th><th>EDAD</th><th>SEXO</th><th>DPTO</th><th>PROVINCIA</th><th>DISTRITO</th>');
    parts.push('</tr></thead>');
    parts.push('<tbody>');
    regs.forEach(function (r, idx) {
      parts.push('<tr>');
      parts.push('<td>' + (idx + 1) + '</td>');
      NM_COLS.forEach(function (k) {
        parts.push('<td>' + escapeHtml(r[k] || '') + '</td>');
      });
      parts.push('</tr>');
    });
    parts.push('</tbody></table>');
    parts.push('</div>');
    parts.push('</div>');
    return parts.join('');
  }

  // Botón que pide al bot el TXT con TODOS los resultados (la vista inicial viene paginada)
  function nmBotonDescargar(botones) {
    var dl = (botones || []).filter(function (b) { return /descargar/i.test(b.text); });
    if (!dl.length) return '';
    var b = dl[0];
    return '<div class="cr-dl-bar cr-dl-bar-tabla">' +
      '<button type="button" class="nm-download cr-btn-nm-txt" ' +
        'data-msgid="' + escapeHtml(String(b.msgId)) + '" ' +
        'data-callback="' + escapeHtml(b.data) + '">' +
        'Descargar' +
      '</button>' +
    '</div>';
  }

  // Botón que arma el PDF con los registros ya cargados en pantalla
  function nmBotonPdf() {
    return '<div class="cr-dl-bar cr-dl-bar-tabla">' +
      '<button type="button" class="nm-download cr-btn-nm-pdf">Descargar</button>' +
    '</div>';
  }

  // Botón "Descargar" genérico, para cualquier vista de resultado que
  // todavía no tenga uno propio (facial, tabla, datos con/sin foto). Va
  // dentro de .cr-dl-bar para que respete el mismo margen lateral que el
  // contenido de abajo y no quede pegado al borde del panel.
  function renderPdfTopButton() {
    return '<div class="cr-dl-bar">' +
      '<button type="button" class="nm-download cr-btn-pdf-generic">Descargar</button>' +
    '</div>';
  }

  function renderNmPersonas(p, botones, valorConsultado) {
    var regs = nmRegistros(p);
    if (!regs.length) return '';
    return renderNmTabla(regs, {
      valor: valorConsultado,
      total: nmTotalResultados(p, regs.length),
      pie: nmBotonDescargar(botones)
    });
  }

  /* ── Árbol genealógico (/ag): el bot manda varios mensajes de Telegram
     que el bridge concatena en un solo texto. Cada persona trae DNI y Edad
     en la MISMA línea ("DNI ➾ 123 Edad ➾ 45"), separada de la siguiente
     por línea en blanco; entre bloques se cuela el aviso de "ESTADO DE
     CUENTA" y el encabezado del bot repetido en cada mensaje — hay que
     descartar ambos antes de separar por personas. ── */
  var ARBOL_SEP_RE = '(?::{1,2}|→|➾|➤|►|»)';

  function parseArbolGenealogico(rawText) {
    var text = String(rawText || '');
    // Quita el bloque "[⚡] ESTADO DE CUENTA … USUARIO ➾ …" que el bot
    // intercala entre mensajes.
    text = text.replace(/\[?⚡\]?\s*ESTADO\s+DE\s+CUENTA[\s\S]*?USUARIO[^\n]*\n?/gi, '\n');
    // Quita las líneas de encabezado/branding del bot (se repiten por mensaje).
    text = text.split(/\r?\n/).filter(function (line) {
      var t = line.trim();
      if (!t) return true;
      if (/ARBOL\s+GENEALOGICO/i.test(t)) return false;
      if (/^\[?#[A-Z_]+\]?/i.test(t)) return false;
      return true;
    }).join('\n');

    var bloques = text.split(/\n\s*\n/);
    var campo = function (etiqueta, str) {
      var re = new RegExp('(?:' + etiqueta + ')\\s*' + ARBOL_SEP_RE + '\\s*([^\\n]+)', 'i');
      var m = str.match(re);
      return m ? m[1].trim() : '';
    };

    var regs = [];
    bloques.forEach(function (bloque) {
      var b = bloque.trim();
      if (!b) return;
      var dniLinea = b.match(/DNI\s*(?::{1,2}|→|➾|➤|►|»)\s*(\d{7,9})/i);
      if (!dniLinea) return;
      regs.push({
        dni: dniLinea[1],
        edad: campo('EDAD', b),
        nombres: campo('NOMBRES', b),
        apellidos: campo('APELLIDOS', b),
        sexo: campo('SEXO|GENERO', b),
        relacion: campo('RELACION', b),
        verificacion: campo('VERIFICACION', b)
      });
    });
    return regs;
  }

  function renderArbolGenealogico(p, valorConsultado) {
    var regs = parseArbolGenealogico((p && p.raw) || '');
    if (!regs.length) return '';

    var parts = [];
    parts.push('<div class="nm-results">');
    parts.push('<div class="cr-dl-bar cr-dl-bar-tabla">' +
      '<button type="button" class="nm-download cr-btn-arbol-pdf">Descargar</button>' +
    '</div>');
    parts.push('<div class="nm-header">ÁRBOL GENEALÓGICO</div>');
    parts.push('<div class="nm-query-bar">FAMILIARES – ' + escapeHtml((valorConsultado || '').toUpperCase()) + ' –</div>');
    parts.push('<div class="nm-meta"><span class="nm-meta-bold">REGISTROS</span><span class="nm-meta-italic">' + regs.length + ' resultados</span></div>');

    parts.push('<div class="nm-table-wrap">');
    parts.push('<table class="nm-table">');
    parts.push('<thead><tr>');
    parts.push('<th>Nº</th><th>Nº DNI</th><th>NOMBRES</th><th>APELLIDOS</th><th>EDAD</th><th>SEXO</th><th>RELACIÓN</th><th>VERIFICACIÓN</th>');
    parts.push('</tr></thead>');
    parts.push('<tbody>');
    regs.forEach(function (r, idx) {
      parts.push('<tr>');
      parts.push('<td>' + (idx + 1) + '</td>');
      ['dni', 'nombres', 'apellidos', 'edad', 'sexo', 'relacion', 'verificacion'].forEach(function (k) {
        parts.push('<td>' + escapeHtml(r[k] || '') + '</td>');
      });
      parts.push('</tr>');
    });
    parts.push('</tbody></table>');
    parts.push('</div>');
    parts.push('</div>');
    return parts.join('');
  }

  /* â"€â"€ Public API â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
  /* ============================================================
     MODO RESULTADO — el mismo en TODA la plataforma

     Con la ficha delante: se esconden el selector de consulta y el
     formulario del dato, el boton «Descargar» sube a la cabecera junto
     a «Nueva consulta», el distintivo de estado desaparece y la pagina
     se va arriba del todo.

     Vive AQUI y no en cada modulo a proposito. Lo usan las once vistas
     de categoria (a traves de category-view.js) y «Consulta Vehicular»
     (filter.js), que no sale de esa fabrica. Estuvo escrito dos veces y
     era cuestion de tiempo que se separaran; con una sola copia,
     cualquier retoque llega a todas las vistas de golpe.

     Lo unico que cambia entre vistas es QUE hacer al pulsar «Nueva
     consulta», y por eso se recibe como parametro.
  ============================================================ */
  function entrarModoResultado(vista, alVolver) {
    if (!vista) return;
    vista.classList.add('tiene-resultado');
    ponerBotonVolver(vista, alVolver);
    subirDescargaACabecera(vista);
    irArriba(vista);
  }

  /* Al volver al formulario hay que RETIRAR el boton de descarga, no solo
     apagar la clase: vive en la cabecera, fuera del cuerpo que se vacia, y
     se quedaba ahi ofreciendo el PDF de la consulta anterior sobre un panel
     que ya dice «Realice una consulta». «Nueva consulta» sí lo esconde el
     CSS con `.tiene-resultado`, este no. */
  function salirModoResultado(vista) {
    if (!vista) return;
    vista.classList.remove('tiene-resultado');
    var dl = vista.querySelector('.result-panel .result-header .cr-dl-cabecera');
    if (dl) dl.remove();
  }

  /* La salida. Sin ella, escondidos el selector y el formulario, el
     cliente se queda mirando la ficha sin forma de pedir otra. */
  function ponerBotonVolver(vista, alVolver) {
    var cab = vista.querySelector('.result-panel .result-header');
    if (!cab || cab.querySelector('.cr-nueva')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cr-nueva';
    btn.textContent = 'Nueva consulta';
    btn.addEventListener('click', function () {
      salirModoResultado(vista);
      if (typeof alVolver === 'function') alVolver();
    });
    cab.appendChild(btn);
  }

  /* «Descargar» nace dentro del cuerpo del resultado, flotando sobre las
     fotos y empujandolas hacia abajo. Se muda a la cabecera, que es
     donde se buscan las acciones.

     Se mueve el NODO, no se vuelve a crear, para que conserve el
     listener que ya le engancharon. Por eso esto tiene que correr
     DESPUES del cableado del boton, nunca antes. */
  function subirDescargaACabecera(vista) {
    var cab = vista.querySelector('.result-panel .result-header');
    if (!cab) return;
    // El boton de la consulta anterior ya vive en la cabecera (se mudo aqui
    // en la llamada pasada), fuera del `body.innerHTML` que acaba de
    // reemplazarse: sin quitarlo, cada consulta nueva apilaba uno mas.
    var viejo = cab.querySelector('.cr-dl-cabecera');
    if (viejo) viejo.remove();
    var barra = vista.querySelector('.result-panel .cr-dl-bar');
    if (!barra) return;
    var btn = barra.querySelector('.nm-download');
    if (!btn) { barra.remove(); return; }
    btn.classList.add('cr-dl-cabecera');
    cab.insertBefore(btn, cab.querySelector('.cr-nueva'));  // antes de la salida
    barra.remove();
  }

  /* Con el selector y el formulario escondidos el resultado queda arriba
     del todo, pero la pagina sigue donde la dejo el cliente al pulsar
     «Consultar» —en el movil, bastante mas abajo— y la ficha aparecia
     fuera de la vista: parecia que no habia pasado nada.

     Se repite pasados 120ms porque la primera corre antes de que las
     fotos ocupen su sitio: al crecer el bloque el navegador reajusta el
     desplazamiento y la ficha se queda a medias. */
  function irArriba(vista) {
    var scroller = vista.closest('.main') || document.querySelector('.main');
    if (!scroller) return;
    function arriba() {
      try { scroller.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (e) { scroller.scrollTop = 0; }   // navegadores sin scrollTo con opciones
    }
    arriba();
    setTimeout(function () {
      if (vista.isConnected && !vista.hidden) arriba();
    }, 120);
  }

  Consultia.RenderHelpers = {
    entrarModoResultado:     entrarModoResultado,
    salirModoResultado:      salirModoResultado,
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
    recortarAlResumen:       recortarAlResumen,
    pdfsDe:                  pdfsDe,
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
    renderPdfDlBar:          renderPdfDlBar,
    openPdfModal:            openPdfModal,
    wireOpcionesDelBot:      wireOpcionesDelBot,
    abrirVisorDelResultado:  abrirVisorDelResultado,
    columnaValor:            columnaValor,
    renderNmPersonas:        renderNmPersonas,
    renderNmTabla:           renderNmTabla,
    parseNmTexto:            parseNmTexto,
    nmRegistros:             nmRegistros,
    nmBotonPdf:              nmBotonPdf,
    renderPdfTopButton:      renderPdfTopButton,
    openDownloadOverlay:     openDownloadOverlay,
    descargarPdfConOverlay:  descargarPdfConOverlay,
    parseArbolGenealogico:   parseArbolGenealogico,
    renderArbolGenealogico:  renderArbolGenealogico,
  };

  // Compat: category-view.js lo expone en Consultia.renderPdfIntoContainer
  Consultia.renderPdfIntoContainer = renderPdfIntoContainer;

  /* â"€â"€ Delegación global: toggles "Ver detalles" / "Cerrar detalles" â"€â"€ */
  document.addEventListener('click', function (e) {
    // Lightbox: candidatos faciales y fotos biométricas
    var photo = e.target.closest('.cr-facial-hero-photo[data-full], .cr-facial-card-photo[data-full], .cr-bio-tile[data-full], .cr-dni-card[data-full]');
    if (photo) { openLightbox(photo.getAttribute('data-full')); return; }
    if (e.target.closest('.cr-lightbox-close') || e.target.closest('.cr-lightbox-backdrop')) {
      closeLightbox();
      return;
    }
    // Tarjeta de documento: "Visualizar" abre el PDF completo en un modal
    // flotante (visor nativo del navegador vía iframe).
    var docToggle = e.target.closest('.cr-doccard-view');
    if (docToggle) {
      openPdfModal(docToggle.getAttribute('data-blob'), docToggle.getAttribute('data-fn'));
      return;
    }
    // «Nueva consulta» desde el visor: cerrar y devolver el control a la
    // vista, sin pasar por el botón del panel. Se lee ANTES de cerrar,
    // porque `closePdfModal` suelta la referencia.
    if (e.target.closest('.cr-pdf-modal-nueva')) {
      var alNueva = _alNuevaConsultaPdfModal;
      closePdfModal();
      if (alNueva) alNueva();
      return;
    }
    if (e.target.closest('.cr-pdf-modal-close') || e.target.closest('.cr-pdf-modal-backdrop')) {
      closePdfModal();
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
