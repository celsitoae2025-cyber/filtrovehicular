/* ============================================================
   PDF REFRAME — reencuadra el PDF crudo del bot (/metapla) dentro
   de nuestra identidad institucional Filtro Vehicular+.

   No rehace ni reescribe el contenido: toma CADA página original
   completa (texto + todas las imágenes y escaneos), la reduce y la
   centra en una hoja A4 nueva, y dibuja nuestra franja superior
   (encabezado) e inferior (pie) alrededor, en todas las páginas.
   Así no se pierde ningún dato ni imagen y el documento queda con
   nuestra marca. Requiere pdf-lib (window.PDFLib).

   Colores institucionales FV+ (mismos que report-generator.js):
     Primario  #141d1c   Acento  #8fc72e

   Expone:
     Consultia.PdfReframe.reframe(base64, meta)
       → Promise<{ blobUrl, base64, filename }>   (no descarga)
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};

  // pdf-lib trabaja en puntos (1/72"). Colores en 0..1.
  function rgb01(r, g, b) { return window.PDFLib.rgb(r / 255, g / 255, b / 255); }
  var C_PRIMARY_RGB = [20, 29, 28];
  var C_ACCENT_RGB  = [143, 199, 46];
  var C_SUBHEAD_RGB = [200, 215, 212];

  function base64ToUint8(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function uint8ToBase64(bytes) {
    var chunk = 0x8000, parts = [];
    for (var i = 0; i < bytes.length; i += chunk) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
    }
    return btoa(parts.join(''));
  }

  function slugPlaca(v) {
    return String(v || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12);
  }

  async function reframe(base64, meta) {
    meta = meta || {};
    if (!window.PDFLib || !window.PDFLib.PDFDocument) return null;
    if (!base64) return null;

    var PDFLib = window.PDFLib;
    var srcDoc = await PDFLib.PDFDocument.load(base64ToUint8(base64), { ignoreEncryption: true });
    var out    = await PDFLib.PDFDocument.create();
    var helv   = await out.embedFont(PDFLib.StandardFonts.Helvetica);
    var helvB  = await out.embedFont(PDFLib.StandardFonts.HelveticaBold);

    var srcPages = srcDoc.getPages();
    var embedded = await out.embedPages(srcPages);

    // Hoja A4 vertical en puntos.
    var A4W = 595.28, A4H = 841.89;
    var M = 22;                  // margen lateral de textos del encabezado/pie
    var TOP_H = 58, BOT_H = 34;  // alto de las franjas
    var padX = 12, padY = 8;     // aire entre las franjas y la página incrustada

    var C_PRIMARY = rgb01.apply(null, C_PRIMARY_RGB);
    var C_ACCENT  = rgb01.apply(null, C_ACCENT_RGB);
    var C_SUBHEAD = rgb01.apply(null, C_SUBHEAD_RGB);
    var C_WHITE   = PDFLib.rgb(1, 1, 1);

    var fecha = meta.fecha || new Date().toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    var footerTxt = 'Documento generado por Filtro Vehicular+ · Información extraída de fuentes oficiales.';

    for (var i = 0; i < embedded.length; i++) {
      var ep   = embedded[i];
      var page = out.addPage([A4W, A4H]);

      // ── Franja superior (encabezado) ──
      page.drawRectangle({ x: 0, y: A4H - TOP_H, width: A4W, height: TOP_H, color: C_PRIMARY });
      page.drawRectangle({ x: 0, y: A4H - TOP_H - 2, width: A4W, height: 2, color: C_ACCENT });

      page.drawText('Filtro Vehicular+', { x: M, y: A4H - 28, size: 18, font: helvB, color: C_WHITE });
      var tituloW = helvB.widthOfTextAtSize('Filtro Vehicular+', 18);
      page.drawCircle({ x: M + tituloW + 4, y: A4H - 30, size: 1.6, color: C_ACCENT });
      page.drawText('PLATAFORMA DE CONSULTAS VEHICULARES', { x: M, y: A4H - 45, size: 7.5, font: helv, color: C_SUBHEAD });

      var fechaW = helv.widthOfTextAtSize(fecha, 7.5);
      page.drawText(fecha, { x: A4W - M - fechaW, y: A4H - 32, size: 7.5, font: helv, color: C_SUBHEAD });

      // ── Franja inferior (pie) ──
      page.drawRectangle({ x: 0, y: 0, width: A4W, height: BOT_H, color: C_PRIMARY });
      page.drawRectangle({ x: 0, y: BOT_H, width: A4W, height: 2, color: C_ACCENT });
      page.drawText(footerTxt, { x: M, y: BOT_H / 2 - 3, size: 7, font: helv, color: C_SUBHEAD });
      var pagLabel = 'Página ' + (i + 1) + ' de ' + embedded.length;
      var pagW = helv.widthOfTextAtSize(pagLabel, 7);
      page.drawText(pagLabel, { x: A4W - M - pagW, y: BOT_H / 2 - 3, size: 7, font: helv, color: C_SUBHEAD });

      // ── Página original incrustada (completa, proporción real, centrada) ──
      var topLimit = A4H - TOP_H - 2;   // borde superior del área de contenido
      var botLimit = BOT_H + 2;         // borde inferior del área de contenido
      var availW = A4W - 2 * padX;
      var availH = (topLimit - padY) - (botLimit + padY);
      var ow = ep.width, oh = ep.height;
      var scale = Math.min(availW / ow, availH / oh);
      var dw = ow * scale, dh = oh * scale;
      var x = (A4W - dw) / 2;
      var y = (botLimit + padY) + (availH - dh) / 2;
      page.drawPage(ep, { x: x, y: y, xScale: scale, yScale: scale });
    }

    var bytes = await out.save();
    var blob  = new Blob([bytes], { type: 'application/pdf' });
    var placa = slugPlaca(meta.valor);
    var filename = 'FiltroVehicular-Reporte' + (placa ? '-' + placa : '') + '.pdf';

    return {
      blobUrl: URL.createObjectURL(blob),
      base64: uint8ToBase64(bytes),
      filename: filename
    };
  }

  Consultia.PdfReframe = { reframe: reframe };
})();
