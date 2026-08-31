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

     El informe no se compone «a ojo»: todas las medidas salen de las
     cuatro tablas de abajo —retícula, bandas fijas, escala tipográfica
     e interlineados— y en el cuerpo del código no hay ni un número
     suelto. Esa es la diferencia entre un documento que parece armado y
     uno que lo está: cada bloque empieza en una columna de la retícula y
     cada salto vertical es un múltiplo de la misma unidad, así que los
     blancos se repiten en vez de salir distintos en cada página.

     A4 con 20 mm de margen deja 170 mm de columna viva. Se divide en 12
     columnas de 10,5 mm con medianil de 4 mm, que es lo que permite
     partir la página en mitades (6+6), tercios (4+4+4) y cuartos (3×4)
     sin decimales raros: el veredicto usa tercios, la ficha del vehículo
     usa 4+7 y las tablas ocupan las doce.
     ══════════════════════════════════════════════════════════ */

  // ── Página y márgenes (mm) ──
  var PG = { W: 210, H: 297 };
  var MG = { x: 20 };

  // ── Retícula ──
  var GRID = { cols: 12, gutter: 4 };
  var CW   = PG.W - MG.x * 2;                                    // 170
  var COL  = (CW - GRID.gutter * (GRID.cols - 1)) / GRID.cols;   // 10.5

  function gx(i) { return MG.x + i * (COL + GRID.gutter); }      // origen de la columna i
  function gw(n) { return n * COL + (n - 1) * GRID.gutter; }     // ancho de n columnas

  // ── Ritmo vertical: todo avance es múltiplo de U ──
  var U = 4;

  /* ── Bandas fijas de la página ──
     Cabecera y pie son zonas muertas para el contenido: se reservan una
     vez y ningún bloque las invade.

     Van pegadas a los bordes, que es donde se espera encontrarlas: el
     membrete arranca a 11 mm del filo superior y el QR del pie cierra a
     10 mm del inferior, holgura de sobra para cualquier impresora. Con
     la cabecera a 22 y el pie a 265 el documento parecía enmarcado y
     además desperdiciaba 19 mm de columna en cada página. */
  var CAB = { texto: 14.5, filete: 18 };
  var PIE = { filete: 274, l1: 279.4, l2: 283.6, qr: 11 };
  var CUERPO = { top: 27, bottom: PIE.filete - 6 };               // 27 … 268

  // ── Escala tipográfica (pt), razón ≈1,25 ──
  var T = {
    micro: 6.2,   // versalitas de etiqueta
    mini:  7.4,   // notas y pies
    base:  8.8,   // cuerpo y tablas
    dato: 10.5,   // cifras dentro de un bloque
    h3:     12,   // título de sección
    h2:     16,   // titular del veredicto
    h1:     26,   // título del informe
    placa:  30    // la matrícula en portada
  };

  // ── Interlineados (mm) ──
  var LH = { micro: 3, mini: 3.6, base: 4.4 };

  // ── Portada ──
  var PORTADA = { banda: 58 };

  function buildPdf(secciones, meta) {
    var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = PG.W, H = PG.H, M = MG.x;

    // El folio se imprime en cada pie y viaja dentro del QR.
    var folio = meta.folio || '';
    var VERIFICA = 'https://filtrovehicularperu.com/verificar';

    var valor = (meta && meta.valor ? String(meta.valor) : '').toUpperCase();
    var fecha = (meta && meta.fecha) || new Date().toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    /* ── Utilidades de trazo y texto ───────────────────────────── */

    function hairline(yy, x0, x1, color, grosor) {
      doc.setDrawColor.apply(doc, color || C_HAIR);
      doc.setLineWidth(grosor || 0.2);
      doc.line(x0 === undefined ? M : x0, yy, x1 === undefined ? W - M : x1, yy);
    }

    function vline(x, y0, y1, color) {
      doc.setDrawColor.apply(doc, color || C_HAIR);
      doc.setLineWidth(0.2);
      doc.line(x, y0, x, y1);
    }

    /* Versalita espaciada: el recurso que ordena el documento. Todas las
       etiquetas salen de aquí, así que el gris y el tracking se cambian
       en un solo sitio.

       El alineado se calcula aquí y no se delega en jsPDF: su `align`
       mide el texto SIN el espaciado entre letras, así que un rótulo
       trackeado y alineado a la derecha se corre tantos milímetros como
       letras tenga. El del membrete se salía 17 mm fuera de la caja. */
    function versalita(texto, x, yy, opts) {
      opts = opts || {};
      var t = String(texto).toUpperCase();
      var track = opts.track === undefined ? 0.5 : opts.track;
      doc.setFont('helvetica', opts.bold === false ? 'normal' : 'bold');
      doc.setFontSize(opts.size || T.micro);
      doc.setTextColor.apply(doc, opts.color || C_MUTED);

      var ancho = doc.getTextWidth(t) + track * Math.max(0, t.length - 1);
      var x0 = x;
      if (opts.align === 'right') x0 = x - ancho;
      else if (opts.align === 'center') x0 = x - ancho / 2;

      try { doc.setCharSpace(track); } catch (e) {}
      doc.text(t, x0, yy);
      try { doc.setCharSpace(0); } catch (e) {}
      return ancho;
    }

    /* El texto corriente se dibuja SIEMPRE sin espaciado entre letras, y
       hay que decirlo en cada llamada: autoTable deja su propio valor
       puesto al terminar una tabla, y `splitTextToSize` y `getTextWidth`
       lo ignoran mientras el dibujado sí lo aplica. Esa asimetría hacía
       que un párrafo partido a 170 mm se imprimiera de 199 mm y se
       saliera de la hoja: el partido contaba 156 letras y la impresión
       les añadía medio milímetro a cada una. */
    function sinTracking() {
      try { doc.setCharSpace(0); } catch (e) {}
    }

    /* Partir un texto SIEMPRE con la fuente con la que se va a imprimir.
       jsPDF mide con la que esté activa en ese momento —la que dejó el
       bloque anterior o autoTable—, así que partir antes de fijar el
       cuerpo devuelve líneas que no caben. */
    function parte(texto, ancho, size, bold) {
      sinTracking();
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      return doc.splitTextToSize(String(texto), ancho);
    }

    function rotulo(texto, x, yy, size, color, bold, opts) {
      sinTracking();
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor.apply(doc, color);
      doc.text(texto, x, yy, opts);
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

    /* Arco por segmentos: jsPDF no sabe dibujar arcos. Ángulos en
       radianes con el cero arriba, que es como se lee un medidor. */
    function arco(cx, cy, r, a0, a1, color, grosor) {
      doc.setDrawColor.apply(doc, color);
      doc.setLineWidth(grosor);
      try { doc.setLineCap('round'); } catch (e) {}
      var pasos = Math.max(12, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 60)));
      var px, py;
      for (var i = 0; i <= pasos; i++) {
        var t = a0 + (a1 - a0) * i / pasos;
        var x = cx + r * Math.sin(t), yv = cy - r * Math.cos(t);
        if (i > 0) doc.line(px, py, x, yv);
        px = x; py = yv;
      }
      try { doc.setLineCap('butt'); } catch (e) {}
    }

    // Medidor circular: aro tenue de fondo y arco lleno hasta la
    // fracción indicada.
    function medidor(cx, cy, r, frac, color) {
      var g = 2.6, rr = r - g / 2;
      doc.setDrawColor.apply(doc, C_HAIR);
      doc.setLineWidth(g);
      doc.circle(cx, cy, rr, 'S');
      if (frac > 0) arco(cx, cy, rr, 0, Math.PI * 2 * Math.min(frac, 1), color, g);
    }

    /* ── Cabecera y pie ───────────────────────────────────────── */
    var decoradas = {};
    function paginaActual() {
      try { return doc.internal.getCurrentPageInfo().pageNumber; } catch (e) { return 1; }
    }

    /* El pie es idéntico en todas las páginas, portada incluida: marca y
       trazabilidad a la izquierda, verificación a la derecha.

       El QR va en TODAS las páginas y no solo al final. Un reporte se
       enseña suelto, se fotografía una hoja o se imprime de a poco; con
       el QR únicamente en la última, la página que acaba en manos del
       comprador no se puede comprobar. El folio impreso al lado no es
       adorno: si el QR se estropea al fotocopiar, se teclea a mano. */
    function pie(pn) {
      hairline(PIE.filete);
      rotulo('Filtro Vehicular+', M, PIE.l1, T.mini, C_INK, true);
      var fw = doc.getTextWidth('Filtro Vehicular+');
      rotulo('· Plataforma de consultas vehiculares', M + fw + 1.6, PIE.l1, T.mini, C_MUTED);
      rotulo((folio ? 'Folio ' + folio + '  ·  ' : '') + 'Emitido el ' + fecha,
             M, PIE.l2, T.micro, C_MUTED);

      if (folio) {
        var qx = W - M - PIE.qr, qy = PIE.filete + 2;
        var pintado = dibujarQR(doc, VERIFICA + '?f=' + encodeURIComponent(folio),
                                qx, qy, PIE.qr);
        /* El hueco a la izquierda del QR es de la numeración en las
           páginas interiores, y la portada no se numera: solo ahí cabe
           decir para qué sirve el código. */
        if (pintado) {
          if (pn === 1) {
            versalita('Verifica este reporte', qx - 3, PIE.l1,
                      { size: 5.4, track: 0.4, align: 'right' });
            rotulo('filtrovehicularperu.com/verificar', qx - 3, PIE.l2, 5.6, C_MUTED,
                   false, { align: 'right' });
          }
        } else {
          versalita('Verifica en', W - M, PIE.l1, { size: 5.6, align: 'right' });
          rotulo(VERIFICA, W - M, PIE.l2, 5.6, C_MUTED, false, { align: 'right' });
        }
      }
    }

    // Membrete de las páginas interiores. La portada lleva su banda y no
    // repite el membrete: sería decir dos veces lo mismo en 60 mm.
    function membrete() {
      rotulo('Filtro Vehicular', M, CAB.texto, 9.5, C_INK, true);
      var wm = doc.getTextWidth('Filtro Vehicular');
      rotulo('+', M + wm + 0.5, CAB.texto, 9.5, C_ACCENT, true);
      if (valor) {
        var wp = doc.getTextWidth('+') + wm;
        rotulo('· ' + valor, M + wp + 2.4, CAB.texto, 8, C_MUTED);
      }
      hairline(CAB.filete);
      fileteBicolor(M, CAB.filete, 18, 0.7);
    }

    function cromo() {
      var pn = paginaActual();
      if (decoradas[pn]) return;
      decoradas[pn] = true;
      if (pn !== 1) membrete();
      pie(pn);
    }

    var y = CUERPO.top;
    function av(n) { y += n * U; }                       // avanza n unidades de ritmo
    function nuevaPagina() { doc.addPage(); cromo(); y = CUERPO.top; }
    function need(mm) { if (y + mm > CUERPO.bottom) nuevaPagina(); }

    cromo();

    /* ══════════════════════════════════════════════════════════
       PORTADA
       ══════════════════════════════════════════════════════════ */
    var DV     = /DATOS DEL VEH/i;
    var marca  = findVal(secciones, /^Marca\s*\/\s*Modelo/i) || findVal(secciones, /^Marca/i);
    var anio   = findVal(secciones, /^A[ñn]o Fabricaci[óo]n/i);
    var color  = findVal(secciones, /^Color/i, DV);
    var carro  = findVal(secciones, /^Carrocer[íi]a/i, DV);
    var estado = findVal(secciones, /^Estado$/i, DV);
    var placa  = findVal(secciones, /^N[°º]? de Placa/i) || valor;

    /* Banda de identidad. Es la única superficie oscura del informe y
       usa el mismo tono que las superficies oscuras de la plataforma, no
       un gris inventado para la ocasión. */
    doc.setFillColor(14, 19, 18);                        // #0e1312
    doc.rect(0, 0, W, PORTADA.banda, 'F');

    rotulo('Filtro Vehicular', M, 32, 18, [255, 255, 255], true);
    var wmp = doc.getTextWidth('Filtro Vehicular');
    rotulo('+', M + wmp + 1, 32, 18, C_ACCENT, true);
    versalita('Plataforma de consultas vehiculares', M, 40,
              { size: T.micro, color: [150, 158, 156], track: 1 });

    if (folio) {
      versalita('Folio del documento', W - M, 29,
                { size: 5.8, color: [150, 158, 156], track: 0.8, align: 'right' });
      rotulo(folio, W - M, 36, 10, [255, 255, 255], true, { align: 'right' });
    }
    fileteBicolor(M, PORTADA.banda, 46, 1.2);

    y = PORTADA.banda + U * 4;                           // 74
    versalita('Informe consolidado', M, y, { size: T.mini, color: C_TURQ, track: 1.4 });

    av(3);                                               // 86
    rotulo('Reporte Vehicular', M, y, T.h1, C_INK, true);
    av(3);                                               // 98
    rotulo('Integral', M, y, T.h1, C_INK, true);
    av(2);                                               // 106
    rotulo('Documento emitido el ' + fecha, M, y, T.base, C_MUTED);

    /* ── Ficha del vehículo: 4 columnas de matrícula + 7 de atributos ──
       Los dos bloques miden lo mismo de alto y cierran en la misma línea:
       el recuadro no puede quedar colgando sobre una retícula más larga
       ni al revés. */
    av(3.5);                                             // 120
    var fichaTop = y, fichaH = 26;

    /* La matrícula va suelta, con el filete de marca debajo y del ancho
       exacto del texto. El recuadro imitaba una chapa, competía con la
       retícula y obligaba a meter el número 5 mm hacia dentro, así que
       la placa dejaba de alinear con la columna de atributos. La
       jerarquía ya la da el cuerpo de 30 pt. */
    versalita('Placa', gx(0), fichaTop + 5, { size: T.micro, track: 0.8 });
    rotulo(placa || '—', gx(0), fichaTop + 17, T.placa, C_INK, true, { maxWidth: gw(4) });
    fileteBicolor(gx(0), fichaTop + 20.5,
                  Math.min(Math.max(doc.getTextWidth(placa || '—'), 24), gw(4)), 1.2);

    var attrs = [
      ['Marca y modelo', marca], ['Año', anio], ['Color', color],
      ['Carrocería', carro], ['Estado', estado]
    ].filter(function (a) { return a[1]; });

    var ATTR_COLS = 3;
    var attrW = gw(7) / ATTR_COLS;
    attrs.forEach(function (a, i) {
      var cx = gx(5) + (i % ATTR_COLS) * attrW;
      var cy = fichaTop + 5 + Math.floor(i / ATTR_COLS) * (fichaH / 2);
      versalita(a[0], cx, cy, { size: T.micro, track: 0.4 });
      rotulo(String(a[1]), cx, cy + 5, 9, C_INK, true, { maxWidth: attrW - 4 });
    });
    y = fichaTop + fichaH;

    av(2);                                               // 154
    hairline(y);

    /* ── Veredicto ────────────────────────────────────────────────
       Lo primero del informe, y con una sola voz.

       Manda el veredicto propio, que es el que se puede defender delante
       de un cliente. El índice del proveedor no se esconde: se imprime
       debajo, dicho de quién es, para que quien compare las dos cifras
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
      var parcial = VER.nivel === 'SIN DETERMINAR';

      av(1.5);                                           // 158
      versalita('Veredicto de la plataforma', M, y, { size: T.mini, track: 1.2 });

      /* ── El medidor ────────────────────────────────────────────
         El círculo mide algo y lo dice con un número: qué parte de las
         fuentes consultadas llegó a responder. Antes era un disco de
         color a secas —y cuando no había nivel, un aro vacío— así que
         ocupaba el sitio más visible de la portada sin aportar un dato.

         Lo que mide es la COMPROBACIÓN, no el riesgo: el riesgo lo dice
         la palabra de al lado y el color del arco. Y no es el índice del
         proveedor, que se imprime aparte y con su nombre, porque su
         criterio no está publicado; este porcentaje se calcula con lo
         que tenemos delante y se puede defender fuente por fuente.

         Cuando el veredicto es parcial el arco va en gris: un semáforo
         que no puede calificar no debe pintarse de verde ni de rojo. */
      av(1);                                             // 162
      var medR = 13, medX = gx(0) + medR, medY = y + medR;
      var cob = (VER.modelo && VER.modelo.cobertura) || [];

      /* Respaldo de la cobertura. El modelo se arma con el texto del bot,
         y si ese texto no traía secciones el medidor se quedaba en «sin
         datos» justo en la portada. Cuando eso pasa se mide lo que sí
         tenemos delante: las secciones leídas del PDF. */
      if (!cob.length && Consultia.ReporteModelo && secciones.length) {
        try {
          cob = Consultia.ReporteModelo.desdeSecciones(secciones, meta.valor).cobertura || [];
          if (VER.modelo) VER.modelo.cobertura = cob;
        } catch (e) {
          console.warn('[metapla] sin cobertura de respaldo:', e);
        }
      }

      var responden = cob.filter(function (c) { return c.estado !== 'sin respuesta'; }).length;
      var frac = cob.length ? responden / cob.length : null;

      /* ── Qué enseña el aro ─────────────────────────────────────────
         El índice de riesgo, que es lo que alguien busca en la primera
         página. Estuvo enseñando el porcentaje de fuentes que
         respondieron —«100 % comprobado»— y eso no es un riesgo: un
         vehículo con una denuncia y todas las fuentes contestando salía
         con el aro lleno, como si estuviera limpio.

         El número lo pone el proveedor mientras la plataforma no calcule
         el suyo, y por eso se rotula como suyo. La cobertura no se
         pierde: baja al renglón de al lado, que es su sitio.

         El COLOR manda sobre el número y sale del veredicto propio
         siempre que lo haya —es el criterio que podemos defender—; solo
         cuando el nuestro queda parcial se toma el nivel del proveedor,
         y a falta de nivel se deduce del puntaje. Un semáforo de un
         informe de riesgo no puede quedarse en gris teniendo delante la
         información para encenderlo. */
      var score = R.score && !isNaN(Number(R.score)) ? Number(R.score) : null;

      /* El color describe el NÚMERO que hay dentro del aro, no otra cosa.
         Estuvo saliendo del veredicto propio incluso cuando el aro
         mostraba el índice del proveedor: un 40 —riesgo alto— se pintaba
         de verde porque nuestra lectura decía «bajo». Dos afirmaciones
         opuestas en el mismo dibujo.

         Con el índice dentro manda el nivel del proveedor, y a falta de
         nivel se deduce del puntaje: de 85 para arriba verde, de 60 a 84
         ámbar, por debajo rojo. El veredicto propio no se queda sin
         color — lo lleva el titular de al lado. */
      var colorIndice = R.nivel
        ? riskColor(R.nivel)
        : (score === null ? C_MUTED : (score >= 85 ? C_OK : (score >= 60 ? C_WARN : C_BAD)));
      var colorCobertura = parcial ? C_MUTED : vc;

      if (score !== null) {
        medidor(medX, medY, medR, Math.max(0, Math.min(1, score / 100)), colorIndice);
        /* Dentro del aro solo caben el número y su escala. La atribución
           —de quién es el índice— iba también aquí, en un cuerpo de 4,4
           pt, y a esa altura el aro ya se ha cerrado: el rótulo cruzaba
           el trazo. Se dice en el renglón de al lado, con sitio de
           sobra. */
        rotulo(String(R.score), medX, medY + 1, 15, C_INK, true, { align: 'center' });
        rotulo('de 100', medX, medY + 5.4, T.micro, C_MUTED, false, { align: 'center' });
      } else if (frac !== null) {
        // Sin índice, se enseña lo que sí se puede afirmar: cuánto se comprobó.
        medidor(medX, medY, medR, frac, colorCobertura);
        rotulo(Math.round(frac * 100) + '%', medX, medY + 1, T.h3, C_INK, true,
               { align: 'center' });
        versalita('Comprobado', medX, medY + 6, { size: 5, track: 0.3, align: 'center' });
      } else {
        // Ni índice ni cobertura: el aro se queda vacío y lo admite.
        doc.setDrawColor.apply(doc, C_HAIR);
        doc.setLineWidth(2.6);
        doc.circle(medX, medY, medR - 1.3, 'S');
        versalita('Sin datos', medX, medY + 1, { size: 5.4, track: 0.3, align: 'center' });
      }

      var tx = gx(0) + medR * 2 + 8;
      var txW = W - M - tx;
      rotulo(parcial ? 'Veredicto parcial'
                     : 'Riesgo ' + VER.nivel.charAt(0) + VER.nivel.slice(1).toLowerCase(),
             tx, y + 11, T.h2, vc, true);
      rotulo(parcial
        ? 'Falta información para calificar el riesgo; lo comprobado se detalla abajo.'
        : 'Lectura de la plataforma sobre los registros consultados.',
        tx, y + 17, T.mini, C_MUTED, false, { maxWidth: txW });
      /* `notas`, no `pie`: hay una función pie() —la del pie de página— en
         este mismo ámbito, y una variable con su nombre la sombreaba
         entera. El cromo de la segunda página reventaba con «pie is not a
         function». */
      var notas = [];
      if (score !== null) {
        notas.push('Índice del proveedor: ' + R.score + ' de 100' +
                   (R.nivel ? ' (riesgo ' + R.nivel.toLowerCase() + ')' : ''));
      }
      if (cob.length) {
        notas.push(responden + ' de ' + cob.length + ' fuentes respondieron' +
                   (responden < cob.length ? '; el resto quedó sin comprobar' : ''));
      }
      if (notas.length) {
        rotulo(notas.join(' · ') + '.', tx, y + 22.5, T.mini, C_MUTED, false, { maxWidth: txW });
      }
      y += medR * 2;                                     // 188

      /* Las tres respuestas, en tercios de la retícula: sin cajas de
         color, separadas por filete y con el estado en un punto. */
      av(1);                                             // 192
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
      var altoCol = 24;
      hairline(y, M, W - M, C_INK, 0.4);
      respuestas.forEach(function (r, i) {
        var x0 = gx(i * 4), ancho = gw(4);
        if (i) vline(x0 - GRID.gutter / 2, y, y + altoCol - U);
        versalita(r[0], x0, y + 5, { size: T.micro, track: 0.4 });
        punto(x0 + 1.4, y + 11.4, estadoColor(r[3]), 1.5);
        rotulo(String(r[1]), x0 + 5, y + 13, T.h3, C_INK, true, { maxWidth: ancho - 5 });
        rotulo(parte(r[2] || '', ancho, T.micro), x0, y + 18.5, T.micro, C_MUTED);
      });
      y += altoCol;

      // Por qué. Sin esto el veredicto es una opinión.
      if (VER.motivos.length) {
        av(1);
        hairline(y);
        av(1);
        versalita('Fundamento', M, y, { size: T.micro, track: 0.8 });
        av(1.5);
        VER.motivos.forEach(function (mo) {
          var lineas = parte(mo, gw(11), T.base);
          punto(M + 1, y - 1.2, C_HAIR, 0.9);
          rotulo(lineas, gx(0) + 5, y, T.base, C_INK);
          y += lineas.length * LH.base + 1.2;
        });
      }

      // El índice del proveedor, dicho de quién es.
      if (R.score) {
        av(0.5);
        rotulo('El puntaje del aro lo calcula el proveedor y su criterio no está ' +
               'publicado; el veredicto de esta página es el de la plataforma.',
               M, y, T.mini, C_MUTED, false, { maxWidth: CW });
        av(1.5);
      }
    }

    /* ── Nota de alcance ──────────────────────────────────────────
       Un informe serio dice de dónde sale y hasta dónde llega antes de
       que alguien tome una decisión con él. Va al pie de la portada
       cuando queda sitio; si el fundamento creció y no cabe, se imprime
       al cierre del documento en vez de apretarla contra el pie. */
    var NOTA = 'Este documento reúne la información devuelta por las fuentes oficiales ' +
               'consultadas en la fecha de emisión. El veredicto es una lectura de esos ' +
               'registros y no sustituye la verificación física del vehículo ni el trámite ' +
               'ante la entidad correspondiente. Su autenticidad se comprueba con el folio y ' +
               'el código QR impresos en cada página.';

    /* `splitTextToSize` parte con la fuente ACTIVA, no con la que se
       vaya a usar después: midiendo con la que quedó puesta por el
       bloque anterior, la nota salía en líneas de 185 mm y se iba fuera
       de la caja. Se fija el cuerpo antes de medir, y se mide una sola
       vez para que el alto reservado y el dibujado sean el mismo. */
    function lineasNota() {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(T.micro);
      return doc.splitTextToSize(NOTA, CW - 10);
    }

    function notaAlcance(yy) {
      var lineas = lineasNota();
      var alto = lineas.length * LH.mini + 9;
      doc.setFillColor.apply(doc, C_SOFT);
      doc.rect(M, yy, CW, alto, 'F');
      versalita('Alcance del informe', M + 5, yy + 5.5, { size: 5.8, track: 0.8 });
      rotulo(lineas, M + 5, yy + 10.5, T.micro, C_MUTED);
      return alto;
    }

    var notaEnPortada = false;
    var notaAlto = lineasNota().length * LH.mini + 9;
    if (y + U * 2 + notaAlto <= CUERPO.bottom) {
      notaAlcance(CUERPO.bottom - notaAlto);
      notaEnPortada = true;
    }

    /* ══════════════════════════════════════════════════════════
       CUERPO
       ══════════════════════════════════════════════════════════ */
    nuevaPagina();

    /* Recuento del proveedor: trae cifras que el veredicto no da
       —propietarios, denuncias— pero rotulado, porque es su resumen y no
       el nuestro. Sin ese rótulo, dos bloques de cifras seguidos parecen
       el mismo análisis partido en dos. */
    if (R.indEtiquetas && R.indValores && R.indEtiquetas.length === R.indValores.length) {
      var n = R.indEtiquetas.length;
      versalita('Recuento del proveedor', M, y, { size: T.micro, track: 0.8 });
      av(1);
      hairline(y, M, W - M, C_INK, 0.4);
      var cardW = CW / n, cardH = U * 5;
      for (var ci = 0; ci < n; ci++) {
        var cx0 = M + ci * cardW;
        if (ci) vline(cx0 - GRID.gutter / 2, y, y + cardH - U);
        rotulo(String(R.indValores[ci] || '—'), cx0, y + 9, 15, C_INK, true,
               { maxWidth: cardW - 6 });
        versalita(String(R.indEtiquetas[ci] || ''), cx0, y + 14.5,
                  { size: 5.8, track: 0.3 });
      }
      y += cardH;
      av(2);
    }

    // ── Estilos comunes de tabla ──
    var margenTabla = { left: M, right: M, top: CUERPO.top, bottom: H - PIE.filete + 6 };
    var CABECERA = {
      fontSize: T.micro + 0.6, textColor: [255, 255, 255], fontStyle: 'bold', fillColor: C_INK,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, lineWidth: 0
    };
    var CUERPO_TABLA = {
      fontSize: T.base, textColor: C_INK, valign: 'top',
      cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 },
      lineWidth: { bottom: 0.1 }, lineColor: C_HAIR
    };

    /* Las columnas de importes y fechas se alinean a la derecha. En un
       informe con dinero dentro, una columna de cifras alineada a la
       izquierda es la señal más rápida de que el documento no lo hizo
       nadie: los soles dejan de comparar de un vistazo. */
    var RE_CIFRA = /^\s*(S\/\.?\s*)?-?\d[\d.,]*\s*$/;
    function columnasNumericas(cuerpo, maxCols) {
      var estilos = {};
      for (var c = 0; c < maxCols; c++) {
        var conDato = 0, numericas = 0;
        cuerpo.forEach(function (fila) {
          var v = String(fila[c] === undefined ? '' : fila[c]).trim();
          if (!v) return;
          conDato++;
          if (RE_CIFRA.test(v)) numericas++;
        });
        if (conDato >= 2 && numericas === conDato) estilos[c] = { halign: 'right' };
      }
      return estilos;
    }

    var indice = [];        // para la página de contenido
    var marcas = [];        // running head: qué sección corre en cada página
    var numSec = 0;

    secciones.forEach(function (sec) {
      var kv  = sec.filas.filter(function (f) { return f.t === 'kv'; });
      var txt = sec.filas.filter(function (f) { return f.t === 'txt'; });
      var row = sec.filas.filter(function (f) { return f.t === 'row'; });
      if (!kv.length && !txt.length && !row.length && !sec.imgs.length) return;

      numSec++;
      need(U * 8);

      /* Cabecera de sección: el número en gris claro y grande hace de
         guía al hojear; el título manda y el filete en tinta cierra. */
      var etiqueta = ('0' + numSec).slice(-2);
      rotulo(etiqueta, M, y, 15, C_HAIR, true);
      rotulo(sec.titulo, gx(1), y, T.h3, C_INK, true, { maxWidth: gw(11) });
      indice.push({ n: etiqueta, titulo: sec.titulo, pag: paginaActual() });
      marcas.push({ pag: paginaActual(), texto: etiqueta + ' · ' + sec.titulo });
      y += 3.6;
      hairline(y, M, W - M, C_INK, 0.4);
      av(2);

      // Campos: etiqueta tenue a la izquierda (4 columnas), valor en tinta.
      if (kv.length) {
        doc.autoTable({
          startY: y,
          body: kv.map(function (f) { return [f.a, f.b]; }),
          margin: margenTabla,
          tableLineWidth: 0,
          didDrawPage: cromo,
          bodyStyles: CUERPO_TABLA,
          columnStyles: {
            0: { cellWidth: gw(4), textColor: C_MUTED, fontSize: T.mini,
                 cellPadding: { top: 2.6, bottom: 2.6, left: 0, right: 3 } },
            1: { cellWidth: 'auto', fontStyle: 'bold' }
          },
          styles: { overflow: 'linebreak', lineWidth: 0, fillColor: false },
          theme: 'plain'
        });
        y = (doc.lastAutoTable && doc.lastAutoTable.finalY) || y;
        av(1.5);
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
        var alineadas = columnasNumericas(cuerpo, maxCols);
        doc.autoTable({
          startY: y,
          head: head || undefined,
          body: cuerpo,
          margin: margenTabla,
          tableLineWidth: 0,
          didDrawPage: cromo,
          headStyles: CABECERA,
          bodyStyles: CUERPO_TABLA,
          alternateRowStyles: { fillColor: C_SOFT },
          columnStyles: alineadas,
          styles: { overflow: 'linebreak', lineWidth: 0, fillColor: false },
          theme: 'plain'
        });
        y = (doc.lastAutoTable && doc.lastAutoTable.finalY) || y;
        av(1.5);
      }

      // Notas al pie de sección
      txt.forEach(function (f) {
        if (!f.a || f.a.length < 2) return;
        var ls = parte(f.a, CW, T.mini);
        need(ls.length * LH.mini + U);
        rotulo(ls, M, y + 2, T.mini, C_MUTED);
        y += ls.length * LH.mini + U;
      });

      /* ── Imágenes ── */
      if (sec.imgs.length) {
        av(0.5);
        var chicas = sec.imgs.filter(function (im) { return im.px <= 1000 && im.py <= 700; });
        var grandes = chicas.length > 1
          ? sec.imgs.filter(function (im) { return !(im.px <= 1000 && im.py <= 700); })
          : sec.imgs;

        // Biométricas: alineadas por su base, con rótulo debajo
        if (chicas.length > 1) {
          var rotulos = ['Fotografía', 'Firma', 'Huella derecha', 'Huella izquierda'];
          var maxHb = U * 9;
          need(maxHb + U * 3);
          var slot = CW / chicas.length, base = y + maxHb;
          chicas.forEach(function (im, i) {
            var esc = Math.min((slot - 10) / im.px, maxHb / im.py);
            var dw = im.px * esc, dh = im.py * esc, cx = M + slot * i + slot / 2;
            try {
              doc.addImage(im.dataUrl, 'JPEG', cx - dw / 2, base - dh, dw, dh, undefined, 'FAST');
            } catch (e) { /* imagen no insertable */ }
            versalita(rotulos[i] || ('Imagen ' + (i + 1)), cx, base + 4.6,
                      { size: 5.8, track: 0.3, align: 'center' });
          });
          y = base + U * 2.5;
        }

        /* Documentos e ilustraciones.

           Ninguna imagen se estira ya a página ancha por el hecho de
           estar sola. El logotipo de la marca del vehículo venía en unos
           cientos de píxeles y se imprimía a 170 mm: media hoja de negro
           para decir «Kia», con más presencia que el veredicto.

           Se distinguen por lo que son: un LOGOTIPO es pequeño y ancho
           —marcas, sellos, escudos— y se acota a 46 mm, alineado a la
           izquierda como un dato más; un DOCUMENTO escaneado trae
           resolución de sobra y ocupa el ancho de la columna, pero nunca
           más de lo que da su propia resolución a 300 ppp: ampliar un
           escaneo pobre solo agranda sus defectos. */
        var caps = sec.caps || [];
        grandes.forEach(function (im, gi) {
          var cap = caps[gi] || '';
          var esLogo = im.px <= 1400 && im.py <= 1000;
          var anchoMax = esLogo ? 46 : Math.min(CW, (im.px / 300) * 25.4);
          var altoMax = esLogo ? 34 : CUERPO.bottom - CUERPO.top - U * 3;
          var esc = Math.min(anchoMax / im.px, altoMax / im.py);
          var dw = im.px * esc, dh = im.py * esc;
          if (y + dh + (cap ? U * 1.5 : 0) > CUERPO.bottom) nuevaPagina();
          if (cap) {
            versalita(cap, M, y, { size: T.micro, track: 0.4 });
            av(1);
          }
          // El documento se centra en la columna; el logotipo va a margen.
          var ix = esLogo ? M : M + (CW - dw) / 2;
          try {
            doc.addImage(im.dataUrl, 'JPEG', ix, y, dw, dh, undefined, 'FAST');
          } catch (e) { /* imagen no insertable */ }
          doc.setDrawColor.apply(doc, C_HAIR);
          doc.setLineWidth(0.2);
          doc.rect(ix, y, dw, dh);
          y += dh + U * 2;
        });
      }

      av(2);
    });

    /* ── Cobertura ────────────────────────────────────────────────
       Qué se consultó y qué contestó cada fuente. Es el apartado que
       convierte el silencio en información: sin él, una sección que no
       respondió se lee igual que una limpia, y alguien puede comprar un
       vehículo confiando en algo que nunca se comprobó. */
    if (VER && VER.modelo && VER.modelo.cobertura && VER.modelo.cobertura.length) {
      need(U * 12);
      rotulo('Fuentes consultadas', M, y, T.h3, C_INK, true);
      indice.push({ n: '·', titulo: 'Fuentes consultadas', pag: paginaActual() });
      marcas.push({ pag: paginaActual(), texto: 'Fuentes consultadas' });
      y += 3.6;
      hairline(y, M, W - M, C_INK, 0.4);
      av(2);

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
        bodyStyles: CUERPO_TABLA,
        alternateRowStyles: { fillColor: C_SOFT },
        columnStyles: { 1: { cellWidth: gw(5) } },
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
      av(1.5);
    }

    // La nota de alcance que no cupo en la portada cierra el documento.
    if (!notaEnPortada) {
      need(notaAlto + U);
      notaAlcance(y);
      y += notaAlto;
    }

    /* ── Índice, insertado como página 2 ──────────────────────────
       Se dibuja al final, cuando ya se sabe en qué página cayó cada
       sección, y se mueve delante. Si el informe trae tantas secciones
       que no cabrían en una página, no se imprime: media tabla de
       contenidos confunde más que ninguna. */
    var CABE_INDICE = Math.floor((CUERPO.bottom - CUERPO.top - U * 6) / (U * 2));
    var conIndice = false;
    if (indice.length > 2 && indice.length <= CABE_INDICE &&
        typeof doc.movePage === 'function' && typeof doc.deletePage === 'function') {
      try {
        doc.addPage();
        cromo();
        var iy = CUERPO.top + U;
        versalita('Contenido', M, iy, { size: T.mini, track: 1.4 });
        iy += U * 2.5;
        rotulo('Índice del informe', M, iy, 19, C_INK, true);
        iy += 4;
        hairline(iy, M, W - M, C_INK, 0.4);
        iy += U * 2;
        indice.forEach(function (it) {
          // Todo lo que iba de la página 2 en adelante baja un lugar.
          var pag = it.pag >= 2 ? it.pag + 1 : it.pag;
          rotulo(it.n, M, iy, T.base, C_MUTED, true);
          rotulo(it.titulo, gx(1), iy, 9.4, C_INK, true, { maxWidth: gw(9) });
          rotulo(String(pag), W - M, iy, 9.4, C_MUTED, false, { align: 'right' });
          hairline(iy + 2.6);
          iy += U * 2;
        });
        doc.movePage(doc.getNumberOfPages(), 2);
        conIndice = true;
      } catch (e) {
        console.warn('[metapla] sin índice:', e);
        try { doc.deletePage(doc.getNumberOfPages()); } catch (e2) {}
      }
    }

    /* ── Pasada final: running head y numeración ──────────────────
       Las dos cosas necesitan saber el total de páginas y en cuál acabó
       cada sección, así que se pintan cuando ya no se añade nada. El
       encabezado corriente se resuelve por posición: cada página lleva
       la última sección abierta en ella o antes. */
    if (conIndice) {
      marcas.forEach(function (mk) { if (mk.pag >= 2) mk.pag += 1; });
      marcas.push({ pag: 2, texto: 'Contenido' });
    }
    marcas.sort(function (a, b) { return a.pag - b.pag; });

    var total = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : 1;
    for (var pn = 2; pn <= total; pn++) {                // la portada no se rotula ni se numera
      doc.setPage(pn);

      var corre = '';
      for (var mi = 0; mi < marcas.length; mi++) {
        if (marcas[mi].pag <= pn) corre = marcas[mi].texto; else break;
      }
      if (corre) {
        if (corre.length > 46) corre = corre.slice(0, 45) + '…';
        versalita(corre, W - M, CAB.texto, { size: T.micro, track: 0.5, align: 'right' });
      }

      versalita('Página', W - M - PIE.qr - 3, PIE.l1, { size: 5.4, track: 0.4, align: 'right' });
      rotulo(pn + ' de ' + total, W - M - PIE.qr - 3, PIE.l2 + 0.4, T.mini, C_INK, true,
             { align: 'right' });
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
