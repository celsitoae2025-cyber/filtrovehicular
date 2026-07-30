/* ============================================================
   REPORT GENERATOR — genera PDF institucional descargable
   con preview inline usando PDF.js.

   Colores institucionales FV+:
     Header  #141d1c  →  [20, 29, 28]
     Acento  #8fc72e  →  [143, 199, 46]
   Tablas en escala de grises para mejor legibilidad impresa.

   Expone:
     Consultia.ReportGenerator.generate(p, meta)
       → { blobUrl, base64, filename }   (no descarga automática)
     Consultia.ReportGenerator.download(result)
       → dispara la descarga del PDF ya generado
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};

  // ── Colores institucionales ────────────────────────────────
  var C_PRIMARY  = [20,  29,  28];   // #141d1c
  var C_ACCENT   = [143, 199,  46];  // #8fc72e verde institucional
  var C_WHITE    = [255, 255, 255];
  var C_SUBHEAD  = [200, 215, 212];  // texto secundario en header oscuro

  // Tabla
  var C_KEY      = [100, 100, 100];  // label izq — gris medio
  var C_VALUE    = [31,  42,  40];   // valor der — mismo que primario
  var C_BORDER   = [225, 225, 225];
  var C_ALTROW   = [255, 255, 255];  // sin alternado — todo blanco
  var C_SECTTIT  = [31,  42,  40];   // títulos de sección = primario

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
    // Eliminar sufijos de índice como "(1)", "( 1 )", "(2)"
    label = label.replace(/\s*\(\s*\d+\s*\)\s*$/, '').trim();
    // Convertir a mayúsculas
    return label.toUpperCase();
  }

  function isEmptyVal(v) {
    if (!v) return true;
    var t = String(v).trim().toUpperCase();
    var EMPTY = ['N/A','NA','N/D','ND','-','--','---','NO DISPONIBLE',
                 'NO REGISTRA','SIN DATO','SIN DATOS','NO APLICA','[]','[ ]'];
    return EMPTY.indexOf(t) !== -1 || /^\[\s*\]$/.test(t) || /^\[\s*-\s*\]$/.test(t);
  }

  function addPageHeader(doc, pageW, consultaNombre) {
    // Barra superior delgada de acento
    doc.setFillColor.apply(doc, C_ACCENT);
    doc.rect(0, 0, pageW, 2, 'F');
    // Fondo oscuro
    doc.setFillColor.apply(doc, C_PRIMARY);
    doc.rect(0, 2, pageW, 14, 'F');
    doc.setTextColor.apply(doc, C_WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('FILTRO VEHICULAR+', 12, 10.5);
    doc.setTextColor.apply(doc, C_SUBHEAD);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(consultaNombre.toUpperCase(), pageW - 12, 10.5, { align: 'right' });
  }

  function addPageFooter(doc, pageW, pageH, fecha, pageNum, totalPages) {
    var fy = pageH - 8;
    doc.setDrawColor.apply(doc, C_BORDER);
    doc.setLineWidth(0.3);
    doc.line(14, fy - 3, pageW - 14, fy - 3);
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, C_KEY);
    doc.setFont('helvetica', 'normal');
    doc.text('Filtro Vehicular+ · ' + fecha, 14, fy + 0.5);
    doc.text('Pág. ' + pageNum + ' de ' + totalPages, pageW - 14, fy + 0.5, { align: 'right' });
  }

  // Obtiene dimensiones reales de la imagen via jsPDF (síncrono)
  function getImgDims(doc, photo) {
    try {
      var fmt = ((photo.mimeType || 'image/jpeg').split('/')[1] || 'jpeg').toUpperCase();
      if (fmt === 'JPG') fmt = 'JPEG';
      var props = doc.getImageProperties('data:' + (photo.mimeType || 'image/jpeg') + ';base64,' + photo.base64);
      return { w: props.width, h: props.height, fmt: fmt };
    } catch (_) {
      return { w: 4, h: 3, fmt: 'JPEG' }; // fallback 4:3
    }
  }

  // Inserta imagen manteniendo proporción dentro de maxW x maxH
  // Devuelve { w, h } reales usados
  function addImageSafe(doc, photo, x, y, maxW, maxH) {
    try {
      var d = getImgDims(doc, photo);
      var ratio = d.h / d.w;
      var w = maxW;
      var h = w * ratio;
      if (maxH && h > maxH) { h = maxH; w = h / ratio; }
      doc.addImage(photo.base64, d.fmt, x, y, w, h);
      return { w: w, h: h };
    } catch (_) {
      doc.setDrawColor.apply(doc, C_BORDER);
      doc.setLineWidth(0.3);
      doc.rect(x, y, maxW, maxH || maxW * 0.75);
      return { w: maxW, h: maxH || maxW * 0.75 };
    }
  }

  // Fila horizontal de imágenes — todas en una sola línea al final del contenido
  function addPhotosRow(doc, photos, pageW, pageH, margin, yStart, fecha, consultaNombre, pageCount) {
    var y = yStart;
    var n = photos.length;
    if (!n) return { y: y, pages: pageCount };

    // Separador
    y += 5;
    doc.setDrawColor.apply(doc, C_ACCENT);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 20, y);
    doc.setDrawColor.apply(doc, C_BORDER);
    doc.setLineWidth(0.2);
    doc.line(margin + 20, y, pageW - margin, y);
    y += 6;

    var contentW = pageW - margin * 2;
    var gap = 4;
    // Ancho de cada imagen para que quepan todas en una fila
    var imgW = Math.min((contentW - gap * (n - 1)) / n, 65);
    // Altura máxima uniforme = 55mm (se respeta proporción real)
    var maxH = Math.min(pageH - y - 20, 55);

    // Calcular altura máxima real entre todas las imágenes
    var rowH = 0;
    var dims = [];
    for (var i = 0; i < n; i++) {
      var d = getImgDims(doc, photos[i]);
      var h = imgW * (d.h / d.w);
      if (h > maxH) h = maxH;
      var w = h * (d.w / d.h);
      dims.push({ w: w, h: h });
      if (h > rowH) rowH = h;
    }

    // Si no cabe en la página actual, nueva página
    if (y + rowH > pageH - 18) {
      addPageFooter(doc, pageW, pageH, fecha, pageCount, '?');
      doc.addPage(); pageCount++;
      addPageHeader(doc, pageW, consultaNombre);
      y = 28;
    }

    // Centrar la fila completa horizontalmente
    var totalW = 0;
    for (var j = 0; j < n; j++) totalW += dims[j].w;
    totalW += gap * (n - 1);
    var startX = margin + (contentW - totalW) / 2;
    var cx = startX;

    for (var k = 0; k < n; k++) {
      // Alinear verticalmente al centro de la fila
      var imgY = y + (rowH - dims[k].h) / 2;
      addImageSafe(doc, photos[k], cx, imgY, dims[k].w, dims[k].h);
      cx += dims[k].w + gap;
    }

    y += rowH + 4;
    return { y: y, pages: pageCount };
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
    var pageW  = doc.internal.pageSize.getWidth();
    var pageH  = doc.internal.pageSize.getHeight();
    var margin = 12;
    var y      = 0;

    // ── ENCABEZADO PÁGINA 1 ───────────────────────────────────
    addPageHeader(doc, pageW, consultaNombre);
    y = 22;

    // Título + dato consultado
    doc.setTextColor.apply(doc, C_PRIMARY);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(consultaNombre, margin, y);
    y += 5;

    if (p.titulo && p.titulo.trim() && p.titulo.trim() !== consultaNombre) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor.apply(doc, C_KEY);
      doc.text(p.titulo.trim(), margin, y);
      y += 4;
    }

    if (valor) {
      doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, C_KEY);
      doc.setFont('helvetica', 'normal');
      doc.text('Dato consultado: ' + valor, margin, y);
      y += 3;
    }

    // Línea divisora con acento
    y += 1;
    doc.setDrawColor.apply(doc, C_ACCENT);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 30, y);
    doc.setDrawColor.apply(doc, C_BORDER);
    doc.setLineWidth(0.2);
    doc.line(margin + 30, y, pageW - margin, y);
    y += 5;

    // ── SECCIONES ────────────────────────────────────────────
    var seenSec = Object.create(null);
    var uniqSec = [];
    (p.secciones || []).forEach(function (s) {
      var sig = (s.campos || []).map(function (c) {
        return (c.campo || '_') + '::' + (c.valor || '');
      }).join('§');
      if (!sig || seenSec[sig]) return;
      seenSec[sig] = true;
      uniqSec.push(s);
    });

    var pages = 1;

    uniqSec.forEach(function (s) {
      var campos = (s.campos || []).filter(function (c) {
        var hasKey = c.campo && String(c.campo).trim().length > 0;
        var hasVal = c.valor != null && String(c.valor).trim().length > 0 && !isEmptyVal(c.valor);
        return hasKey || hasVal;
      });
      if (!campos.length) return;

      if (y > pageH - 45) {
        addPageFooter(doc, pageW, pageH, fecha, pages, '?');
        doc.addPage();
        pages++;
        addPageHeader(doc, pageW, consultaNombre);
        y = 28;
      }

      var secTit = cleanText(s.titulo);
      var isMain = !secTit || secTit === 'General' || secTit === 'Datos principales';
      if (!isMain) {
        y += 2;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor.apply(doc, C_SECTTIT);
        doc.text(secTit.toUpperCase(), margin, y);
        y += 4;
      }

      var rows = [];
      var firstRow = true;
      campos.forEach(function (c) {
        var k = (c.campo && String(c.campo).trim()) ? prettyLabel(c.campo) : null;
        var v = cleanText(c.valor);

        if (!k && (!v || isEmptyVal(v))) return;

        if (k) {
          if (isEmptyVal(v)) return;
          if (!firstRow && /^dni$/i.test(k.trim())) {
            rows.push([
              { content: '', styles: { cellPadding: { top: 4, bottom: 0, left: 0, right: 0 }, lineWidth: 0 } },
              { content: '', styles: { cellPadding: { top: 4, bottom: 0, left: 0, right: 0 }, lineWidth: 0 } }
            ]);
          }
          rows.push([k, v]);
          firstRow = false;
        } else if (v && !isEmptyVal(v)) {
          var colonIdx = v.indexOf(':');
          if (colonIdx > 0 && colonIdx < 35) {
            var parsedKey = v.slice(0, colonIdx).trim();
            var parsedVal = v.slice(colonIdx + 1).trim();
            parsedKey = parsedKey.replace(/\s*\(\s*\d+\s*\)\s*$/, '').trim();
            if (parsedKey && parsedVal && !isEmptyVal(parsedVal)) {
              rows.push([prettyLabel(parsedKey), parsedVal]);
              return;
            }
            if (parsedKey && (!parsedVal || isEmptyVal(parsedVal))) return;
          }
          var isHeader = v.length < 40 && v === v.toUpperCase() && /[A-Z]/.test(v);
          if (isHeader) {
            rows.push([{ content: v, styles: { fontStyle: 'bold', textColor: C_SECTTIT, fontSize: 7 } }, { content: '', styles: { fontSize: 7 } }]);
          } else {
            rows.push(['', v]);
          }
        }
      });

      if (!rows.length) return;

      doc.autoTable({
        startY: y,
        head: [],
        body: rows,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 7,
          cellPadding: { top: 0.8, bottom: 0.8, left: 3, right: 3 },
          lineColor: C_BORDER,
          lineWidth: 0.1,
          overflow: 'linebreak',
          valign: 'middle',
          fontStyle: 'normal',
          minCellHeight: 0,
        },
        columnStyles: {
          0: { textColor: C_KEY, cellWidth: 50, fontStyle: 'normal', fontSize: 7 },
          1: { textColor: C_VALUE, fontStyle: 'bold', fontSize: 7 },
        },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        tableLineColor: C_BORDER,
        tableLineWidth: 0.1,
      });

      y = doc.lastAutoTable.finalY + 6;
    });

    // ── FILA DE FOTOS AL FINAL ───────────────────────────────
    if (photos && photos.length > 0) {
      var photoResult = addPhotosRow(doc, photos, pageW, pageH, margin, y, fecha, consultaNombre, pages);
      y = photoResult.y;
      pages = photoResult.pages;
    }

    // ── FOOTER ÚLTIMA PÁGINA ─────────────────────────────────
    // Actualizar número de páginas ahora que sabemos el total
    var totalPages = typeof doc.getNumberOfPages === 'function'
      ? doc.getNumberOfPages()
      : pages;
    for (var pg = 1; pg <= totalPages; pg++) {
      doc.setPage(pg);
      addPageFooter(doc, pageW, pageH, fecha, pg, totalPages);
    }

    // ── GENERAR BLOB ─────────────────────────────────────────
    var consultaSlug = consultaNombre
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-').toLowerCase()
      .slice(0, 40);
    var valorSlug = valor
      ? valor.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)
      : '';
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
