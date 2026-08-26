/* ============================================================
   METAPLA REPORT — Reporte Vehicular Integral.

   Lee el PDF que devuelve el bot, recupera su contenido completo
   (texto con posición + imágenes incrustadas) y vuelve a componer
   el documento con identidad propia: sin franjas de color, con
   membrete fino, retícula amplia y jerarquía tipográfica.

   Pipeline:
     1. extractFromPdf()  — pdf.js: líneas con posición e imágenes
     2. parseSections()   — secciones I…XI, campos y tablas
     3. buildPdf()        — jsPDF + autoTable, maquetación editorial

   Paleta institucional: #141d1c · #8fc72e · blancos y grises.

   Expone:
     Consultia.MetaplaReport.generate(pdfBase64, meta, onProgress)
       → Promise<{ blobUrl, base64, filename }>
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};

  // ── Paleta ─────────────────────────────────────────────────
  var C_INK    = [20, 29, 28];     // #141d1c — texto principal
  var C_ACCENT = [143, 199, 46];   // #8fc72e — verde institucional
  var C_TURQ   = [3, 167, 164];    // #03a7a4 — turquesa, segundo acento
  var C_MUTED  = [122, 130, 128];  // etiquetas y textos secundarios
  var C_HAIR   = [223, 227, 222];  // filetes y separadores
  var C_SOFT   = [248, 250, 247];  // fondos muy tenues

  // Semáforo del índice de riesgo. Los tres salen de la línea de cuatro
  // colores de la marca, la que va bajo el nombre en la pantalla de
  // acceso: aquí no hay colores inventados para el semáforo.
  var C_OK     = [143, 199, 46];   // #8fc72e — riesgo bajo
  var C_WARN   = [255, 176, 32];   // #ffb020 — riesgo medio
  var C_BAD    = [229, 57, 53];    // #e53935 — riesgo alto

  /* El color del índice dice el riesgo de un vistazo, con el código que
     entiende cualquiera sin leer: verde bajo, ámbar medio, rojo alto.

     Antes iba en verde, turquesa y oscuro, por no salirse de los tres
     colores de marca. Quedaba bonito y no comunicaba: un reporte de
     riesgo alto se veía igual de tranquilo que uno de riesgo bajo, y el
     turquesa del medio no decía nada. El ámbar y el rojo son los otros
     dos colores de la línea de marca, así que la casa sigue estando.

     Sin nivel no se inventa uno: el puntaje lo pone el proveedor y no
     está dicho en qué dirección corre —hay reportes de 76 sobre 100
     etiquetados «medio»—, así que se pinta en el oscuro neutro y se deja
     que mande el texto. */
  function riskColor(nivel) {
    var n = String(nivel || '').toUpperCase();
    if (/BAJO|LEVE|M[IÍ]NIM/.test(n)) return C_OK;
    if (/MEDIO|MODERAD|INTERMEDI/.test(n)) return C_WARN;
    if (/ALTO|CR[IÍ]TIC|GRAVE|SEVER/.test(n)) return C_BAD;
    return C_INK;
  }

  // Las tres respuestas se dicen con la misma palabra en el PDF y en la
  // pantalla. Si una dice «Sí» y la otra «Correcto», parecen dos cosas.
  /* ── El QR ───────────────────────────────────────────────────────
     Se dibuja módulo a módulo con rectángulos, no como imagen. Un QR
     rasterizado a 16 mm se emborrona al imprimir y hay lectores que ya
     no lo cogen; en vectores sale nítido a cualquier tamaño y ocupa una
     fracción.

     Si la librería no cargó, no se dibuja nada y el folio impreso sigue
     sirviendo para verificar a mano. Un hueco es mejor que un cuadrado
     que no se puede leer. */
  function dibujarQR(doc, texto, x, y, lado) {
    if (typeof qrcode !== 'function') return false;
    var q;
    try {
      q = qrcode(0, 'M');          // versión automática, corrección media
      q.addData(texto);
      q.make();
    } catch (e) {
      console.warn('[metapla] no se pudo armar el QR:', e);
      return false;
    }
    var n = q.getModuleCount();
    var celda = lado / n;
    doc.setFillColor(20, 29, 28);
    for (var f = 0; f < n; f++) {
      for (var c = 0; c < n; c++) {
        if (!q.isDark(f, c)) continue;
        /* Un pelo de solape entre módulos: sin él, el redondeo del
           visor deja rayas blancas entre columnas y el lector falla. */
        doc.rect(x + c * celda, y + f * celda, celda + 0.02, celda + 0.02, 'F');
      }
    }
    return true;
  }

  function palabra(estado) {
    return estado === 'si' ? 'Sí' : (estado === 'no' ? 'No' : 'Con reparos');
  }

  function estadoColor(estado) {
    if (estado === 'si') return C_OK;
    if (estado === 'no') return C_BAD;
    return C_WARN;
  }

  var ROMANS = ['I','II','III','IV','V','VI','VII','VIII','IX','X',
                'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];

  /* ══════════════════════════════════════════════════════════
     1. EXTRACCIÓN
     ══════════════════════════════════════════════════════════ */

  function base64ToUint8(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

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

  function imgObjToDataUrl(img) {
    if (!img) return null;
    var w = img.width, h = img.height;
    if (!w || !h) return null;
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (img.bitmap) {
      try {
        ctx.drawImage(img.bitmap, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.92);
      } catch (e) { return null; }
    }
    if (!img.data) return null;

    var imgData = ctx.createImageData(w, h);
    var dst = imgData.data, src = img.data, kind = img.kind;

    if (kind === 3 || src.length === w * h * 4) {
      dst.set(src.subarray(0, w * h * 4));
    } else if (kind === 2 || src.length === w * h * 3) {
      for (var i = 0, j = 0; i < w * h; i++) {
        dst[j++] = src[i * 3]; dst[j++] = src[i * 3 + 1];
        dst[j++] = src[i * 3 + 2]; dst[j++] = 255;
      }
    } else if (kind === 1) {
      var rowBytes = (w + 7) >> 3;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var bit = (src[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
          var v = bit ? 255 : 0, o = (y * w + x) * 4;
          dst[o] = dst[o + 1] = dst[o + 2] = v; dst[o + 3] = 255;
        }
      }
    } else return null;

    ctx.putImageData(imgData, 0, 0);
    try { return canvas.toDataURL('image/jpeg', 0.92); } catch (e) { return null; }
  }

  function getObjSync(page, name) {
    try {
      if (page.objs.has && !page.objs.has(name)) return null;
      return page.objs.get(name) || null;
    } catch (e) { return null; }
  }

  // Recorre el flujo de dibujo para saber dónde y a qué tamaño va cada
  // imagen. Sólo lee operaciones: no toca píxeles, así que es barato.
  function scanImageOps(opList) {
    var OPS = window.pdfjsLib.OPS;
    var refs = [], ctm = [1, 0, 0, 1, 0, 0], stack = [];
    var fns = opList.fnArray, args = opList.argsArray;

    for (var i = 0; i < fns.length; i++) {
      var fn = fns[i];
      if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) { if (stack.length) ctm = stack.pop(); }
      else if (fn === OPS.transform) ctm = matMul(ctm, args[i]);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
        refs.push({
          name: args[i][0],
          w: Math.hypot(ctm[0], ctm[1]),
          h: Math.hypot(ctm[2], ctm[3]),
          x: ctm[4], ty: ctm[5]
        });
      }
    }
    return refs;
  }

  async function extractPageImages(page, viewport) {
    var out = [], opList;
    try { opList = await page.getOperatorList(); } catch (e) { return out; }

    var refs = scanImageOps(opList);
    if (!refs.length) return out;

    // pdf.js entrega los píxeles al hilo principal recién al pintar la
    // página: se renderiza en miniatura sólo para que estén disponibles.
    try {
      var vp = page.getViewport({ scale: 0.2 });
      var tmp = document.createElement('canvas');
      tmp.width = Math.max(1, Math.ceil(vp.width));
      tmp.height = Math.max(1, Math.ceil(vp.height));
      await page.render({ canvasContext: tmp.getContext('2d'), viewport: vp }).promise;
    } catch (e) { /* si el render falla, se intenta leer igual */ }

    refs.forEach(function (r) {
      var obj = getObjSync(page, r.name);
      var dataUrl = imgObjToDataUrl(obj);
      if (!dataUrl) return;
      out.push({
        dataUrl: dataUrl, px: obj.width, py: obj.height,
        w: r.w, h: r.h, x: r.x,
        top: viewport.height - (r.ty + r.h)
      });
    });

    out.sort(function (a, b) {
      if (Math.abs(a.top - b.top) > 8) return a.top - b.top;
      return a.x - b.x;
    });
    return out;
  }

  // Agrupa los fragmentos de texto en líneas y cada línea en celdas,
  // cortando por los huecos horizontales (campo | valor | …).
  function pageLines(textContent, viewport) {
    var YTOL = 4, GAP = 8;
    var items = [];
    (textContent.items || []).forEach(function (it) {
      var s = (it.str || '');
      if (!s.trim()) return;
      var tr = it.transform;
      items.push({
        str: s.trim(), x0: tr[4], x1: tr[4] + (it.width || 0),
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
      var groups = [], acc = [ws[0]];
      for (var i = 1; i < ws.length; i++) {
        if (ws[i].x0 - ws[i - 1].x1 > GAP) { groups.push(acc); acc = [ws[i]]; }
        else acc.push(ws[i]);
      }
      groups.push(acc);
      var cells = [], xs = [];
      groups.forEach(function (g) {
        var t = g.map(function (w) { return w.str; }).join(' ').trim();
        if (!t) return;
        cells.push(t); xs.push(g[0].x0);
      });
      return { top: ws[0].top, cells: cells, xs: xs };
    }).filter(function (r) { return r.cells.length > 0; });
  }

  async function extractFromPdf(base64, onProgress) {
    var pdf = await window.pdfjsLib.getDocument({ data: base64ToUint8(base64) }).promise;
    var pages = [];
    for (var n = 1; n <= pdf.numPages; n++) {
      if (onProgress) onProgress(n, pdf.numPages);
      var page = await pdf.getPage(n);
      var viewport = page.getViewport({ scale: 1 });
      var tc = await page.getTextContent();
      var lines = pageLines(tc, viewport);
      var images = await extractPageImages(page, viewport);
      pages.push({ num: n, lines: lines, images: images });
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    return pages;
  }

  /* ══════════════════════════════════════════════════════════
     2. PARSEO
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
    var pats = [
      /^P[áa]gina\s+\d+\s+de\s+\d+$/i, /^P[áa]g\.\s*\d+\s+de\s+\d+/i,
      /^LOGO REFERENCIAL$/i, /^METAPLAC$/i, /^REPORTE VEHICULAR INTEGRAL$/i,
      /^Generado\s*:/i, /^[ÍI]NDICE DE RIESGO/i, /^COMPOSICI[ÓO]N DE FACTORES$/i,
      /^IDENTIFICACI[ÓO]N DEL VEH[ÍI]CULO/i, /^\/\s*\d+$/, /^FACTORES EVALUADOS$/i,
      /^DOCUMENTOS ESCANEADOS/i
    ];
    for (var i = 0; i < pats.length; i++) if (pats[i].test(raw)) return true;
    return false;
  }

  function sinMinusculas(s) { return !/[a-záéíóúüñ]/.test(String(s || '')); }
  function tieneMinusculas(s) { return /[a-záéíóúüñ]/.test(String(s || '')); }

  // Rótulos enfrentados del panel gráfico ("MARCA → MODELO"): no son un
  // par campo/valor; los datos reales llegan luego en la ficha técnica.
  function esParDecorativo(a, b) {
    return a.length <= 28 && b.length <= 28 && sinMinusculas(a) && sinMinusculas(b);
  }

  var RE_NIVEL   = /RIESGO\s+(MUY\s+ALTO|ALTO|MEDIO|MODERADO|BAJO)/i;
  var ETIQ_IND   = /^(DENUNCIAS|DEUDA|REV\.|REVISI[ÓO]N|PROPIETARIOS|PAPELETAS|SOAT)/i;
  var VAL_IND    = /^(S\/\s*)?[\d.,]+$|^VIGENTE$|^VENCIDA?$|^—$|^-$/i;
  // Pies de las imágenes del original ("… (IMAGEN)", "ASIENTO 2 — …")
  var RE_CAPTION = /\(IMAGEN\)\s*$/i;
  var RE_ASIENTO = /^ASIENTO\s+\d+/i;

  function esCaption(s) { return RE_CAPTION.test(s) || RE_ASIENTO.test(s); }
  function limpiaCaption(s) {
    return limpiar(String(s).replace(/\s*\(IMAGEN\)\s*$/i, '').replace(/\s*—\s*$/, ''));
  }

  function parseSections(pages, placa) {
    var secciones = [];
    var cur = { titulo: 'RESUMEN EJECUTIVO', filas: [], pag: 1, top: 0, imgs: [], caps: [] };
    var SUB = /^(\d+\.\d+)\s+(.+)$/;
    var resumen = { score: '', nivel: '', indEtiquetas: null, indValores: null };
    var placaRef = (placa || '').toUpperCase();

    function push(f) { cur.filas.push(f); }

    // Continuación de un valor que el original partió en dos renglones:
    // el sobrante queda indentado a la altura de la columna de valores.
    function anexarContinuacion(texto) {
      for (var i = cur.filas.length - 1; i >= 0; i--) {
        var f = cur.filas[i];
        if (f.t === 'kv') { f.b = limpiar(f.b + ' ' + texto); return true; }
        if (f.t === 'row') {
          f.cells[f.cells.length - 1] = limpiar(f.cells[f.cells.length - 1] + ' ' + texto);
          return true;
        }
        if (f.t === 'txt') { f.a = limpiar(f.a + ' ' + texto); return true; }
        return false;
      }
      return false;
    }

    pages.forEach(function (pg) {
      pg.lines.forEach(function (ln) {
        // El "/ 100" del medidor cae a la altura de un factor y se le
        // pegaría como si fuera su etiqueta.
        var keep = [];
        for (var q = 0; q < ln.cells.length; q++) {
          var cc = ln.cells[q].trim();
          if (/^\/\s*\d+$/.test(cc)) continue;                    // "/ 100"
          if (/^LOGO REFERENCIAL$/i.test(cc)) continue;           // pie del logo
          if (cc.replace(/\s+/g, '').toUpperCase() === 'METAPLAC') continue;
          keep.push(q);
        }
        var cells = keep.map(function (q) { return ln.cells[q]; });
        var xs    = keep.map(function (q) { return ln.xs[q]; });
        if (!cells.length) return;

        // El puntaje del medidor va en su propia columna, a la izquierda
        // de los factores; si no se aparta, se pega al primer factor.
        if (pg.num === 1 && cells.length >= 3 && /^\d{1,3}$/.test(cells[0].trim()) &&
            +cells[0] >= 10 && +cells[0] <= 100) {
          resumen.score = cells[0].trim();
          cells = cells.slice(1); xs = xs.slice(1);
        }

        var raw = limpiar(cells.join(' '));
        if (!raw) return;
        // La placa suelta del panel ya encabeza la portada.
        if (pg.num === 1 && cells.length === 1 && placaRef && raw.toUpperCase() === placaRef) return;

        // ── Piezas del panel de riesgo (sólo en la portada) ──
        var mn = RE_NIVEL.exec(raw);
        if (mn) {
          resumen.nivel = mn[1].toUpperCase().replace(/\s+/g, ' ');
          if (/^RE\s+RESUMEN/i.test(raw)) return;
        }
        if (pg.num === 1 && /^\d{1,3}$/.test(raw) && +raw <= 100) { resumen.score = raw; return; }
        if (pg.num === 1 && cells.length >= 3 && ETIQ_IND.test(cells[0])) {
          resumen.indEtiquetas = cells.map(limpiar); return;
        }
        if (pg.num === 1 && cells.length >= 3 && !resumen.indEtiquetas &&
            cells.every(function (c) { return VAL_IND.test(c.trim()); })) {
          resumen.indValores = cells.map(limpiar); return;
        }
        if (pg.num === 1 && raw.indexOf('·') !== -1) return;

        // ── Pies de imagen: se guardan para rotularlas, no como texto ──
        if (cells.length === 1 && esCaption(cells[0])) {
          cur.caps.push(limpiaCaption(cells[0])); return;
        }
        if (cells.length === 2 && esCaption(cells[0]) && esCaption(cells[1])) {
          cur.caps.push(limpiaCaption(cells[0]));
          cur.caps.push(limpiaCaption(cells[1]));
          return;
        }

        if (esRuido(raw)) return;

        // ── Nueva sección: la primera celda es exactamente un romano ──
        if (cells.length >= 2 && ROMANS.indexOf(cells[0].trim()) !== -1) {
          secciones.push(cur);
          cur = {
            titulo: limpiar(cells.slice(1).join(' ')),
            filas: [], pag: pg.num, top: ln.top, imgs: [], caps: []
          };
          return;
        }

        var m = SUB.exec(raw);
        if (m) { push({ t: 'sub', a: limpiar(m[2]) }); return; }

        if (cells.length === 1) {
          var suelto = limpiar(cells[0]);
          // Cola de una celda de la tabla anterior: se reconoce porque cae
          // justo bajo una de sus columnas.
          var ult = cur.filas[cur.filas.length - 1];
          if (ult && ult.t === 'row' && ult.xs) {
            var mejor = -1, dist = 1e9;
            ult.xs.forEach(function (cx, k) {
              var d = Math.abs(cx - xs[0]);
              if (d < dist) { dist = d; mejor = k; }
            });
            if (dist <= 6 && mejor >= 0) {
              ult.cells[mejor] = limpiar(ult.cells[mejor] + ' ' + suelto);
              return;
            }
          }
          // Indentada bajo la columna de valores → cola del campo anterior.
          if (xs[0] > 150 && cur.filas.length && anexarContinuacion(suelto)) return;
          push({ t: 'txt', a: suelto });
          return;
        }

        if (cells.length === 2) {
          var ka = limpiar(cells[0]), vb = limpiar(cells[1]);
          if (!esParDecorativo(ka, vb)) push({ t: 'kv', a: ka, b: vb });
          return;
        }

        // ── 3+ celdas ──
        // Campo cuyo valor trae huecos internos ("Lugar   JUNIN / SATIPO
        // …   AVENIDA …"): la etiqueta va capitalizada, no en versalitas.
        if (tieneMinusculas(cells[0]) && cells[0].length <= 30) {
          push({ t: 'kv', a: limpiar(cells[0]), b: limpiar(cells.slice(1).join(' ')) });
          return;
        }
        push({ t: 'row', cells: cells.map(limpiar), xs: xs });
      });
    });
    secciones.push(cur);

    // ── Bloques de dos renglones (rótulos y cifras enfrentados) se pasan
    //    a campo/valor. Una tabla de verdad encadena tres o más renglones
    //    con las mismas columnas, así que se deja intacta. ──
    function conDigitos(cells) {
      return cells.some(function (c) { return /\d/.test(c); });
    }
    secciones.forEach(function (s) {
      for (var i = 0; i < s.filas.length - 1; i++) {
        var a = s.filas[i], b = s.filas[i + 1];
        if (a.t !== 'row' || b.t !== 'row') continue;
        var nc = a.cells.length;
        if (b.cells.length !== nc || nc < 2) continue;

        // ¿Cuántos renglones de la sección comparten esas columnas? Se
        // cuentan todos, no sólo los seguidos: una nota intercalada —el
        // sobrante de una celda— no debe hacer pasar una tabla por par.
        var mismasCols = 0;
        s.filas.forEach(function (f) {
          if (f.t === 'row' && f.cells.length === nc) mismasCols++;
        });
        if (mismasCols > 2) { i++; continue; }             // es una tabla

        // Los rótulos son el renglón sin cifras; el otro trae los datos.
        var aNum = conDigitos(a.cells), bNum = conDigitos(b.cells);
        if (aNum === bNum) continue;                        // ambiguo: no tocar
        var rot = aNum ? b.cells : a.cells;
        var val = aNum ? a.cells : b.cells;

        var pares = rot.map(function (r, k) {
          return { t: 'kv', a: limpiar(r), b: limpiar(val[k]) };
        });
        s.filas.splice(i, 2);
        for (var k = pares.length - 1; k >= 0; k--) s.filas.splice(i, 0, pares[k]);
        i += pares.length - 1;
      }
    });

    // Los rótulos de las piezas biométricas se descartan: al maquetarlas
    // se rotula cada una por su cuenta.
    secciones.forEach(function (s) {
      s.filas = s.filas.filter(function (f) {
        return !(f.t === 'row' && f.cells.every(function (c) {
          return /^(FIRMA|HUELLA|FOTO|FOTOGRAF[ÍI]A)/i.test(c.trim());
        }));
      });
    });

    // Un párrafo largo llega partido en renglones sueltos. Se vuelven a
    // unir salvo que el siguiente abra un ítem ("1)", "—") o el anterior
    // cierre con punto o dos puntos.
    secciones.forEach(function (s) {
      var out = [];
      s.filas.forEach(function (f) {
        var prev = out[out.length - 1];
        if (f.t === 'txt' && prev && prev.t === 'txt' &&
            !/[.:;]$/.test(prev.a) && !/^(\d+\)|[-—]{2,}|•)/.test(f.a) &&
            prev.a.length > 40) {
          prev.a = limpiar(prev.a + ' ' + f.a);
          return;
        }
        out.push(f);
      });
      s.filas = out;
    });

    // ── Cada imagen queda en la sección que la precede, comparando por
    //    página y altura para que no se cuele en la siguiente. ──
    pages.forEach(function (pg) {
      pg.images.forEach(function (im) {
        if (pg.num === 1 && im.px <= 500 && im.py <= 500) return; // logo de marca
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

  function findVal(secciones, re, secRe) {
    var hit = '';
    secciones.forEach(function (s) {
      if (secRe && !secRe.test(s.titulo)) return;
      s.filas.forEach(function (f) {
        if (f.t === 'kv' && re.test(f.a) && f.b) hit = f.b;
      });
    });
    return hit;
  }

  /* ══════════════════════════════════════════════════════════
     3. MAQUETACIÓN

     El documento se compone como un informe impreso, no como una
     pantalla volcada a papel: portada de página entera, índice con
     números de página, retícula sostenida por filetes finos y tablas
     con cabecera sólida. Todo el color vive en el semáforo, en los
     puntos de estado y en el filete corto de marca; el resto es tinta
     sobre blanco, que es lo que hace que un reporte se lea como un
     documento y no como un folleto.
     ══════════════════════════════════════════════════════════ */

  function buildPdf(secciones, meta) {
    var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = doc.internal.pageSize.getWidth();   // 210
    var H = doc.internal.pageSize.getHeight();  // 297
    var M = 18;                 // margen lateral
    var HEAD_Y = 15;            // línea base del membrete
    var TOP = 34;               // inicio del área de contenido
    var FOOT = H - 24;          // filete del pie
    var COLW = W - M * 2;

    // El folio se imprime en cada pie y viaja dentro del QR.
    var folio = meta.folio || '';
    var VERIFICA = 'https://filtrovehicularperu.com/verificar';

    var valor = (meta && meta.valor ? String(meta.valor) : '').toUpperCase();
    var fecha = (meta && meta.fecha) || new Date().toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    /* ── Utilidades de trazo y texto ───────────────────────────── */

    function hairline(y, x0, x1, color, grosor) {
      doc.setDrawColor.apply(doc, color || C_HAIR);
      doc.setLineWidth(grosor || 0.2);
      doc.line(x0 === undefined ? M : x0, y, x1 === undefined ? W - M : x1, y);
    }

    function vline(x, y0, y1, color) {
      doc.setDrawColor.apply(doc, color || C_HAIR);
      doc.setLineWidth(0.2);
      doc.line(x, y0, x, y1);
    }

    /* Versalita espaciada: el recurso que ordena el documento. Todas las
       etiquetas del informe salen de aquí, así que el tono de gris y el
       tracking se cambian en un solo sitio. */
    function versalita(texto, x, yy, opts) {
      opts = opts || {};
      var t = String(texto).toUpperCase();
      var track = opts.track === undefined ? 0.5 : opts.track;
      doc.setFont('helvetica', opts.bold === false ? 'normal' : 'bold');
      doc.setFontSize(opts.size || 6.8);
      doc.setTextColor.apply(doc, opts.color || C_MUTED);

      /* El alineado se calcula aquí y no se delega en jsPDF: su `align`
         mide el texto SIN el espaciado entre letras, así que un rótulo
         trackeado y alineado a la derecha se corre tantos milímetros
         como letras tenga. El del membrete se salía 17 mm fuera de la
         caja, por el borde de la hoja. */
      var ancho = doc.getTextWidth(t) + track * Math.max(0, t.length - 1);
      var x0 = x;
      if (opts.align === 'right') x0 = x - ancho;
      else if (opts.align === 'center') x0 = x - ancho / 2;

      try { doc.setCharSpace(track); } catch (e) {}
      doc.text(t, x0, yy);
      try { doc.setCharSpace(0); } catch (e) {}
      return ancho;
    }

    function rotulo(texto, x, yy, size, color, bold) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor.apply(doc, color);
      doc.text(String(texto), x, yy);
    }

    // Filete corto de dos tramos (verde + turquesa): el acento de marca.
    function fileteBicolor(x, yy, largo, grosor) {
      var mitad = largo / 2;
      doc.setLineWidth(grosor || 0.7);
      doc.setDrawColor.apply(doc, C_ACCENT);
      doc.line(x, yy, x + mitad, yy);
      doc.setDrawColor.apply(doc, C_TURQ);
      doc.line(x + mitad, yy, x + largo, yy);
    }

    // Punto de estado: el color va en un disco pequeño, nunca en una
    // barra lateral. Ocupa poco y se ve igual de lejos.
    function punto(x, yy, color, r) {
      doc.setFillColor.apply(doc, color);
      doc.circle(x, yy, r || 1.5, 'F');
    }

    /* ── Membrete y pie ───────────────────────────────────────── */
    var decoradas = {};
    function paginaActual() {
      try { return doc.internal.getCurrentPageInfo().pageNumber; } catch (e) { return 1; }
    }

    function cromo() {
      var pn = paginaActual();
      if (decoradas[pn]) return;
      decoradas[pn] = true;

      // Marca, sin sello ni monograma: el nombre es lo que se reconoce.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor.apply(doc, C_INK);
      doc.text('Filtro Vehicular', M, HEAD_Y);
      var wm = doc.getTextWidth('Filtro Vehicular');
      doc.setTextColor.apply(doc, C_ACCENT);
      doc.text('+', M + wm + 0.6, HEAD_Y);

      versalita('Reporte vehicular integral', W - M, HEAD_Y - 3.2,
                { size: 6.2, color: C_TURQ, track: 0.7, align: 'right' });
      if (valor) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor.apply(doc, C_INK);
        doc.text(valor, W - M, HEAD_Y + 1.4, { align: 'right' });
      }

      hairline(HEAD_Y + 5.4);
      fileteBicolor(M, HEAD_Y + 5.4, 18, 0.7);

      // Pie: marca y trazabilidad a la izquierda; verificación a la derecha.
      hairline(FOOT);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor.apply(doc, C_INK);
      doc.text('Filtro Vehicular+', M, FOOT + 5);
      var fw = doc.getTextWidth('Filtro Vehicular+');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor.apply(doc, C_MUTED);
      doc.text('· Plataforma de consultas vehiculares', M + fw + 1.6, FOOT + 5);
      doc.setFontSize(6.4);
      doc.text('Emitido el ' + fecha + (folio ? '  ·  Folio ' + folio : ''), M, FOOT + 9.2);

      /* ── El QR, en TODAS las páginas ──────────────────────────────
         Un reporte se enseña suelto, se fotografía una hoja o se imprime
         de a poco. Con el QR solo al final, la página que acaba en manos
         del comprador no se puede comprobar. El folio impreso al lado no
         es adorno: si el QR se estropea al fotocopiar, se escribe a mano
         y verifica igual. */
      if (folio) {
        var lado = 12;
        var qx = W - M - lado, qy = FOOT + 2.4;
        var pintado = dibujarQR(doc, VERIFICA + '?f=' + encodeURIComponent(folio), qx, qy, lado);
        if (!pintado) {
          versalita('Verifica en', qx + lado, FOOT + 5, { size: 5.6, align: 'right' });
          rotulo(VERIFICA, qx + lado, FOOT + 8.6, 5.6, C_MUTED);
        }
      }
    }

    var y = TOP;
    function nuevaPagina() { doc.addPage(); cromo(); y = TOP; }
    function need(mm) { if (y + mm > FOOT - 8) nuevaPagina(); }

    cromo();

    /* ══════════════════════════════════════════════════════════
       PORTADA — página entera
       ══════════════════════════════════════════════════════════ */
    var DV     = /DATOS DEL VEH/i;
    var marca  = findVal(secciones, /^Marca\s*\/\s*Modelo/i) || findVal(secciones, /^Marca/i);
    var anio   = findVal(secciones, /^A[ñn]o Fabricaci[óo]n/i);
    var color  = findVal(secciones, /^Color/i, DV);
    var carro  = findVal(secciones, /^Carrocer[íi]a/i, DV);
    var estado = findVal(secciones, /^Estado$/i, DV);
    var placa  = findVal(secciones, /^N[°º]? de Placa/i) || valor;

    y = TOP + 6;
    versalita('Informe consolidado', M, y, { size: 7.6, color: C_TURQ, track: 1.4 });
    y += 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(27);
    doc.setTextColor.apply(doc, C_INK);
    doc.text('Reporte Vehicular', M, y);
    y += 11;
    doc.text('Integral', M, y);
    y += 8;

    rotulo('Documento emitido el ' + fecha, M, y, 8.6, C_MUTED);
    y += 12;

    /* Recuadro de placa: la matrícula es el identificador del informe y
       se comporta como tal — encerrada, sola y grande. A su derecha, la
       identidad del vehículo en retícula. */
    var cajaW = 62, cajaH = 26;
    doc.setDrawColor.apply(doc, C_INK);
    doc.setLineWidth(0.5);
    doc.rect(M, y, cajaW, cajaH);
    versalita('Placa', M + 5, y + 7.4, { size: 6, track: 0.8 });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(21);
    doc.setTextColor.apply(doc, C_INK);
    doc.text(placa || '—', M + 5, y + 19.5, { maxWidth: cajaW - 10 });

    var attrs = [
      ['Marca y modelo', marca], ['Año', anio], ['Color', color],
      ['Carrocería', carro], ['Estado', estado]
    ].filter(function (a) { return a[1]; });

    /* Tres columnas por dos filas, no dos por tres: así el bloque mide
       exactamente lo mismo que el recuadro de la placa y los dos cierran
       en la misma línea. Con dos columnas, el quinto atributo colgaba
       por debajo del recuadro y el conjunto quedaba descuadrado. */
    var ax = M + cajaW + 12;
    var COLS = 3;
    var anchoAttr = (W - M - ax) / COLS;
    var filaH = cajaH / 2;
    attrs.forEach(function (a, i) {
      var cx = ax + (i % COLS) * anchoAttr;
      var cy = y + 5 + Math.floor(i / COLS) * filaH;
      versalita(a[0], cx, cy, { size: 6, track: 0.4 });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, C_INK);
      doc.text(String(a[1]), cx, cy + 5, { maxWidth: anchoAttr - 4 });
    });
    y += Math.max(cajaH, 5 + Math.ceil(attrs.length / COLS) * filaH) + 13;
    hairline(y);
    y += 12;

    /* ── Veredicto ────────────────────────────────────────────────
       Lo primero de la primera página, y con una sola voz.

       Manda el veredicto propio, que es el que se puede defender delante
       de un cliente. El índice del proveedor no se esconde: se imprime
       debajo, dicho de quién es, para que quien compare las dos cosas
       entienda por qué no coinciden en vez de sospechar de las dos. */
    var R = secciones.resumen || {};
    var VER = null;
    try {
      if (Consultia.ReporteModelo && Consultia.ReporteVeredicto) {
        /* Del parsed del bot, no de las secciones del PDF. Deducir el
           contenido por el título de cada sección llevó a afirmar un robo
           que no existía; aquí solo entran campos con nombre. */
        var modelo = meta.parsed
          ? Consultia.ReporteModelo.desdeParsed(meta.parsed, meta.valor)
          : Consultia.ReporteModelo.desdeSecciones(secciones, meta.valor);
        VER = Consultia.ReporteVeredicto.nivel(modelo);
        VER.modelo = modelo;
      }
    } catch (e) {
      console.warn('[metapla] sin veredicto, se imprime lo que haya:', e);
    }

    if (VER) {
      var vc = riskColor(VER.nivel);

      versalita('Veredicto de la plataforma', M, y, { size: 7, track: 1 });
      y += 11;

      /* El semáforo: un disco del color del veredicto junto al titular.
         Quien abre el reporte lo entiende antes de leer una palabra, y
         eso es justo lo que tiene que pasar en un informe de riesgo.

         Cuando no hay nivel, el disco NO se rellena. Relleno con la
         tinta neutra salía un círculo negro enorme al lado de «Veredicto
         parcial»: nadie sabía qué era, y un semáforo apagado tiene que
         parecer apagado. Un aro hueco dice exactamente eso — hay un
         indicador y está sin respuesta— y el propio texto lo explica.

         El centro va 2,3 mm por encima de la línea base, que es donde
         cae el centro óptico de una mayúscula de 18 pt: así el disco y
         el titular se leen como una sola pieza. */
      var discoR = 6.2;
      var discoY = y - 2.3;
      var parcial = VER.nivel === 'SIN DETERMINAR';
      if (parcial) {
        doc.setDrawColor.apply(doc, C_MUTED);
        doc.setLineWidth(1.1);
        doc.circle(M + discoR, discoY, discoR - 0.55, 'S');
      } else {
        punto(M + discoR, discoY, vc, discoR);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor.apply(doc, vc);
      doc.text(parcial
        ? 'Veredicto parcial'
        : 'Riesgo ' + VER.nivel.charAt(0) + VER.nivel.slice(1).toLowerCase(),
        M + discoR * 2 + 6, y);
      if (parcial) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.4);
        doc.setTextColor.apply(doc, C_MUTED);
        doc.text('Falta información para calificar el riesgo; lo comprobado se detalla abajo.',
                 M + discoR * 2 + 6, y + 5, { maxWidth: COLW - discoR * 2 - 6 });
      }
      y += 13;

      // Las tres respuestas, en columnas separadas por filete, sin cajas.
      var respuestas = [
        ['¿Puede circular?', palabra(VER.circular.estado), VER.circular.resumen, VER.circular.estado],
        ['¿Puede transferirse?', palabra(VER.transferir.estado), VER.transferir.resumen, VER.transferir.estado],
        ['Deuda registrada',
         (!VER.deuda.exacta && VER.deuda.total === 0) ? 'No totalizada' : VER.deuda.totalTexto,
         (!VER.deuda.exacta && VER.deuda.total === 0)
           ? 'Registros sin importe legible en ' + VER.deuda.entidadesIlegibles.join(', ')
           : (VER.deuda.ilegibles ? 'Y deuda sin totalizar en ' + VER.deuda.entidadesIlegibles.join(', ')
              : (VER.deuda.fuentesMudas ? VER.deuda.fuentesMudas + ' fuente(s) sin respuesta'
                 : 'Todas las fuentes respondieron')),
         !VER.deuda.exacta ? 'con reparos' : (VER.deuda.total > 0 ? 'no' : 'si')],
      ];
      var colW = COLW / 3, altoCol = 30;
      hairline(y - 4, M, W - M, C_INK, 0.4);
      respuestas.forEach(function (r, i) {
        var x0 = M + i * colW + (i ? 6 : 0);
        var ancho = colW - (i ? 6 : 0) - 4;
        if (i) vline(M + i * colW, y - 4, y + altoCol - 8);
        versalita(r[0], x0, y + 2, { size: 6, track: 0.4 });
        punto(x0 + 1.4, y + 8.6, estadoColor(r[3]), 1.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor.apply(doc, C_INK);
        doc.text(String(r[1]), x0 + 5, y + 10, { maxWidth: ancho - 5 });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor.apply(doc, C_MUTED);
        doc.text(doc.splitTextToSize(String(r[2] || ''), ancho), x0, y + 16);
      });
      y += altoCol;

      // Por qué. Sin esto el veredicto es una opinión.
      if (VER.motivos.length) {
        hairline(y - 5);
        versalita('Fundamento', M, y + 1, { size: 6.4, track: 0.6 });
        y += 6;
        VER.motivos.forEach(function (mo) {
          var lineas = doc.splitTextToSize(mo, COLW - 6);
          punto(M + 1, y - 1.2, C_HAIR, 0.9);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor.apply(doc, C_INK);
          doc.text(lineas, M + 5, y);
          y += lineas.length * 4.2 + 1.4;
        });
        y += 3;
      }

      // El índice del proveedor, dicho de quién es.
      if (R.score) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor.apply(doc, C_MUTED);
        doc.text('Índice del proveedor: ' + R.score + ' de 100' +
                 (R.nivel ? ' (' + R.nivel.toLowerCase() + ')' : '') +
                 '. Criterio no publicado; el veredicto de arriba es el de la plataforma.',
                 M, y, { maxWidth: COLW });
        y += 6;
      }
    }

    /* Nota de alcance, anclada al pie de la portada. Un informe serio
       dice de dónde sale y hasta dónde llega antes de que alguien tome
       una decisión con él. */
    var notaY = FOOT - 16;
    if (y < notaY - 8) {          // con menos aire que eso, se pisaría el fundamento
      hairline(notaY - 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor.apply(doc, C_MUTED);
      doc.text(doc.splitTextToSize(
        'Este documento reúne la información devuelta por las fuentes oficiales consultadas en la fecha de ' +
        'emisión. El veredicto es una lectura de esos registros y no sustituye la verificación física del ' +
        'vehículo ni el trámite ante la entidad correspondiente. Su autenticidad se comprueba con el folio ' +
        'y el código QR impresos en cada página.', COLW - 20), M, notaY);
    }

    /* ══════════════════════════════════════════════════════════
       CONTENIDO
       ══════════════════════════════════════════════════════════ */
    nuevaPagina();

    /* Recuento del proveedor: trae cifras que el veredicto no da
       —propietarios, denuncias— pero rotulado, porque es su resumen y no
       el nuestro. Sin ese rótulo, dos bloques de cifras seguidos parecen
       el mismo análisis partido en dos. */
    if (R.indEtiquetas && R.indValores && R.indEtiquetas.length === R.indValores.length) {
      var n = R.indEtiquetas.length;
      versalita('Recuento del proveedor', M, y, { size: 6.8, track: 0.8 });
      y += 5;
      hairline(y, M, W - M, C_INK, 0.4);
      var cardW = COLW / n, cardH = 20;
      for (var ci = 0; ci < n; ci++) {
        var cx0 = M + ci * cardW;
        if (ci) vline(cx0, y, y + cardH - 4);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor.apply(doc, C_INK);
        doc.text(String(R.indValores[ci] || '—'), cx0 + (ci ? 5 : 0), y + 9,
                 { maxWidth: cardW - 6 });
        versalita(String(R.indEtiquetas[ci] || ''), cx0 + (ci ? 5 : 0), y + 14.5,
                  { size: 5.8, track: 0.3 });
      }
      y += cardH + 8;
    }

    // Estilos compartidos por todas las tablas del informe.
    var margenTabla = { left: M, right: M, top: TOP, bottom: H - FOOT + 8 };
    var CABECERA = {
      fontSize: 7, textColor: [255, 255, 255], fontStyle: 'bold', fillColor: C_INK,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, lineWidth: 0
    };
    var CUERPO = {
      fontSize: 8.2, textColor: C_INK, valign: 'top',
      cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 },
      lineWidth: { bottom: 0.1 }, lineColor: C_HAIR
    };

    var indice = [];
    var numSec = 0;
    secciones.forEach(function (sec) {
      var kv  = sec.filas.filter(function (f) { return f.t === 'kv'; });
      var txt = sec.filas.filter(function (f) { return f.t === 'txt'; });
      var row = sec.filas.filter(function (f) { return f.t === 'row'; });
      if (!kv.length && !txt.length && !row.length && !sec.imgs.length) return;

      numSec++;
      need(30);

      /* Cabecera de sección: el número en gris claro y grande hace de
         guía visual al hojear; el título manda, y el filete cierra. */
      var etiqueta = ('0' + numSec).slice(-2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor.apply(doc, C_HAIR);
      doc.text(etiqueta, M, y);
      doc.setFontSize(12.5);
      doc.setTextColor.apply(doc, C_INK);
      doc.text(sec.titulo, M + 11, y, { maxWidth: COLW - 11 });
      indice.push({ n: etiqueta, titulo: sec.titulo, pag: paginaActual() });
      y += 3.6;
      hairline(y, M, W - M, C_INK, 0.4);
      y += 8;

      // Campos: etiqueta tenue a la izquierda, valor en tinta.
      if (kv.length) {
        doc.autoTable({
          startY: y,
          body: kv.map(function (f) { return [f.a, f.b]; }),
          margin: margenTabla,
          tableLineWidth: 0,
          didDrawPage: cromo,
          bodyStyles: CUERPO,
          columnStyles: {
            0: { cellWidth: 56, textColor: C_MUTED, fontSize: 7.8,
                 cellPadding: { top: 2.6, bottom: 2.6, left: 0, right: 3 } },
            1: { cellWidth: 'auto', fontStyle: 'bold' }
          },
          styles: { overflow: 'linebreak', lineWidth: 0, fillColor: false },
          theme: 'plain'
        });
        y = (doc.lastAutoTable && doc.lastAutoTable.finalY) || y;
        y += 6;
      }

      // Tablas: cabecera sólida cuando la primera fila viene en versalitas.
      if (row.length) {
        var maxCols = 0;
        row.forEach(function (f) { maxCols = Math.max(maxCols, f.cells.length); });
        var norm = function (f) {
          var c = f.cells.slice();
          while (c.length < maxCols) c.push('');
          return c;
        };
        var head = null, cuerpo = row.map(norm);
        if (row.length > 1 && row[0].cells.every(sinMinusculas)) {
          head = [norm(row[0])];
          cuerpo = cuerpo.slice(1);
        }
        doc.autoTable({
          startY: y,
          head: head || undefined,
          body: cuerpo,
          margin: margenTabla,
          tableLineWidth: 0,
          didDrawPage: cromo,
          headStyles: CABECERA,
          bodyStyles: CUERPO,
          alternateRowStyles: { fillColor: C_SOFT },
          styles: { overflow: 'linebreak', lineWidth: 0, fillColor: false },
          theme: 'plain'
        });
        y = (doc.lastAutoTable && doc.lastAutoTable.finalY) || y;
        y += 6;
      }

      // Notas al pie de sección
      txt.forEach(function (f) {
        if (!f.a || f.a.length < 2) return;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor.apply(doc, C_MUTED);
        var ls = doc.splitTextToSize(f.a, COLW);
        need(ls.length * 3.8 + 4);
        doc.text(ls, M, y + 2);
        y += ls.length * 3.8 + 4;
      });

      /* ── Imágenes ── */
      if (sec.imgs.length) {
        y += 3;
        var chicas = sec.imgs.filter(function (im) { return im.px <= 1000 && im.py <= 700; });
        var grandes = chicas.length > 1
          ? sec.imgs.filter(function (im) { return !(im.px <= 1000 && im.py <= 700); })
          : sec.imgs;

        // Biométricas: alineadas por su base, con rótulo debajo
        if (chicas.length > 1) {
          var rotulos = ['Fotografía', 'Firma', 'Huella derecha', 'Huella izquierda'];
          var maxHb = 34;
          need(maxHb + 14);
          var slot = COLW / chicas.length, base = y + maxHb;
          chicas.forEach(function (im, i) {
            var esc = Math.min((slot - 10) / im.px, maxHb / im.py);
            var dw = im.px * esc, dh = im.py * esc, cx = M + slot * i + slot / 2;
            try {
              doc.addImage(im.dataUrl, 'JPEG', cx - dw / 2, base - dh, dw, dh, undefined, 'FAST');
            } catch (e) { /* imagen no insertable */ }
            versalita(rotulos[i] || ('Imagen ' + (i + 1)), cx, base + 4.6,
                      { size: 5.8, track: 0.3, align: 'center' });
          });
          y = base + 11;
        }

        // Documentos: a página ancha, con su pie tomado del original
        var caps = sec.caps || [];
        grandes.forEach(function (im, gi) {
          var cap = caps[gi] || '';
          var maxHg = FOOT - TOP - 16;
          var esc = Math.min(COLW / im.px, maxHg / im.py);
          var dw = im.px * esc, dh = im.py * esc;
          if (y + dh + (cap ? 7 : 0) > FOOT - 8) nuevaPagina();
          if (cap) {
            versalita(cap, M, y, { size: 6.2, track: 0.4 });
            y += 4;
          }
          var ix = M + (COLW - dw) / 2;
          try {
            doc.addImage(im.dataUrl, 'JPEG', ix, y, dw, dh, undefined, 'FAST');
          } catch (e) { /* imagen no insertable */ }
          doc.setDrawColor.apply(doc, C_HAIR);
          doc.setLineWidth(0.2);
          doc.rect(ix, y, dw, dh);
          y += dh + 8;
        });
      }

      y += 8;
    });

    /* ── Cobertura ────────────────────────────────────────────────
       Qué se consultó y qué contestó cada fuente. Es el apartado que
       convierte el silencio en información: sin él, una sección que no
       respondió se lee igual que una sección limpia, y alguien puede
       comprar un vehículo confiando en algo que nunca se comprobó. */
    if (VER && VER.modelo && VER.modelo.cobertura && VER.modelo.cobertura.length) {
      need(46);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor.apply(doc, C_INK);
      doc.text('Fuentes consultadas', M, y);
      indice.push({ n: '·', titulo: 'Fuentes consultadas', pag: paginaActual() });
      y += 3.6;
      hairline(y, M, W - M, C_INK, 0.4);
      y += 8;

      var traduce = {
        'con datos':     'Respondió con registros',
        'sin registros': 'Respondió: sin registros',
        'sin respuesta': 'No respondió',
      };
      doc.autoTable({
        startY: y,
        head: [['Fuente', 'Resultado']],
        body: VER.modelo.cobertura.map(function (c) {
          return [c.fuente, traduce[c.estado] || c.estado];
        }),
        margin: margenTabla,
        tableLineWidth: 0,
        didDrawPage: cromo,
        headStyles: CABECERA,
        bodyStyles: CUERPO,
        alternateRowStyles: { fillColor: C_SOFT },
        columnStyles: { 1: { cellWidth: 62 } },
        // Lo que no respondió, en rojo: es lo que hay que mirar.
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 1 &&
              /No respondió/.test(data.cell.raw)) {
            data.cell.styles.textColor = C_BAD;
            data.cell.styles.fontStyle = 'bold';
          }
        },
        styles: { overflow: 'linebreak', lineWidth: 0, fillColor: false },
        theme: 'plain'
      });
      y = (doc.lastAutoTable && doc.lastAutoTable.finalY) || y;
      y += 6;
    }

    /* ── Índice, insertado como página 2 ──────────────────────────
       Se dibuja al final, cuando ya se sabe en qué página cayó cada
       sección, y se mueve delante. Si el informe trae tantas secciones
       que el índice no cabría en una página, no se imprime: media tabla
       de contenidos confunde más que no tenerla. */
    if (indice.length > 2 && indice.length <= 26 &&
        typeof doc.movePage === 'function' && typeof doc.deletePage === 'function') {
      try {
        doc.addPage();
        cromo();
        var iy = TOP + 6;
        versalita('Contenido', M, iy, { size: 7, track: 1.2 });
        iy += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(19);
        doc.setTextColor.apply(doc, C_INK);
        doc.text('Índice del informe', M, iy);
        iy += 4;
        hairline(iy, M, W - M, C_INK, 0.4);
        iy += 9;
        indice.forEach(function (it) {
          // Todo lo que iba de la página 2 en adelante baja un lugar.
          var pag = it.pag >= 2 ? it.pag + 1 : it.pag;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor.apply(doc, C_MUTED);
          doc.text(it.n, M, iy);
          doc.setFontSize(9.4);
          doc.setTextColor.apply(doc, C_INK);
          doc.text(it.titulo, M + 11, iy, { maxWidth: COLW - 30 });
          doc.setFont('helvetica', 'normal');
          doc.setTextColor.apply(doc, C_MUTED);
          doc.text(String(pag), W - M, iy, { align: 'right' });
          hairline(iy + 2.6);
          iy += 8;
        });
        doc.movePage(doc.getNumberOfPages(), 2);
      } catch (e) {
        console.warn('[metapla] sin índice:', e);
        try { doc.deletePage(doc.getNumberOfPages()); } catch (e2) {}
      }
    }

    /* ── Folio de página ── */
    var total = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : 1;
    for (var pn = 1; pn <= total; pn++) {
      if (pn === 1) continue;               // la portada no se numera
      doc.setPage(pn);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor.apply(doc, C_MUTED);
      doc.text('Página', W - M - 15, FOOT + 5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor.apply(doc, C_INK);
      doc.text(pn + ' de ' + total, W - M - 15, FOOT + 9.2, { align: 'right' });
    }

    var slug = valor.replace(/[^A-Z0-9]/g, '').slice(0, 12);
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') +
                String(d.getDate()).padStart(2, '0');
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
  async function generate(pdfBase64, meta, onProgress) {
    if (!window.pdfjsLib) throw new Error('pdf.js no disponible');
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF no disponible');
    if (!pdfBase64) throw new Error('Sin PDF de origen');

    // Tope de seguridad: si la lectura se atasca, el llamador muestra el
    // PDF original en vez de dejar al usuario esperando.
    var vencido = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('Tiempo de generación agotado')); }, 60000);
    });

    var trabajo = (async function () {
      var pages = await extractFromPdf(pdfBase64, onProgress);
      var secciones = parseSections(pages, meta && meta.valor);
      if (!secciones.length) throw new Error('No se pudo leer el contenido del PDF');
      /* Quien llama puede quedarse con las secciones ya leídas. Sirve para
         montar el modelo y el veredicto sin volver a abrir el PDF: la
         extracción es lo caro de todo esto —segundos, no milisegundos— y
         hacerla dos veces por el mismo documento no tiene defensa. */
      if (meta && typeof meta.onSecciones === 'function') {
        try { meta.onSecciones(secciones); } catch (e) { console.warn('[metapla] onSecciones falló:', e); }
      }
      return buildPdf(secciones, meta || {});
    })();

    return Promise.race([trabajo, vencido]);
  }

  Consultia.MetaplaReport = {
    generate: generate,
    // Expuestos para diagnóstico y pruebas por etapa del pipeline.
    _extract: extractFromPdf,
    _parse: parseSections,
    _build: buildPdf
  };
})();
