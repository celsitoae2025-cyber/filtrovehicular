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
    /* La fecha comparte línea base con la marca y lleva su rótulo encima,
       a la altura del subtítulo: así las dos columnas de la cabecera —marca
       a la izquierda, emisión a la derecha— quedan alineadas entre sí en
       vez de flotar cada una a su aire. */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, C_WHITE);
    doc.text(fecha, pageW - 18, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, C_SUBHEAD);
    doc.text('FECHA DE EMISIÓN', pageW - 18, 18, { align: 'right' });
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

  /* El pie no puede numerar mientras se dibuja: cuando se pinta la página 1
     todavía no se sabe cuántas habrá. Se sella al final, recorriendo el
     documento ya cerrado, que es la única forma de poner «2 de 5». */
  function sellarPaginas(doc) {
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var total = doc.internal.getNumberOfPages();
    for (var i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text(i + ' de ' + total, pageW - 18, pageH - 13 + 7.5, { align: 'right' });
    }
  }

  /* Cierre común: sella las páginas y devuelve lo que espera la interfaz.
     Estaba repetido en los siete generadores, cada uno con su variante. */
  function cerrarPdf(doc, nombre) {
    sellarPaginas(doc);
    var blob = doc.output('blob');
    return {
      blobUrl: URL.createObjectURL(blob),
      base64: doc.output('datauristring').split(',')[1],
      filename: nombre,
    };
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

    /* ── TÍTULO DEL INFORME ───────────────────────────────────
       Título, dato consultado y una regla fina que cierra el bloque y lo
       separa de la tabla. Antes el título y el dato quedaban a 5 mm de la
       primera fila: se leían como parte de la tabla, no como su cabecera. */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, C_TEXT);
    doc.text(cleanText(consultaNombre).toUpperCase(), M, 35);
    if (valor) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, C_KEY);
      doc.text('Dato consultado: ' + valor, M, 40.5);
    }
    doc.setDrawColor.apply(doc, C_BORDER);
    doc.setLineWidth(0.3);
    doc.line(M, 44, pageW - M, 44);

    // ── PRECARGA DE IMÁGENES (proporción real) ────────────────
    var imgInfos = (photos || []).map(function (ph) { return getImgDims(doc, ph); });
    var labels = ['Foto', 'Firma', 'Huella derecha', 'Huella izquierda'];

    // ── GEOMETRÍA: espacio reservado para imágenes (antes de la tabla,
    //    para que tabla + fotos entren en una sola hoja siempre que sea
    //    posible — igual que VeriNexo) ──────────────────────────────
    var bioMaxH = 34, bioTitleH = 7, bioLabelH = 5;
    var bioBlockH = imgInfos.length > 0 ? (bioTitleH + bioMaxH + bioLabelH + 8) : 0;
    var tableTop = 51;   // debajo de la regla que cierra el título
    var tableBottom = bottomBandTop - 6 - bioBlockH;

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

    /* Tamaño de texto fijo; si el contenido no entra en una hoja,
       jsPDF-autotable pagina solo (didDrawPage ya redibuja las franjas en
       cada página nueva) — no hace falta encoger la fuente para "caber".
       Estaba en 9pt con 2.5mm de relleno: el informe salía aireado y una
       ficha de RENIEC se iba a dos hojas por unas pocas filas. */
    var fontBody = 8;
    var cellPad = 1.6;

    // ── TABLA (franjas gris/blanco, sin bordes ni líneas; secciones en negrita) ──
    var body = rows.map(function (r) {
      if (r.tipo === 'seccion') {
        return [{ content: r.campo, colSpan: 2, styles: { fontStyle: 'bold', textColor: C_TEXT, cellPadding: { top: cellPad + 1.6, bottom: cellPad, left: 3, right: 0 }, lineWidth: 0, fillColor: C_WHITE } }];
      }
      if (r.tipo === 'info') {
        return [{ content: r.campo, colSpan: 2, styles: { fontStyle: 'italic', textColor: C_KEY, cellPadding: { top: cellPad + 0.5, bottom: cellPad + 0.5, left: 3, right: 0 } } }];
      }
      return [r.campo, r.valor];
    });

    if (body.length) {
      /* La tabla arranca siempre bajo el título. Antes, si el contenido era
         corto, se centraba verticalmente en la hoja: una ficha de cinco
         campos quedaba flotando en mitad de la página, lejos de su propio
         encabezado. Un informe se lee de arriba abajo. */
      doc.autoTable({
        startY: tableTop,
        body: body,
        margin: { left: M, right: M, top: 26, bottom: 16 },
        tableLineWidth: 0,
        didDrawPage: function () { drawTopBand(doc, pageW, fecha); drawBottomBand(doc, pageW, pageH, bottomBandTop); },
        bodyStyles: {
          fontSize: fontBody, textColor: C_TEXT,
          cellPadding: { top: cellPad, bottom: cellPad, left: 3, right: 5 },
          lineWidth: 0, valign: 'middle',
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 0: { cellWidth: 55, textColor: C_KEY }, 1: { cellWidth: 'auto' } },
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

    return cerrarPdf(doc, filename);
  }

  // ── Verificación Policial: escudo PNP + foto del titular + bloques
  //    de info personal/policial. Portado de generarPdfPolicial de
  //    VeriNexo, colores propios de FV+. ─────────────────────────────
  function generatePolicial(campos, valorConsultado, photos) {
    if (!window.jspdf || !window.jspdf.jsPDF) return null;
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    var W = doc.internal.pageSize.getWidth();
    var M = 22;
    var GRIS_CLARO = [235, 237, 240];

    var ahora = new Date();
    var fechaStr = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var horaStr = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    var fechaFile = ahora.getFullYear() + String(ahora.getMonth() + 1).padStart(2, '0') + String(ahora.getDate()).padStart(2, '0');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor.apply(doc, C_PRIMARY);
    doc.text('Filtro Vehicular+', M, 16);
    doc.setFillColor.apply(doc, C_ACCENT);
    doc.circle(M + doc.getTextWidth('Filtro Vehicular+') + 1.6, 13.8, 0.7, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor.apply(doc, C_KEY);
    doc.text('PLATAFORMA DE CONSULTAS VEHICULARES', M, 20);
    doc.text(fechaStr + '  ·  ' + horaStr, W - M, 16, { align: 'right' });
    doc.setDrawColor.apply(doc, C_ACCENT);
    doc.setLineWidth(0.35);
    doc.line(M, 24, W - M, 24);

    return loadPngDataUrl('icons/pnp-logo.png').then(function (logoDataUrl) {
      var y = 38;
      if (logoDataUrl) {
        var logoW = 15, logoH = logoW / 0.816;
        doc.addImage(logoDataUrl, 'PNG', W / 2 - logoW / 2, y, logoW, logoH, undefined, 'FAST');
        y += logoH + 6;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor.apply(doc, C_PRIMARY);
      doc.text('Verificación Policial', W / 2, y, { align: 'center' });
      y += 5.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, C_KEY);
      doc.text('Fecha de consulta: ' + fechaStr + ' ' + horaStr, W / 2, y, { align: 'center' });
      y += 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor.apply(doc, C_PRIMARY);
      var textoConfirm = 'Es miembro de la Policía Nacional del Perú';
      var textW = doc.getTextWidth(textoConfirm);
      var checkH = 3.6, gap = 2.6;
      var startX = W / 2 - (checkH + gap + textW) / 2;
      var baseY = y;
      doc.setDrawColor.apply(doc, C_PRIMARY);
      doc.setLineWidth(0.7);
      doc.line(startX, baseY - 1.2, startX + checkH * 0.35, baseY + 0.4);
      doc.line(startX + checkH * 0.35, baseY + 0.4, startX + checkH, baseY - 2.2);
      doc.text(textoConfirm, startX + checkH + gap, baseY, { align: 'left' });
      y += 5;
      doc.setDrawColor.apply(doc, GRIS_CLARO);
      doc.setLineWidth(0.3);
      doc.line(W / 2 - 45, y, W / 2 + 45, y);
      y += 11;

      var fotoPromise = Promise.resolve();
      var foto = photos && photos[0];
      if (foto) {
        var fotoSrc = 'data:' + (foto.mimeType || 'image/jpeg') + ';base64,' + foto.base64;
        fotoPromise = new Promise(function (resolve) {
          var im = new Image();
          im.onload = function () {
            var fotoH = 34;
            var fotoW = fotoH * ((im.naturalWidth || 100) / (im.naturalHeight || 100));
            var fx = W / 2 - fotoW / 2;
            doc.setDrawColor.apply(doc, GRIS_CLARO);
            doc.setLineWidth(0.4);
            doc.rect(fx - 0.8, y - 0.8, fotoW + 1.6, fotoH + 1.6);
            try {
              var fmt = (foto.mimeType || 'image/jpeg').indexOf('png') !== -1 ? 'PNG' : 'JPEG';
              doc.addImage(fotoSrc, fmt, fx, y, fotoW, fotoH, undefined, 'FAST');
            } catch (e) { /* noop */ }
            y += fotoH + 12;
            resolve();
          };
          im.onerror = function () { resolve(); };
          im.src = fotoSrc;
        });
      }

      return fotoPromise.then(function () {
        var mapa = {};
        (campos || []).forEach(function (f) { if (f.campo) mapa[String(f.campo).trim().toLowerCase()] = f.valor; });
        function val(k) { return mapa[k.toLowerCase()] || ''; }

        function dibujarBloque(titulo, pares) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor.apply(doc, C_PRIMARY);
          doc.text(titulo.toUpperCase(), M, y);
          y += 2.2;
          doc.setDrawColor.apply(doc, C_PRIMARY);
          doc.setLineWidth(0.5);
          doc.line(M, y, M + 16, y);
          y += 6;
          pares.forEach(function (pair) {
            var campo = pair[0], valor = pair[1];
            if (!valor) return;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor.apply(doc, C_KEY);
            doc.text(campo.toUpperCase(), M, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor.apply(doc, C_TEXT);
            doc.text(valor, M + 50, y);
            y += 4.5;
            doc.setDrawColor.apply(doc, GRIS_CLARO);
            doc.setLineWidth(0.2);
            doc.line(M, y, W - M, y);
            y += 5.5;
          });
          y += 6;
        }

        dibujarBloque('Información personal', [
          ['DNI', val('DNI')], ['Nombre Completo', val('Nombre Completo')],
          ['Fecha de Nacimiento', val('Fecha de Nacimiento')], ['Edad', val('Edad')], ['Sexo', val('Sexo')],
        ]);
        dibujarBloque('Información policial', [
          ['CIP', val('CIP')], ['Grado', val('Grado')], ['Estado', val('Estado')],
          ['Situación', val('Situación') || val('Situacion')], ['Parentesco', val('Parentesco')],
          ['Fecha de Caducidad', val('Fecha de Caducidad')], ['Unidad', val('Unidad')],
        ]);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor.apply(doc, C_KEY);
        doc.text('Generado por Filtro Vehicular+ · Información extraída de fuentes oficiales.', W / 2, 285, { align: 'center' });

        var nombre = 'VerificacionPolicial-' + (valorConsultado || '').replace(/[^a-zA-Z0-9]/g, '') + '-' + fechaFile + '.pdf';
        return cerrarPdf(doc, nombre);
      });
    });
  }

  // Carga un PNG local y lo convierte a data URL vía canvas (jsPDF
  // necesita base64/data URL, no una ruta de archivo).
  function loadPngDataUrl(path) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          var ctx = c.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = path;
    });
  }

  // ── Reconocimiento Facial: mejor coincidencia destacada + tabla con
  //    foto por candidato. Portado de generarPdfFacial de VeriNexo. ──
  function generateFacial(candidatos, valorConsultado) {
    if (!window.jspdf || !window.jspdf.jsPDF) return null;
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    var W = doc.internal.pageSize.getWidth();
    var H = doc.internal.pageSize.getHeight();
    var M = 18;
    var VERDE = [78, 117, 25];       // #4e7519 — contraste AA sobre blanco
    var VERDE_BG = [235, 248, 220];
    var GRIS_CLARO = [226, 232, 240];

    var ahora = new Date();
    var fechaStr = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var horaStr = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    var fechaFile = ahora.getFullYear() + String(ahora.getMonth() + 1).padStart(2, '0') + String(ahora.getDate()).padStart(2, '0');

    function dibujarEncabezado() {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor.apply(doc, C_PRIMARY);
      doc.text('Filtro Vehicular+', M, 16);
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.circle(M + doc.getTextWidth('Filtro Vehicular+') + 1.6, 13.8, 0.7, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.3);
      doc.setTextColor.apply(doc, C_KEY);
      doc.text('PLATAFORMA DE CONSULTAS VEHICULARES', M, 20);
      doc.text(fechaStr + '  ·  ' + horaStr, W - M, 16, { align: 'right' });
      doc.setDrawColor.apply(doc, C_ACCENT);
      doc.setLineWidth(0.35);
      doc.line(M, 24, W - M, 24);
    }
    function dibujarPie() {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor.apply(doc, C_KEY);
      doc.text('Generado por Filtro Vehicular+', W / 2, H - 10, { align: 'center' });
    }
    function pctNum(s) { var n = parseFloat(String(s || '').replace(/[^\d.]/g, '')); return isNaN(n) ? 0 : n; }

    var ratioPromises = candidatos.map(function (c) {
      if (!c.foto || !c.foto.base64) return Promise.resolve(null);
      return new Promise(function (resolve) {
        var im = new Image();
        im.onload = function () { resolve((im.naturalWidth || 1) / (im.naturalHeight || 1)); };
        im.onerror = function () { resolve(null); };
        im.src = 'data:' + (c.foto.mime || 'image/jpeg') + ';base64,' + c.foto.base64;
      });
    });

    return Promise.all(ratioPromises).then(function (ratios) {
      var idxMax = 0;
      candidatos.forEach(function (c, i) { if (pctNum(c.similitud) > pctNum(candidatos[idxMax].similitud)) idxMax = i; });
      var mejor = candidatos[idxMax];

      dibujarEncabezado();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor.apply(doc, C_PRIMARY);
      doc.text('Reconocimiento Facial', M, 34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, C_KEY);
      doc.text('Análisis biométrico  ·  ' + candidatos.length + ' coincidencias  ·  ' + fechaStr + ' ' + horaStr, M, 39);

      var boxY = 44, boxH = 30;
      doc.setFillColor.apply(doc, VERDE_BG);
      doc.setDrawColor.apply(doc, VERDE);
      doc.setLineWidth(0.4);
      doc.roundedRect(M, boxY, W - M * 2, boxH, 2, 2, 'FD');

      var bfBoxW = 20, bfBoxH = boxH - 8;
      var bfRatio = ratios[idxMax] || 0.78;
      var bfW = bfBoxW, bfH = bfW / bfRatio;
      if (bfH > bfBoxH) { bfH = bfBoxH; bfW = bfH * bfRatio; }
      var bfX = M + 5, bfY = boxY + (boxH - bfH) / 2;
      if (mejor.foto && mejor.foto.base64) {
        try { doc.addImage('data:' + (mejor.foto.mime || 'image/jpeg') + ';base64,' + mejor.foto.base64, 'JPEG', bfX, bfY, bfW, bfH, undefined, 'FAST'); } catch (e) { /* noop */ }
      }

      var infoX = M + 5 + bfBoxW + 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor.apply(doc, VERDE);
      doc.text('MEJOR COINCIDENCIA', infoX, boxY + 7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor.apply(doc, C_PRIMARY);
      doc.text(String(mejor.nombres || '—'), infoX, boxY + 14, { maxWidth: W - M * 2 - bfBoxW - 55 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, C_TEXT);
      var li = [mejor.dni && ('DNI: ' + mejor.dni), mejor.edad && ('Edad: ' + mejor.edad), mejor.confianza && ('Confianza: ' + mejor.confianza)].filter(Boolean).join('     ');
      doc.text(li, infoX, boxY + 20);
      if (mejor.ubigeo) doc.text(mejor.ubigeo, infoX, boxY + 25, { maxWidth: W - M * 2 - bfBoxW - 55 });

      var badgeW = 34, badgeH = 16;
      var badgeX = W - M - badgeW - 4, badgeY = boxY + (boxH - badgeH) / 2;
      doc.setFillColor.apply(doc, VERDE);
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(String(mejor.similitud || ''), badgeX + badgeW / 2, badgeY + 8, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('SIMILITUD', badgeX + badgeW / 2, badgeY + 12.5, { align: 'center' });

      var tablaTitY = boxY + boxH + 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, C_PRIMARY);
      doc.text('TODAS LAS COINCIDENCIAS', M, tablaTitY);
      doc.setDrawColor.apply(doc, C_PRIMARY);
      doc.setLineWidth(0.5);
      doc.line(M, tablaTitY + 1.8, M + 32, tablaTitY + 1.8);

      var colFotoW = 15, fotoBoxH = 16, rowHpx = fotoBoxH + 3;
      var head = [['#', 'FOTO', 'DNI', 'NOMBRES', 'EDAD', 'UBIGEO', 'CONFIANZA', 'SIMILITUD']];
      var bodyRows = candidatos.map(function (c) { return [String(c.num), '', c.dni, c.nombres, c.edad, c.ubigeo, c.confianza, c.similitud]; });

      doc.autoTable({
        startY: tablaTitY + 5,
        head: head, body: bodyRows,
        margin: { left: M, right: M, top: 30, bottom: 14 },
        tableWidth: W - M * 2,
        didDrawPage: function () { dibujarEncabezado(); dibujarPie(); },
        headStyles: { fillColor: C_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }, halign: 'left' },
        bodyStyles: { fontSize: 7, textColor: C_TEXT, cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, minCellHeight: rowHpx, valign: 'middle', lineWidth: 0.1, lineColor: GRIS_CLARO },
        alternateRowStyles: { fillColor: [247, 249, 251] },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center', textColor: C_KEY }, 1: { cellWidth: colFotoW, halign: 'center' },
          2: { cellWidth: 20 }, 3: { cellWidth: 'auto', fontStyle: 'bold', textColor: C_PRIMARY },
          4: { cellWidth: 12, halign: 'center' }, 5: { cellWidth: 'auto' },
          6: { cellWidth: 20 }, 7: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 7 && data.row.index === idxMax) data.cell.styles.textColor = VERDE;
        },
        didDrawCell: function (data) {
          if (data.section === 'body' && data.column.index === 1) {
            var c = candidatos[data.row.index];
            if (c && c.foto && c.foto.base64) {
              var ratio = ratios[data.row.index] || 0.78;
              var boxW = colFotoW - 3;
              var boxH2 = Math.min(fotoBoxH, data.cell.height - 2);
              var dW = boxW, dH = dW / ratio;
              if (dH > boxH2) { dH = boxH2; dW = dH * ratio; }
              var cx = data.cell.x + (data.cell.width - dW) / 2;
              var cy = data.cell.y + (data.cell.height - dH) / 2;
              try { doc.addImage('data:' + (c.foto.mime || 'image/jpeg') + ';base64,' + c.foto.base64, 'JPEG', cx, cy, dW, dH, undefined, 'FAST'); } catch (e) { /* noop */ }
            }
          }
        },
      });

      var idBase = (mejor.nombres || mejor.dni || valorConsultado || 'resultado').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
      var nombre = 'ReconocimientoFacial_' + idBase + '_' + fechaFile + '.pdf';
      return cerrarPdf(doc, nombre);
    });
  }

  // ── Tabla (árbol genealógico / homónimos): tabla completa con
  //    cabecera institucional. Portado de generarPdfTabla de VeriNexo. ─
  function generateTabla(tabla, valorConsultado, etiquetaConsulta) {
    if (!window.jspdf || !window.jspdf.jsPDF) return null;
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    var W = doc.internal.pageSize.getWidth();
    var H = doc.internal.pageSize.getHeight();
    var M = 8;
    var bottomBandTop = H - 13;

    var ahora = new Date();
    var fechaStr = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var horaStr = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    var fechaFile = ahora.getFullYear() + String(ahora.getMonth() + 1).padStart(2, '0') + String(ahora.getDate()).padStart(2, '0');

    function drawTopBandT() {
      doc.setFillColor.apply(doc, C_PRIMARY);
      doc.rect(0, 0, W, 22, 'F');
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(0, 22, W, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(19);
      doc.setTextColor(255, 255, 255);
      doc.text('Filtro Vehicular+', M, 13);
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.circle(M + doc.getTextWidth('Filtro Vehicular+') + 2.2, 11.2, 0.9, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text('PLATAFORMA DE CONSULTAS VEHICULARES', M, 18);
      doc.text(fechaStr + '  ·  ' + horaStr, W - M, 14, { align: 'right' });
    }
    function drawBottomBandT() {
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(0, bottomBandTop - 1, W, 1, 'F');
      doc.setFillColor.apply(doc, C_PRIMARY);
      doc.rect(0, bottomBandTop, W, H - bottomBandTop, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text('Documento generado por Filtro Vehicular+ · Información extraída de fuentes oficiales.', M, bottomBandTop + 7.5);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor.apply(doc, C_TEXT);
    doc.text(etiquetaConsulta || tabla.titulo || 'Resultados', M, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, C_KEY);
    var subtitulo = valorConsultado ? ('Consulta: ' + valorConsultado + '  ·  Total: ' + tabla.total + ' resultados') : ('Total: ' + tabla.total + ' resultados');
    doc.text(subtitulo, M, 39.5);

    var columnaValor = Consultia.RenderHelpers.columnaValor;
    var head = [tabla.columnas];
    var bodyRows = tabla.filas.map(function (f) { return tabla.columnas.map(function (col) { return columnaValor(col, f); }); });

    var ANCHO_COL = {
      '#': { cellWidth: 10, halign: 'center' }, 'RELACIÓN': { cellWidth: 'auto' }, 'TIPO': { cellWidth: 'auto' },
      'DNI': { cellWidth: 24 }, 'NOMBRES': { cellWidth: 'auto' }, 'APELLIDOS': { cellWidth: 'auto' },
      'NACIMIENTO': { cellWidth: 26 }, 'EDAD': { cellWidth: 22 }, 'GÉNERO': { cellWidth: 28 }, 'GENERO': { cellWidth: 28 },
    };
    var columnStyles = {};
    tabla.columnas.forEach(function (col, i) { columnStyles[i] = ANCHO_COL[col.trim().toUpperCase()] || { cellWidth: 'auto' }; });

    var MARGEN_TABLA = 8;
    doc.autoTable({
      startY: 45, head: head, body: bodyRows,
      tableWidth: W - MARGEN_TABLA * 2,
      margin: { left: MARGEN_TABLA, right: MARGEN_TABLA, top: 26, bottom: 16 },
      didDrawPage: function () { drawTopBandT(); drawBottomBandT(); },
      headStyles: { fillColor: C_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.3, cellPadding: 1.5 },
      bodyStyles: { fontSize: 6.3, textColor: C_TEXT, cellPadding: 1.3, lineWidth: 0, valign: 'middle' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: columnStyles,
      styles: { overflow: 'linebreak', lineWidth: 0 },
    });

    var slug = (etiquetaConsulta || tabla.titulo || 'Resultados').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]/g, '');
    var nombre = slug + '_' + (valorConsultado || '').replace(/[^a-zA-Z0-9]/g, '') + '_' + fechaFile + '.pdf';
    return cerrarPdf(doc, nombre);
  }

  // ── Búsqueda por nombre (/nm): tabla de personas en horizontal ──
  // `regs` son los registros normalizados por RenderHelpers (nmRecord).
  function generateNm(regs, meta) {
    if (!window.jspdf || !window.jspdf.jsPDF) return null;
    if (!regs || !regs.length) return null;
    meta = meta || {};

    var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = doc.internal.pageSize.getWidth();   // 210
    var H = doc.internal.pageSize.getHeight();  // 297
    var M = 8;
    var bottomBandTop = H - 12;

    var ahora = new Date();
    var fechaStr = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var horaStr = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    var fechaFile = ahora.getFullYear() + String(ahora.getMonth() + 1).padStart(2, '0') + String(ahora.getDate()).padStart(2, '0');

    function bandas() {
      doc.setFillColor.apply(doc, C_PRIMARY);
      doc.rect(0, 0, W, 20, 'F');
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(0, 20, W, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(255, 255, 255);
      doc.text('Filtro Vehicular+', M, 12);
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.circle(M + doc.getTextWidth('Filtro Vehicular+') + 2, 10.3, 0.85, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text('PLATAFORMA DE CONSULTAS VEHICULARES', M, 17);
      doc.text(fechaStr + '  ·  ' + horaStr, W - M, 13, { align: 'right' });

      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(0, bottomBandTop - 1, W, 1, 'F');
      doc.setFillColor.apply(doc, C_PRIMARY);
      doc.rect(0, bottomBandTop, W, H - bottomBandTop, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text('Documento generado por Filtro Vehicular+ · Información extraída de fuentes oficiales.', M, bottomBandTop + 7);
    }

    var valor = (meta.valor || '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    var total = meta.total || String(regs.length);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, C_TEXT);
    doc.text('BÚSQUEDA DE PERSONAS POR NOMBRE', M, 31);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, C_KEY);
    doc.text(
      (valor ? 'Consulta: ' + valor + '  ·  ' : '') +
      'Total resultados: ' + total + '  ·  Registros en este informe: ' + regs.length,
      M, 37
    );

    // Sin columna "PERSONA": duplicaba el índice que ya da "Nº" (mismo
    // criterio que la tabla en pantalla).
    var head = [['Nº', 'Nº DNI', 'NOMBRES', 'AP. PATERNO', 'AP. MATERNO', 'EDAD', 'SEXO', 'DPTO', 'PROVINCIA', 'DISTRITO']];
    var body = regs.map(function (r, i) {
      return [
        String(i + 1), r.dni || '', r.nombres || '',
        r.apPat || '', r.apMat || '', r.edad || '', r.sexo || '',
        r.dpto || '', r.prov || '', r.dist || ''
      ];
    });

    // Anchos recalculados para A4 vertical: 210mm - 2*8 de margen = 194mm.
    doc.autoTable({
      startY: 42, head: head, body: body,
      tableWidth: W - M * 2,
      margin: { left: M, right: M, top: 26, bottom: 15 },
      didDrawPage: bandas,
      headStyles: { fillColor: C_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.4, cellPadding: 1.2 },
      bodyStyles: { fontSize: 5.7, textColor: C_TEXT, cellPadding: 1.1, lineWidth: 0, valign: 'middle' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 18 },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 24 },
        5: { cellWidth: 9,  halign: 'center' },
        6: { cellWidth: 15 },
        7: { cellWidth: 18 },
        8: { cellWidth: 19 },
        9: { cellWidth: 'auto' }
      },
      styles: { overflow: 'linebreak', lineWidth: 0 },
    });

    var nombre = 'Busqueda_Personas_' + (valor.replace(/[^A-Z0-9]/g, '') || 'NOMBRE') + '_' + fechaFile + '.pdf';
    return cerrarPdf(doc, nombre);
  }

  // ── Árbol genealógico (/ag): listado de familiares en horizontal ──
  function generateArbol(regs, meta) {
    if (!window.jspdf || !window.jspdf.jsPDF) return null;
    if (!regs || !regs.length) return null;
    meta = meta || {};

    var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = doc.internal.pageSize.getWidth();   // 210
    var H = doc.internal.pageSize.getHeight();  // 297
    var M = 8;
    var bottomBandTop = H - 12;

    var ahora = new Date();
    var fechaStr = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var horaStr = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    var fechaFile = ahora.getFullYear() + String(ahora.getMonth() + 1).padStart(2, '0') + String(ahora.getDate()).padStart(2, '0');

    function bandas() {
      doc.setFillColor.apply(doc, C_PRIMARY);
      doc.rect(0, 0, W, 20, 'F');
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(0, 20, W, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(255, 255, 255);
      doc.text('Filtro Vehicular+', M, 12);
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.circle(M + doc.getTextWidth('Filtro Vehicular+') + 2, 10.3, 0.85, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text('PLATAFORMA DE CONSULTAS VEHICULARES', M, 17);
      doc.text(fechaStr + '  ·  ' + horaStr, W - M, 13, { align: 'right' });

      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(0, bottomBandTop - 1, W, 1, 'F');
      doc.setFillColor.apply(doc, C_PRIMARY);
      doc.rect(0, bottomBandTop, W, H - bottomBandTop, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text('Documento generado por Filtro Vehicular+ · Información extraída de fuentes oficiales.', M, bottomBandTop + 7);
    }

    var valor = (meta.valor || '').trim();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, C_TEXT);
    doc.text('ÁRBOL GENEALÓGICO', M, 31);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, C_KEY);
    doc.text(
      (valor ? 'DNI consultado: ' + valor + '  ·  ' : '') + 'Familiares encontrados: ' + regs.length,
      M, 37
    );

    var head = [['Nº', 'Nº DNI', 'NOMBRES', 'APELLIDOS', 'EDAD', 'SEXO', 'RELACIÓN', 'VERIFICACIÓN']];
    var body = regs.map(function (r, i) {
      return [String(i + 1), r.dni || '', r.nombres || '', r.apellidos || '', r.edad || '', r.sexo || '', r.relacion || '', r.verificacion || ''];
    });

    // Anchos recalculados para A4 vertical: 210mm - 2*8 de margen = 194mm.
    doc.autoTable({
      startY: 42, head: head, body: body,
      tableWidth: W - M * 2,
      margin: { left: M, right: M, top: 26, bottom: 15 },
      didDrawPage: bandas,
      headStyles: { fillColor: C_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.8, cellPadding: 1.3 },
      bodyStyles: { fontSize: 6.1, textColor: C_TEXT, cellPadding: 1.2, lineWidth: 0, valign: 'middle' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 20 },
        2: { cellWidth: 34 },
        3: { cellWidth: 36 },
        4: { cellWidth: 10, halign: 'center' },
        5: { cellWidth: 18 },
        6: { cellWidth: 30 },
        7: { cellWidth: 'auto' }
      },
      styles: { overflow: 'linebreak', lineWidth: 0 },
    });

    var nombre = 'Arbol_Genealogico_' + (valor.replace(/[^A-Za-z0-9]/g, '') || 'DNI') + '_' + fechaFile + '.pdf';
    return cerrarPdf(doc, nombre);
  }

  // ── Historial de consumos ──────────────────────────────────
  // El informe de todo lo que el cliente ha gastado. `filas` llega ya
  // preparada desde my-transactions.js —que es quien sabe traducir un
  // `description` como "vehiculos / placa" a algo legible— y aquí solo
  // se dibuja. Cada fila: { n, fecha, modulo, tipo, creditos }.
  function generateHistorial(filas, meta) {
    if (!window.jspdf || !window.jspdf.jsPDF) return null;
    if (!filas || !filas.length) return null;
    meta = meta || {};

    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    var W = doc.internal.pageSize.getWidth();
    var H = doc.internal.pageSize.getHeight();
    var M = 14;
    var bottomBandTop = H - 13;

    var ahora = new Date();
    var fechaStr = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var horaStr  = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    var fechaFile = ahora.getFullYear() +
      String(ahora.getMonth() + 1).padStart(2, '0') +
      String(ahora.getDate()).padStart(2, '0');

    // El total se suma aquí y no se recibe hecho: si alguna vez se
    // filtra la lista antes de imprimirla, el resumen tiene que hablar
    // de lo que se imprime, no de lo que había.
    var totalCreditos = filas.reduce(function (acc, f) {
      return acc + (Math.abs(Number(f.creditos)) || 0);
    }, 0);

    function bandaSuperior() {
      doc.setFillColor.apply(doc, C_PRIMARY);
      doc.rect(0, 0, W, 22, 'F');
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(0, 22, W, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(19);
      doc.setTextColor.apply(doc, C_WHITE);
      doc.text('Filtro Vehicular+', M, 13);
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.circle(M + doc.getTextWidth('Filtro Vehicular+') + 2.2, 11.2, 0.9, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text('HISTORIAL DE CONSUMOS', M, 18);
      doc.text(fechaStr + '  ·  ' + horaStr, W - M, 14, { align: 'right' });
    }

    function bandaInferior() {
      doc.setFillColor.apply(doc, C_ACCENT);
      doc.rect(0, bottomBandTop - 1, W, 1, 'F');
      doc.setFillColor.apply(doc, C_PRIMARY);
      doc.rect(0, bottomBandTop, W, H - bottomBandTop, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor.apply(doc, C_SUBHEAD);
      doc.text('Documento generado por Filtro Vehicular+ · Resumen de consumo de créditos.', M, bottomBandTop + 7.5);
      // La paginación se pinta en la última pasada, cuando ya se sabe
      // cuántas páginas hay: aquí solo cabe el número de la actual.
      doc.text('Página ' + doc.internal.getNumberOfPages(), W - M, bottomBandTop + 7.5, { align: 'right' });
    }

    // ── Portada de la primera página ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor.apply(doc, C_TEXT);
    doc.text('Historial de consumos', M, 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, C_KEY);
    var quien = meta.nombre || meta.email || '';
    if (quien) doc.text(quien, M, 40);

    // Tres cifras en una banda clara. Es lo que se mira primero y por
    // eso va antes de la tabla y no al final.
    var resumenY = quien ? 45 : 39;
    doc.setFillColor(245, 247, 250);
    doc.rect(M, resumenY, W - M * 2, 16, 'F');
    doc.setDrawColor.apply(doc, C_BORDER);
    doc.setLineWidth(0.2);
    doc.rect(M, resumenY, W - M * 2, 16, 'S');

    var anchoTercio = (W - M * 2) / 3;
    var cifras = [
      ['CONSULTAS', String(filas.length)],
      ['CRÉDITOS CONSUMIDOS', String(totalCreditos)],
      ['PERIODO', (meta.desde || '—') + '  a  ' + (meta.hasta || '—')]
    ];
    cifras.forEach(function (c, i) {
      var x = M + anchoTercio * i + 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor.apply(doc, C_KEY);
      doc.text(c[0], x, resumenY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(i === 2 ? 8 : 12);
      doc.setTextColor.apply(doc, C_TEXT);
      doc.text(c[1], x, resumenY + 12.5);
    });

    // ── La tabla ──
    doc.autoTable({
      startY: resumenY + 22,
      head: [['#', 'FECHA Y HORA', 'MÓDULO', 'TIPO DE CONSULTA', 'CRÉDITOS']],
      body: filas.map(function (f) {
        return [
          String(f.n),
          f.fecha || '',
          f.modulo || '',
          f.tipo || '—',
          String(Math.abs(Number(f.creditos)) || 0)
        ];
      }),
      // El margen superior deja libre la banda de cabecera en las
      // páginas siguientes; el inferior, la del pie.
      margin: { left: M, right: M, top: 28, bottom: 18 },
      didDrawPage: function () { bandaSuperior(); bandaInferior(); },
      headStyles: {
        fillColor: C_PRIMARY, textColor: C_WHITE,
        fontStyle: 'bold', fontSize: 7, cellPadding: 2.2
      },
      bodyStyles: {
        fontSize: 7.4, textColor: C_TEXT,
        cellPadding: 2, lineWidth: 0, valign: 'middle'
      },
      alternateRowStyles: { fillColor: [247, 249, 251] },
      columnStyles: {
        0: { cellWidth: 11, halign: 'center', textColor: C_KEY },
        1: { cellWidth: 36 },
        2: { cellWidth: 30, fontStyle: 'bold' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
      },
      styles: { overflow: 'linebreak', lineWidth: 0 }
    });

    // Cierre bajo la tabla, solo si cabe. Si la tabla acaba pegada al
    // pie no se fuerza una página entera para dos líneas.
    var finY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 0;
    if (finY && finY + 14 < bottomBandTop) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, C_TEXT);
      doc.text('TOTAL CONSUMIDO: ' + totalCreditos + ' créditos', W - M, finY + 7, { align: 'right' });
    }

    return cerrarPdf(doc, 'Historial_consumos_' + fechaFile + '.pdf');
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

  Consultia.ReportGenerator = {
    generate: generate,
    generatePolicial: generatePolicial,
    generateFacial: generateFacial,
    generateTabla: generateTabla,
    generateNm: generateNm,
    generateArbol: generateArbol,
    generateHistorial: generateHistorial,
    download: download,
  };
})();
