/* ============================================================
   METAPLA REPORT — Reporte Vehicular Integral rediseñado.

   Toma el PDF crudo que devuelve el bot, extrae TODO su contenido
   (texto posicional + todas las imágenes incrustadas) y construye
   un PDF completamente nuevo con el diseño institucional FV+.

   No es un reencuadre: el documento se arma desde cero — portada
   con ficha del vehículo e índice de riesgo, secciones numeradas
   con tablas limpias, e imágenes reubicadas a tamaño real en la
   sección a la que pertenecen.

   Pipeline:
     1. extractFromPdf()  — pdf.js: líneas de texto + imágenes/CTM
     2. parseSections()   — agrupa en secciones (I…XI) y filas KV
     3. buildPdf()        — jsPDF + autoTable con el diseño FV+

   Colores institucionales:
     Primario #141d1c · Acento #8fc72e

   Expone:
     Consultia.MetaplaReport.generate(pdfBase64, meta)
       → Promise<{ blobUrl, base64, filename }>
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};

  // ── Paleta institucional ───────────────────────────────────
  var C_PRIMARY = [20, 29, 28];    // #141d1c
  var C_ACCENT  = [143, 199, 46];  // #8fc72e
  var C_WHITE   = [255, 255, 255];
  var C_SUBHEAD = [200, 215, 212];
  var C_TEXT    = [31, 42, 40];
  var C_KEY     = [110, 116, 115];
  var C_ZEBRA   = [246, 248, 245];

  var ROMANS = ['I','II','III','IV','V','VI','VII','VIII','IX','X',
                'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];

  /* ══════════════════════════════════════════════════════════
     1. EXTRACCIÓN — texto posicional + imágenes del PDF origen
     ══════════════════════════════════════════════════════════ */

  function base64ToUint8(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Multiplicación de matrices 2D del PDF: [a,b,c,d,e,f]
  function matMul(m1, m2) {
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  }

  // Convierte el objeto de imagen de pdf.js a dataURL vía canvas.
  function imgObjToDataUrl(img) {
    if (!img) return null;
    var w = img.width, h = img.height;
    if (!w || !h) return null;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // pdf.js moderno puede entregar directamente un ImageBitmap
    if (img.bitmap) {
      try {
        ctx.drawImage(img.bitmap, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.92);
      } catch (e) { return null; }
    }
    if (!img.data) return null;

    var imgData = ctx.createImageData(w, h);
    var dst = imgData.data;
    var src = img.data;
    var kind = img.kind;

    if (kind === 3 || src.length === w * h * 4) {
      // RGBA_32BPP
      dst.set(src.subarray(0, w * h * 4));
    } else if (kind === 2 || src.length === w * h * 3) {
      // RGB_24BPP
      for (var i = 0, j = 0; i < w * h; i++) {
        dst[j++] = src[i * 3];
        dst[j++] = src[i * 3 + 1];
        dst[j++] = src[i * 3 + 2];
        dst[j++] = 255;
      }
    } else if (kind === 1) {
      // GRAYSCALE_1BPP (empaquetado, 1 bit por píxel)
      var rowBytes = (w + 7) >> 3;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var byte = src[y * rowBytes + (x >> 3)];
          var bit = (byte >> (7 - (x & 7))) & 1;
          var v = bit ? 255 : 0;
          var o = (y * w + x) * 4;
          dst[o] = dst[o + 1] = dst[o + 2] = v;
          dst[o + 3] = 255;
        }
      }
    } else {
      return null;
    }
    ctx.putImageData(imgData, 0, 0);
    try { return canvas.toDataURL('image/jpeg', 0.92); } catch (e) { return null; }
  }

  // Recupera un objeto de pdf.js que puede aún no estar resuelto.
  function getObjAsync(page, name) {
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (v) { if (!done) { done = true; resolve(v || null); } };
      try {
        if (page.objs.has && page.objs.has(name)) { finish(page.objs.get(name)); return; }
        page.objs.get(name, finish);
      } catch (e) { finish(null); }
      setTimeout(function () { finish(null); }, 3000);
    });
  }

  async function extractPageImages(page, viewport) {
    var out = [];
    var OPS = window.pdfjsLib.OPS;
    var opList;
    try { opList = await page.getOperatorList(); } catch (e) { return out; }

    var ctm = [1, 0, 0, 1, 0, 0];
    var stack = [];
    var fns = opList.fnArray, args = opList.argsArray;

    for (var i = 0; i < fns.length; i++) {
      var fn = fns[i];
      if (fn === OPS.save) {
        stack.push(ctm.slice());
      } else if (fn === OPS.restore) {
        if (stack.length) ctm = stack.pop();
      } else if (fn === OPS.transform) {
        ctm = matMul(ctm, args[i]);
      } else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
        var name = args[i][0];
        var obj = await getObjAsync(page, name);
        var dataUrl = imgObjToDataUrl(obj);
        if (!dataUrl) continue;
        // La imagen ocupa el cuadrado unitario transformado por la CTM.
        var rw = Math.hypot(ctm[0], ctm[1]);
        var rh = Math.hypot(ctm[2], ctm[3]);
        out.push({
          dataUrl: dataUrl,
          px: obj.width, py: obj.height,
          w: rw, h: rh,
          x: ctm[4],
          // convertir a "top" (origen arriba) para ordenar visualmente
          top: viewport.height - (ctm[5] + rh)
        });
      }
    }
    // Orden visual: de arriba a abajo, de izquierda a derecha
    out.sort(function (a, b) {
      if (Math.abs(a.top - b.top) > 8) return a.top - b.top;
      return a.x - b.x;
    });
    return out;
  }

  // Agrupa los items de texto en líneas, y cada línea en celdas
  // usando los huecos horizontales (clave | valor | …).
  function pageLines(textContent, viewport) {
    var YTOL = 4, GAP = 8;
    var items = [];
    (textContent.items || []).forEach(function (it) {
      var s = (it.str || '');
      if (!s.trim()) return;
      var tr = it.transform;
      items.push({
        str: s.trim(),
        x0: tr[4],
        x1: tr[4] + (it.width || 0),
        top: viewport.height - tr[5]
      });
    });
    items.sort(function (a, b) {
      if (Math.abs(a.top - b.top) > YTOL) return a.top - b.top;
      return a.x0 - b.x0;
    });

    var rows = [], cur = [];
    items.forEach(function (it) {
      if (!cur.length) { cur = [it]; return; }
      if (Math.abs(it.top - cur[0].top) <= YTOL) cur.push(it);
      else { rows.push(cur); cur = [it]; }
    });
    if (cur.length) rows.push(cur);

    return rows.map(function (ws) {
      ws.sort(function (a, b) { return a.x0 - b.x0; });
      var cells = [], acc = [ws[0]];
      for (var i = 1; i < ws.length; i++) {
        if (ws[i].x0 - ws[i - 1].x1 > GAP) { cells.push(acc); acc = [ws[i]]; }
        else acc.push(ws[i]);
      }
      cells.push(acc);
      return {
        top: ws[0].top,
        cells: cells.map(function (c) {
          return c.map(function (w) { return w.str; }).join(' ').trim();
        }).filter(function (s) { return s.length > 0; })
      };
    }).filter(function (r) { return r.cells.length > 0; });
  }

  async function extractFromPdf(base64) {
    var pdf = await window.pdfjsLib.getDocument({ data: base64ToUint8(base64) }).promise;
    var pages = [];
    for (var n = 1; n <= pdf.numPages; n++) {
      var page = await pdf.getPage(n);
      var viewport = page.getViewport({ scale: 1 });
      var tc = await page.getTextContent();
      var lines = pageLines(tc, viewport);
      var images = await extractPageImages(page, viewport);
      pages.push({ num: n, lines: lines, images: images });
    }
    return pages;
  }

  /* ══════════════════════════════════════════════════════════
     2. PARSEO — líneas → secciones con filas tipadas
     ══════════════════════════════════════════════════════════ */

  function limpiar(s) {
    return String(s || '')
      .replace(/[▸►•❌→←↑↓■□▪▫●○◆◇★☆✓✗✔✘☑☐]/g, '')
      .replace(/&amp;/g, '&')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function esRuido(raw) {
    if (/MetaPlac/i.test(raw) && /Fuentes/i.test(raw)) return true;
    if (/^P[áa]gina\s+\d+\s+de\s+\d+$/i.test(raw)) return true;
    if (/^LOGO REFERENCIAL$/i.test(raw)) return true;
    // Cabecera y rótulos del panel gráfico del bot: son decorado, no datos.
    // Todo lo que dicen ya se muestra en nuestra portada y en las tablas.
    if (/^METAPLAC$/i.test(raw)) return true;
    if (/^REPORTE VEHICULAR INTEGRAL$/i.test(raw)) return true;
    if (/^Generado\s*:/i.test(raw)) return true;
    if (/^RE\s+RESUMEN\s+EJECUTIVO/i.test(raw)) return true;
    if (/^[ÍI]NDICE DE RIESGO/i.test(raw)) return true;
    if (/^COMPOSICI[ÓO]N DE FACTORES$/i.test(raw)) return true;
    if (/^IDENTIFICACI[ÓO]N DEL VEH[ÍI]CULO/i.test(raw)) return true;
    if (/^\/\s*\d+$/.test(raw)) return true;            // el "/ 100" del medidor
    if (/^FACTORES EVALUADOS$/i.test(raw)) return true;
    return false;
  }

  // El panel gráfico del bot deja sueltos el puntaje, el nivel de riesgo
  // y una fila de indicadores. Los recogemos para volver a dibujarlos con
  // nuestro propio diseño en la portada, en vez de arrastrar el decorado.
  var RE_NIVEL = /RIESGO\s+(MUY\s+ALTO|ALTO|MEDIO|MODERADO|BAJO)/i;
  var ETIQ_IND = /^(DENUNCIAS|DEUDA|REV\.|REVISI[ÓO]N|PROPIETARIOS|PAPELETAS|SOAT)/i;

  // ¿El texto no tiene ninguna letra minúscula? (los rótulos del panel
  // gráfico del bot van en versalitas; las etiquetas reales, capitalizadas)
  function sinMinusculas(s) {
    return !/[a-záéíóúüñ]/.test(String(s || ''));
  }

  // Filas del panel gráfico como "MARCA → MODELO" o "AUDI → Q5": son dos
  // rótulos o dos valores sueltos que el layout dejó enfrentados, no un
  // par campo/valor. Los datos reales vienen luego en la ficha técnica.
  function esParDecorativo(a, b) {
    return a.length <= 28 && b.length <= 28 && sinMinusculas(a) && sinMinusculas(b);
  }

  function parseSections(pages) {
    var secciones = [];
    var cur = { titulo: 'RESUMEN EJECUTIVO', filas: [], pag: 1, top: 0, imgs: [] };
    var SUB = /^(\d+\.\d+)\s+(.+)$/;
    var resumen = { score: '', nivel: '', indEtiquetas: null, indValores: null };

    pages.forEach(function (pg) {
      pg.lines.forEach(function (ln) {
        // El "/ 100" del medidor de riesgo cae a la misma altura que un
        // factor y se le pegaría como si fuera su etiqueta.
        var cells = ln.cells.filter(function (c) { return !/^\/\s*\d+$/.test(c.trim()); });
        if (!cells.length) return;
        var raw = limpiar(cells.join(' '));
        if (!raw) return;

        // ── Piezas del panel de riesgo (sólo aparecen en la portada) ──
        var mn = RE_NIVEL.exec(raw);
        if (mn) { resumen.nivel = mn[1].toUpperCase(); if (/^RE\s+RESUMEN/i.test(raw)) return; }
        if (pg.num === 1 && /^\d{1,3}$/.test(raw) && +raw <= 100) { resumen.score = raw; return; }
        if (pg.num === 1 && cells.length >= 3 && ETIQ_IND.test(cells[0])) {
          resumen.indEtiquetas = cells.map(limpiar);
          return;
        }
        // La fila de valores va justo encima de la de etiquetas
        if (pg.num === 1 && cells.length >= 3 && !resumen.indEtiquetas &&
            cells.every(function (c) { return /^(S\/\s*)?[\d.,]+$|^VIGENTE$|^VENCIDA?$|^—$|^-$/i.test(c.trim()); })) {
          resumen.indValores = cells.map(limpiar);
          return;
        }
        // Descripción del vehículo repetida del panel (ya va en la portada)
        if (pg.num === 1 && raw.indexOf('·') !== -1) return;

        if (esRuido(raw)) return;

        // Nueva sección: la primera celda es exactamente un romano
        if (cells.length >= 2 && ROMANS.indexOf(cells[0].trim()) !== -1) {
          secciones.push(cur);
          cur = {
            titulo: limpiar(cells.slice(1).join(' ')),
            filas: [], pag: pg.num, top: ln.top, imgs: []
          };
          return;
        }
        var m = SUB.exec(raw);
        if (m) { cur.filas.push({ t: 'sub', a: limpiar(m[2]) }); return; }

        if (cells.length === 2) {
          var ka = limpiar(cells[0]), vb = limpiar(cells[1]);
          if (!esParDecorativo(ka, vb)) cur.filas.push({ t: 'kv', a: ka, b: vb });
        } else if (cells.length === 1) {
          cur.filas.push({ t: 'txt', a: limpiar(cells[0]) });
        } else {
          cur.filas.push({ t: 'row', cells: cells.map(limpiar) });
        }
      });
    });
    secciones.push(cur);

    // Asignar cada imagen a la sección que la precede en el documento,
    // comparando por (página, posición vertical) — así una imagen no se
    // "cuela" en la siguiente sección cuando ambas caen en la misma hoja.
    pages.forEach(function (pg) {
      pg.images.forEach(function (im) {
        // El logo referencial de la marca (miniatura en portada) no aporta.
        if (pg.num === 1 && im.px <= 500 && im.py <= 500) return;
        var target = secciones[0];
        secciones.forEach(function (s) {
          if (s.pag < pg.num || (s.pag === pg.num && s.top <= im.top)) target = s;
        });
        target.imgs.push(im);
      });
    });

    var out = secciones.filter(function (s) { return s.filas.length || s.imgs.length; });
    out.resumen = resumen;
    return out;
  }

  // Busca el valor de un campo por patrón entre todas las secciones.
  // Se queda con la ÚLTIMA coincidencia: el bot repite los datos en un
  // panel resumido al inicio y luego en la ficha técnica detallada, que
  // es la que trae el valor bueno.
  function findVal(secciones, re, secRe) {
    var hit = '';
    secciones.forEach(function (s) {
      // secRe acota la búsqueda a una sección: campos como "Estado"
      // existen en varias (vehículo, SOAT, revisión técnica).
      if (secRe && !secRe.test(s.titulo)) return;
      s.filas.forEach(function (f) {
        if (f.t === 'kv' && re.test(f.a) && f.b) hit = f.b;
      });
    });
    return hit;
  }

  /* ══════════════════════════════════════════════════════════
     3. CONSTRUCCIÓN — PDF nuevo con diseño institucional FV+
     ══════════════════════════════════════════════════════════ */

  function buildPdf(secciones, meta) {
    var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = doc.internal.pageSize.getWidth();   // 210
    var H = doc.internal.pageSize.getHeight();  // 297
    var M = 16;
    var BAND_TOP = 24;
    var BAND_BOT = H - 12;
    var CONTENT_TOP = BAND_TOP + 10;

    var valor = (meta && meta.valor ? String(meta.valor) : '').toUpperCase();
    var fecha = (meta && meta.fecha) || new Date().toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    /* ── Franjas institucionales ──
       Cada página se decora una sola vez: autoTable dispara didDrawPage
       por cada tabla, y repintar el mismo texto lo dejaría emborronado. */
    var decoradas = {};
    function franjas() {
      var pn = 1;
      try { pn = doc.internal.getCurrentPageInfo().pageNumber; } catch (e) { pn = 1; }
      if (decoradas[pn]) return;
      decoradas[pn] = true;

      doc.setFillColor.apply(doc, C_PRIMARY);
      doc.rect(0, 0, W, BAND_TOP, 'F');
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(0, BAND_TOP, W, 1.1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor.apply(doc, C_WHITE);
      doc.text('Filtro Vehicular+', M, 12.5);
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.circle(M + doc.getTextWidth('Filtro Vehicular+') + 1.9, 10.9, 0.8, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text('PLATAFORMA DE CONSULTAS VEHICULARES', M, 18);
      if (valor) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor.apply(doc, C_ACCENT);
        doc.text(valor, W - M, 12.5, { align: 'right' });
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text(fecha, W - M, 18, { align: 'right' });

      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(0, BAND_BOT - 1, W, 1, 'F');
      doc.setFillColor.apply(doc, C_PRIMARY);
      doc.rect(0, BAND_BOT, W, H - BAND_BOT, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text('Documento generado por Filtro Vehicular+ · Información extraída de fuentes oficiales.', M, BAND_BOT + 7);
    }

    var y = CONTENT_TOP;
    function nuevaPagina() { doc.addPage(); franjas(); y = CONTENT_TOP; }
    function need(mm) { if (y + mm > BAND_BOT - 5) nuevaPagina(); }

    franjas();

    /* ── PORTADA: ficha del vehículo ── */
    var DV      = /DATOS DEL VEH/i;   // sección "Datos del vehículo"
    var marca   = findVal(secciones, /^Marca\s*\/\s*Modelo/i) || findVal(secciones, /^Marca/i);
    var anio    = findVal(secciones, /^A[ñn]o Fabricaci[óo]n/i);
    var color   = findVal(secciones, /^Color/i, DV);
    var carro   = findVal(secciones, /^Carrocer[íi]a/i, DV);
    var estado  = findVal(secciones, /^Estado$/i, DV);
    var placa   = findVal(secciones, /^N[°º]? de Placa/i) || valor;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor.apply(doc, C_TEXT);
    doc.text('REPORTE VEHICULAR INTEGRAL', M, y + 4);
    y += 12;

    // Tarjeta oscura con la placa y la descripción
    var heroH = 30;
    doc.setFillColor.apply(doc, C_PRIMARY);
    doc.rect(M, y, W - M * 2, heroH, 'F');
    doc.setFillColor.apply(doc, C_ACCENT);
    doc.rect(M, y, 2.2, heroH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor.apply(doc, C_WHITE);
    doc.text(placa || '—', M + 9, y + 15);

    var linea1 = [marca, anio, color].filter(Boolean).join('   ·   ');
    var linea2 = [carro, estado].filter(Boolean).join('   ·   ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, C_SUBHEAD);
    if (linea1) doc.text(linea1, M + 9, y + 22, { maxWidth: W - M * 2 - 18 });
    if (linea2) doc.text(linea2, M + 9, y + 27, { maxWidth: W - M * 2 - 18 });
    y += heroH + 8;

    /* ── Índice de riesgo: barra proporcional al puntaje ── */
    var R = secciones.resumen || {};
    if (R.score) {
      var barW = W - M * 2, barH = 7;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.4);
      doc.setTextColor.apply(doc, C_KEY);
      doc.text('ÍNDICE DE RIESGO VEHICULAR', M, y);
      if (R.nivel) {
        doc.setTextColor.apply(doc, C_TEXT);
        doc.text('RIESGO ' + R.nivel, W - M, y, { align: 'right' });
      }
      y += 3;
      doc.setFillColor(232, 236, 231);
      doc.rect(M, y, barW, barH, 'F');
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(M, y, barW * Math.max(0, Math.min(100, +R.score)) / 100, barH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, C_PRIMARY);
      doc.text(R.score + ' / 100', M + 2.5, y + 5);
      y += barH + 8;
    }

    /* ── Indicadores clave en tarjetas ── */
    if (R.indEtiquetas && R.indValores && R.indEtiquetas.length === R.indValores.length) {
      var n = R.indEtiquetas.length;
      var cardW = (W - M * 2 - (n - 1) * 3) / n, cardH = 15;
      for (var ci = 0; ci < n; ci++) {
        var cx0 = M + ci * (cardW + 3);
        doc.setFillColor(246, 248, 245);
        doc.rect(cx0, y, cardW, cardH, 'F');
        doc.setFillColor.apply(doc, C_ACCENT);
        doc.rect(cx0, y, cardW, 0.9, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor.apply(doc, C_PRIMARY);
        doc.text(String(R.indValores[ci] || '—'), cx0 + cardW / 2, y + 7.5, {
          align: 'center', maxWidth: cardW - 3
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.6);
        doc.setTextColor.apply(doc, C_KEY);
        doc.text(String(R.indEtiquetas[ci] || ''), cx0 + cardW / 2, y + 12, {
          align: 'center', maxWidth: cardW - 2
        });
      }
      y += cardH + 8;
    }

    /* ── Secciones ── */
    var numSec = 0;
    secciones.forEach(function (sec) {
      var filasKV  = sec.filas.filter(function (f) { return f.t === 'kv'; });
      var filasTxt = sec.filas.filter(function (f) { return f.t === 'txt'; });
      var filasRow = sec.filas.filter(function (f) { return f.t === 'row'; });
      if (!filasKV.length && !filasTxt.length && !filasRow.length && !sec.imgs.length) return;

      // Encabezado de sección con barra de acento
      need(18);
      numSec++;
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(M, y - 3.4, 2, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor.apply(doc, C_TEXT);
      doc.text((ROMANS[numSec - 1] || numSec) + '.  ' + sec.titulo, M + 5, y + 1.2, {
        maxWidth: W - M * 2 - 6
      });
      y += 8;

      // Tabla de pares clave/valor
      if (filasKV.length) {
        doc.autoTable({
          startY: y,
          body: filasKV.map(function (f) { return [f.a, f.b]; }),
          margin: { left: M, right: M, top: CONTENT_TOP, bottom: H - BAND_BOT + 5 },
          tableLineWidth: 0,
          didDrawPage: franjas,
          bodyStyles: {
            fontSize: 8.2, textColor: C_TEXT, valign: 'middle', lineWidth: 0,
            cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }
          },
          alternateRowStyles: { fillColor: C_ZEBRA },
          columnStyles: {
            0: { cellWidth: 58, textColor: C_KEY },
            1: { cellWidth: 'auto', fontStyle: 'bold' }
          },
          styles: { overflow: 'linebreak', lineWidth: 0 }
        });
        y = (doc.lastAutoTable && doc.lastAutoTable.finalY) || y;
        y += 3;
      }

      // Tablas de varias columnas (historiales, listados)
      if (filasRow.length) {
        var maxCols = 0;
        filasRow.forEach(function (f) { maxCols = Math.max(maxCols, f.cells.length); });
        var cuerpo = filasRow.map(function (f) {
          var c = f.cells.slice();
          while (c.length < maxCols) c.push('');
          return c;
        });
        doc.autoTable({
          startY: y,
          body: cuerpo,
          margin: { left: M, right: M, top: CONTENT_TOP, bottom: H - BAND_BOT + 5 },
          tableLineWidth: 0,
          didDrawPage: franjas,
          bodyStyles: {
            fontSize: 7.4, textColor: C_TEXT, valign: 'middle', lineWidth: 0,
            cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 }
          },
          alternateRowStyles: { fillColor: C_ZEBRA },
          styles: { overflow: 'linebreak', lineWidth: 0 }
        });
        y = (doc.lastAutoTable && doc.lastAutoTable.finalY) || y;
        y += 3;
      }

      // Notas / texto libre
      filasTxt.forEach(function (f) {
        if (!f.a || f.a.length < 2) return;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor.apply(doc, C_KEY);
        var lineas = doc.splitTextToSize(f.a, W - M * 2 - 4);
        need(lineas.length * 3.6 + 3);
        doc.text(lineas, M + 2, y + 2);
        y += lineas.length * 3.6 + 2.5;
      });

      // ── Imágenes de la sección, a tamaño real ──
      if (sec.imgs.length) {
        y += 2;
        // Biométricas: varias imágenes chicas → fila horizontal
        var chicas = sec.imgs.filter(function (im) { return im.px <= 1000 && im.py <= 700; });
        var grandes = sec.imgs.filter(function (im) { return !(im.px <= 1000 && im.py <= 700); });

        if (chicas.length > 1) {
          var etiquetas = ['Foto', 'Firma', 'Huella derecha', 'Huella izquierda'];
          var maxH = 34;
          need(maxH + 10);
          var slot = (W - M * 2) / chicas.length;
          var base = y + maxH;
          chicas.forEach(function (im, i) {
            var esc = Math.min((slot - 8) / im.px, maxH / im.py);
            var dw = im.px * esc, dh = im.py * esc;
            var cx = M + slot * i + slot / 2;
            try {
              doc.addImage(im.dataUrl, 'JPEG', cx - dw / 2, base - dh, dw, dh, undefined, 'FAST');
            } catch (e) { /* imagen no insertable */ }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.6);
            doc.setTextColor.apply(doc, C_KEY);
            doc.text(etiquetas[i] || ('Imagen ' + (i + 1)), cx, base + 4, { align: 'center' });
          });
          y = base + 9;
        } else {
          grandes = sec.imgs;
        }

        // Documentos escaneados: uno por bloque, lo más grande posible
        grandes.forEach(function (im) {
          var dispW = W - M * 2;
          var maxH = BAND_BOT - CONTENT_TOP - 8;
          var esc = Math.min(dispW / im.px, maxH / im.py);
          var dw = im.px * esc, dh = im.py * esc;
          // Si no cabe en lo que queda de página, pasa a una nueva
          if (y + dh > BAND_BOT - 6) nuevaPagina();
          try {
            doc.addImage(im.dataUrl, 'JPEG', M + (dispW - dw) / 2, y, dw, dh, undefined, 'FAST');
          } catch (e) { /* imagen no insertable */ }
          y += dh + 5;
        });
      }

      y += 5;
    });

    /* ── Pie en la última página ── */
    var total = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : 1;
    for (var pnum = 1; pnum <= total; pnum++) {
      doc.setPage(pnum);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text(pnum + ' / ' + total, W - M, BAND_BOT + 7, { align: 'right' });
    }

    var slug = valor.replace(/[^A-Z0-9]/g, '').slice(0, 12);
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var filename = 'FiltroVehicular-Reporte' + (slug ? '-' + slug : '') + '-' + stamp + '.pdf';

    var blob = doc.output('blob');
    return {
      blobUrl: URL.createObjectURL(blob),
      base64: doc.output('datauristring').split(',')[1],
      filename: filename
    };
  }

  /* ══════════════════════════════════════════════════════════
     API pública
     ══════════════════════════════════════════════════════════ */
  async function generate(pdfBase64, meta) {
    if (!window.pdfjsLib) throw new Error('pdf.js no disponible');
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF no disponible');
    if (!pdfBase64) throw new Error('Sin PDF de origen');

    var pages = await extractFromPdf(pdfBase64);
    var secciones = parseSections(pages);
    if (!secciones.length) throw new Error('No se pudo leer el contenido del PDF');
    return buildPdf(secciones, meta || {});
  }

  Consultia.MetaplaReport = {
    generate: generate,
    // Expuestos para diagnóstico y pruebas por etapa del pipeline.
    _extract: extractFromPdf,
    _parse: parseSections,
    _build: buildPdf
  };
})();
