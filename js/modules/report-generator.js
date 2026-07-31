/* ============================================================
   REPORT GENERATOR — genera PDF institucional descargable
   con preview inline usando PDF.js.

   Estructura y geometría portadas 1:1 desde VeriNexo (generarPdf,
   page.tsx) — tabla continua con auto-fit de fuente para entrar en
   una sola hoja, fotos alineadas por la base en proporción real,
   franjas superior/inferior en cada página. Colores propios de
   Filtro Vehicular+ (no la paleta navy/cyan de VeriNexo).

   Colores institucionales FV+:
     Header  #141d1c  →  [20, 29, 28]
     Acento  #8fc72e  →  [143, 199, 46]

   Expone:
     Consultia.ReportGenerator.generate(p, meta, photos)
       → { blobUrl, base64, filename }   (no descarga automática)
     Consultia.ReportGenerator.download(result)
       → dispara la descarga del PDF ya generado
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};

  // ── Colores institucionales ────────────────────────────────
  var C_PRIMARY  = [20,  29,  28];   // #141d1c — fondo de las franjas
  var C_ACCENT   = [143, 199,  46];  // #8fc72e verde institucional
  var C_WHITE    = [255, 255, 255];
  var C_SUBHEAD  = [200, 215, 212];  // texto secundario sobre fondo oscuro
  var C_TEXT     = [31,  42,  40];   // texto de cuerpo sobre fondo blanco
  var C_KEY      = [100, 100, 100];  // label izq — gris medio
  var C_BORDER   = [225, 225, 225];

  // Limpia caracteres decorativos que Helvetica no renderiza bien en PDF:
  // ▸ ► • ❌ y la corrupción %¸ que aparece cuando ▸ se pierde en encoding
  function cleanText(s) {
    if (!s) return '';
    return String(s)
      .replace(/[▸►•❌→←↑↓■□▪▫●○◆◇★☆✓✗✔✘☑☐]/g, '')
      .replace(/%¸/g, '')
      .replace(/[─-╿]/g, '')  // box-drawing chars
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function prettyLabel(k) {
    var label = k || '';
    if (Consultia.ConsultaRunner && Consultia.ConsultaRunner.prettyLabel) {
      label = Consultia.ConsultaRunner.prettyLabel(k);
    }
    label = cleanText(label);
    label = label.replace(/\s*\(\s*\d+\s*\)\s*$/, '').trim();
    return label.toUpperCase();
  }

  function isEmptyVal(v) {
    if (!v) return true;
    var t = String(v).trim().toUpperCase();
    var EMPTY = ['N/A','NA','N/D','ND','-','--','---','NO DISPONIBLE',
                 'NO REGISTRA','SIN DATO','SIN DATOS','NO APLICA','[]','[ ]'];
    return EMPTY.indexOf(t) !== -1 || /^\[\s*\]$/.test(t) || /^\[\s*-\s*\]$/.test(t);
  }

  // ── Franjas de página (se redibujan en cada página vía didDrawPage) ──
  function drawTopBand(doc, pageW, fecha) {
    doc.setFillColor.apply(doc, C_PRIMARY);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setFillColor.apply(doc, C_ACCENT);
    doc.rect(0, 22, pageW, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.setTextColor.apply(doc, C_WHITE);
    doc.text('Filtro Vehicular+', 18, 13);
    doc.setFillColor.apply(doc, C_ACCENT);
    doc.circle(18 + doc.getTextWidth('Filtro Vehicular+') + 2.2, 11.2, 0.9, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, C_SUBHEAD);
    doc.text('PLATAFORMA DE CONSULTAS VEHICULARES', 18, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, C_SUBHEAD);
    doc.text(fecha, pageW - 18, 14, { align: 'right' });
  }

  function drawBottomBand(doc, pageW, pageH, bottomBandTop) {
    doc.setFillColor.apply(doc, C_ACCENT);
    doc.rect(0, bottomBandTop - 1, pageW, 1, 'F');
    doc.setFillColor.apply(doc, C_PRIMARY);
    doc.rect(0, bottomBandTop, pageW, pageH - bottomBandTop, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor.apply(doc, C_SUBHEAD);
    doc.text('Documento generado por Filtro Vehicular+ · Información extraída de fuentes oficiales.', 18, bottomBandTop + 7.5);
  }

  // Dimensiones reales de la imagen vía jsPDF (síncrono)
  function getImgDims(doc, photo) {
    try {
      var fmt = ((photo.mimeType || 'image/jpeg').split('/')[1] || 'jpeg').toUpperCase();
      if (fmt === 'JPG') fmt = 'JPEG';
      var props = doc.getImageProperties('data:' + (photo.mimeType || 'image/jpeg') + ';base64,' + photo.base64);
      return { w: props.width, h: props.height, fmt: fmt };
    } catch (_) {
      return { w: 4, h: 3, fmt: 'JPEG' };
    }
  }

  function generate(p, meta, photos) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      if (Consultia.toast) Consultia.toast({
        type: 'error', title: 'PDF no disponible',
        message: 'Recarga la página e intenta de nuevo.'
      });
      return null;
    }

    var consultaNombre = (meta && meta.consultaNombre) || 'Informe de consulta';
    var valor          = (meta && meta.valor) || '';
    var fecha          = (meta && meta.fecha) || new Date().toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    var doc    = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageW  = doc.internal.pageSize.getWidth();   // 210
    var pageH  = doc.internal.pageSize.getHeight();  // 297
    var M      = 18;
    var bottomBandTop = pageH - 13;

    // ── TÍTULO DEL INFORME ────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor.apply(doc, C_TEXT);
    doc.text('Informe de ' + consultaNombre, M, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, C_KEY);
    if (valor) doc.text('Dato consultado: ' + valor, M, 39.5);

    // ── PRECARGA DE IMÁGENES (proporción real) ────────────────
    var imgInfos = (photos || []).map(function (ph) { return getImgDims(doc, ph); });
    var labels = ['Foto', 'Firma', 'Huella derecha', 'Huella izquierda'];

    // ── GEOMETRÍA: espacio reservado para imágenes (antes de la tabla,
    //    para que tabla + fotos entren en una sola hoja siempre que sea
    //    posible — igual que VeriNexo) ──────────────────────────────
    var bioMaxH = 34, bioTitleH = 7, bioLabelH = 5;
    var bioBlockH = imgInfos.length > 0 ? (bioTitleH + bioMaxH + bioLabelH + 8) : 0;
    var tableTop = 45;
    var tableBottom = bottomBandTop - 6 - bioBlockH;
    var availableTableH = tableBottom - tableTop;

    // ── FILAS: aplanar secciones a una tabla continua (secciones = fila
    //    ancha en negrita, igual que VeriNexo — no una autoTable por
    //    sección) ─────────────────────────────────────────────────────
    var seenSec = Object.create(null);
    var uniqSec = [];
    (p.secciones || []).forEach(function (s) {
      var sig = (s.campos || []).map(function (c) { return (c.campo || '_') + '::' + (c.valor || ''); }).join('§');
      if (!sig || seenSec[sig]) return;
      seenSec[sig] = true;
      uniqSec.push(s);
    });

    var rows = []; // { campo, valor, tipo: 'seccion'|'campo'|'info' }
    uniqSec.forEach(function (s) {
      var secTit = cleanText(s.titulo);
      var isMain = !secTit || secTit === 'General' || secTit === 'Datos principales';
      var campos = (s.campos || []).filter(function (c) {
        var hasKey = c.campo && String(c.campo).trim().length > 0;
        var hasVal = c.valor != null && String(c.valor).trim().length > 0 && !isEmptyVal(c.valor);
        return hasKey || hasVal;
      });
      if (!campos.length) return;
      if (!isMain) rows.push({ tipo: 'seccion', campo: secTit.toUpperCase(), valor: '' });
      campos.forEach(function (c) {
        var k = (c.campo && String(c.campo).trim()) ? prettyLabel(c.campo) : null;
        var v = cleanText(c.valor);
        if (!k && (!v || isEmptyVal(v))) return;
        if (k) {
          if (isEmptyVal(v)) return;
          rows.push({ tipo: 'campo', campo: k, valor: v });
        } else if (v && !isEmptyVal(v)) {
          var colonIdx = v.indexOf(':');
          if (colonIdx > 0 && colonIdx < 35) {
            var parsedKey = v.slice(0, colonIdx).trim().replace(/\s*\(\s*\d+\s*\)\s*$/, '').trim();
            var parsedVal = v.slice(colonIdx + 1).trim();
            if (parsedKey && parsedVal && !isEmptyVal(parsedVal)) {
              rows.push({ tipo: 'campo', campo: prettyLabel(parsedKey), valor: parsedVal });
              return;
            }
            if (parsedKey && (!parsedVal || isEmptyVal(parsedVal))) return;
          }
          rows.push({ tipo: 'info', campo: v, valor: '' });
        }
      });
    });

    // ── AUTO-FIT: elegir fuente/padding para entrar en 1 hoja ─────────
    var candidatosFuentes = [
      { font: 10, pad: 2.7 }, { font: 9.5, pad: 2.4 }, { font: 9, pad: 2.1 },
      { font: 8.5, pad: 1.8 }, { font: 8, pad: 1.5 }, { font: 7.5, pad: 1.3 }, { font: 7, pad: 1.0 },
    ];
    function rowH(c) { return c.font * 0.3528 * 1.15 + c.pad * 2; }
    var numFilas = Math.max(rows.length, 1);
    var elegido = candidatosFuentes[candidatosFuentes.length - 1];
    for (var ci = 0; ci < candidatosFuentes.length; ci++) {
      if (rowH(candidatosFuentes[ci]) * numFilas <= availableTableH) { elegido = candidatosFuentes[ci]; break; }
    }
    var fontBody = elegido.font;
    var cellPad = elegido.pad;

    // ── TABLA (plana, sin bordes; secciones en negrita) ───────────────
    var body = rows.map(function (r) {
      if (r.tipo === 'seccion') {
        return [{ content: r.campo, colSpan: 2, styles: { fontStyle: 'bold', textColor: C_TEXT, cellPadding: { top: cellPad + 1.6, bottom: cellPad, left: 0, right: 0 } } }];
      }
      if (r.tipo === 'info') {
        return [{ content: r.campo, colSpan: 2, styles: { fontStyle: 'italic', textColor: C_KEY, cellPadding: { top: cellPad + 0.5, bottom: cellPad + 0.5, left: 0, right: 0 } } }];
      }
      return [r.campo, r.valor];
    });

    if (body.length) {
      doc.autoTable({
        startY: tableTop,
        body: body,
        margin: { left: M, right: M, top: 26, bottom: 16 },
        tableLineWidth: 0,
        didDrawPage: function () { drawTopBand(doc, pageW, fecha); drawBottomBand(doc, pageW, pageH, bottomBandTop); },
        bodyStyles: {
          fontSize: fontBody, textColor: C_TEXT,
          cellPadding: { top: cellPad, bottom: cellPad, left: 0, right: 5 },
          lineWidth: 0, fillColor: C_WHITE, valign: 'middle',
        },
        columnStyles: { 0: { cellWidth: 52, textColor: C_KEY }, 1: { cellWidth: 'auto' } },
        styles: { overflow: 'linebreak', lineWidth: 0 },
      });
    } else {
      // Sin filas de datos: igual dibujamos las franjas de la página 1.
      drawTopBand(doc, pageW, fecha);
      drawBottomBand(doc, pageW, pageH, bottomBandTop);
    }

    // ── IMÁGENES BIOMÉTRICAS (proporción real, alineadas por la base) ─
    if (imgInfos.length > 0) {
      var lastY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || tableTop;
      var titleY = Math.min(lastY + 12, bottomBandTop - 6 - bioBlockH + bioTitleH);

      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(M, titleY - 3, 1.2, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, C_TEXT);
      doc.text('ARCHIVOS BIOMÉTRICOS', M + 3.5, titleY);

      var baseline = titleY + 4 + bioMaxH;
      var usableW = pageW - M * 2;
      var slotW = usableW / imgInfos.length;
      var cellMaxW = slotW - 10;

      imgInfos.forEach(function (info, i) {
        var cx = M + slotW * i + slotW / 2;
        var scale = Math.min(cellMaxW / info.w, bioMaxH / info.h);
        var dW = info.w * scale;
        var dH = info.h * scale;
        var x = cx - dW / 2;
        var y = baseline - dH;
        try {
          doc.addImage(photos[i].base64, info.fmt, x, y, dW, dH, undefined, 'FAST');
        } catch (e) {
          console.warn('[report-generator] no se pudo insertar imagen', i, e);
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor.apply(doc, C_KEY);
        doc.text(labels[i] || ('Imagen ' + (i + 1)), cx, baseline + bioLabelH - 1, { align: 'center' });
      });
    }

    // ── FOOTER en todas las páginas (redibuja la franja inferior por si
    //    la última página no pasó por didDrawPage, ej. cuando body está
    //    vacío) ───────────────────────────────────────────────────────
    var totalPages = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : 1;
    doc.setPage(totalPages);
    drawBottomBand(doc, pageW, pageH, bottomBandTop);

    // ── GENERAR BLOB ───────────────────────────────────────────────
    var consultaSlug = consultaNombre
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-').toLowerCase()
      .slice(0, 40);
    var valorSlug = valor ? valor.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20) : '';
    var filename = (consultaSlug || 'consulta') + (valorSlug ? '-' + valorSlug : '') + '.pdf';

    var blob    = doc.output('blob');
    var blobUrl = URL.createObjectURL(blob);
    var base64  = doc.output('datauristring').split(',')[1];

    return { blobUrl: blobUrl, base64: base64, filename: filename };
  }

  function download(result) {
    if (!result || !result.blobUrl) return;
    var a = document.createElement('a');
    a.href = result.blobUrl;
    a.download = result.filename || 'informe.pdf';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); }, 200);
  }

  Consultia.ReportGenerator = { generate: generate, download: download };
})();
