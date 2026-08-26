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
     ══════════════════════════════════════════════════════════ */

  function buildPdf(secciones, meta) {
    var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = doc.internal.pageSize.getWidth();   // 210
    var H = doc.internal.pageSize.getHeight();  // 297
    var M = 20;                 // margen lateral, retícula amplia
    var HEAD_Y = 14;            // línea base del membrete
    var TOP = 32;               // inicio del área de contenido
    var FOOT = H - 20;          // filete del pie
    var COLW = W - M * 2;

    var valor = (meta && meta.valor ? String(meta.valor) : '').toUpperCase();
    var fecha = (meta && meta.fecha) || new Date().toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    function hairline(y, x0, x1, color, grosor) {
      doc.setDrawColor.apply(doc, color || C_HAIR);
      doc.setLineWidth(grosor || 0.2);
      doc.line(x0 === undefined ? M : x0, y, x1 === undefined ? W - M : x1, y);
    }

    // Filete corto de dos tramos (verde + turquesa): el acento recurrente
    // que hila la identidad a lo largo del documento.
    function fileteBicolor(x, yy, largo, grosor) {
      var mitad = largo / 2;
      doc.setLineWidth(grosor || 0.8);
      doc.setDrawColor.apply(doc, C_ACCENT);
      doc.line(x, yy, x + mitad, yy);
      doc.setDrawColor.apply(doc, C_TURQ);
      doc.line(x + mitad, yy, x + largo, yy);
    }

    // Arco de círculo trazado por segmentos (jsPDF no tiene arcos): base
    // del medidor de riesgo circular. Ángulos en radianes, 0 = arriba.
    function arco(cx, cy, r, a0, a1, color, grosor) {
      doc.setDrawColor.apply(doc, color);
      doc.setLineWidth(grosor);
      try { doc.setLineCap('round'); } catch (e) {}
      var pasos = Math.max(10, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 60)));
      var px, py;
      for (var i = 0; i <= pasos; i++) {
        var t = a0 + (a1 - a0) * i / pasos;
        var x = cx + r * Math.sin(t), yv = cy - r * Math.cos(t);
        if (i > 0) doc.line(px, py, x, yv);
        px = x; py = yv;
      }
      try { doc.setLineCap('butt'); } catch (e) {}
    }

    /* ── Membrete y pie: monograma, marca y filete bicolor ── */
    var decoradas = {};
    function cromo() {
      var pn = 1;
      try { pn = doc.internal.getCurrentPageInfo().pageNumber; } catch (e) { pn = 1; }
      if (decoradas[pn]) return;
      decoradas[pn] = true;

      /* ── Marca ──
         Solo el nombre. Aquí había además un cuadradito oscuro con un
         "+" dentro, a la izquierda: a este tamaño era una mancha que no
         se leía como nada y le robaba sitio al nombre, que es lo que sí
         se reconoce. El membrete de un documento no necesita un sello
         para decir de quién es. */
      var bx = M;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor.apply(doc, C_INK);
      doc.text('Filtro Vehicular', bx, HEAD_Y - 1);
      var wm = doc.getTextWidth('Filtro Vehicular');
      doc.setTextColor.apply(doc, C_ACCENT);
      doc.text('+', bx + wm + 0.6, HEAD_Y - 1);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.6);
      doc.setTextColor.apply(doc, C_MUTED);
      doc.text('PLATAFORMA DE CONSULTAS VEHICULARES', bx, HEAD_Y + 2.4);

      // ── Referencia a la derecha ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor.apply(doc, C_TURQ);
      doc.text('REPORTE VEHICULAR INTEGRAL', W - M, HEAD_Y - 3, { align: 'right' });
      if (valor) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.4);
        doc.setTextColor.apply(doc, C_INK);
        doc.text(valor, W - M, HEAD_Y + 1.6, { align: 'right' });
      }

      // ── Filete bajo el membrete: tramo bicolor + hairline ──
      hairline(HEAD_Y + 4.8);
      fileteBicolor(M, HEAD_Y + 4.8, 26, 0.8);

      // ── Pie ──
      hairline(FOOT);
      fileteBicolor(M, FOOT, 26, 0.8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.4);
      doc.setTextColor.apply(doc, C_INK);
      doc.text('Filtro Vehicular+', M, FOOT + 4.8);
      var fw = doc.getTextWidth('Filtro Vehicular+');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor.apply(doc, C_MUTED);
      doc.text('· Plataforma de consultas vehiculares', M + fw + 1.6, FOOT + 4.8);
      doc.setFontSize(6);
      doc.text('Información obtenida de fuentes oficiales · Emitido el ' + fecha,
               M, FOOT + 8.6);
    }

    var y = TOP;
    function nuevaPagina() { doc.addPage(); cromo(); y = TOP; }
    function need(mm) { if (y + mm > FOOT - 6) nuevaPagina(); }

    cromo();

    /* ══ PORTADA ══ */
    var DV     = /DATOS DEL VEH/i;
    var marca  = findVal(secciones, /^Marca\s*\/\s*Modelo/i) || findVal(secciones, /^Marca/i);
    var anio   = findVal(secciones, /^A[ñn]o Fabricaci[óo]n/i);
    var color  = findVal(secciones, /^Color/i, DV);
    var carro  = findVal(secciones, /^Carrocer[íi]a/i, DV);
    var estado = findVal(secciones, /^Estado$/i, DV);
    var placa  = findVal(secciones, /^N[°º]? de Placa/i) || valor;

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor.apply(doc, C_ACCENT);
    doc.text('INFORME CONSOLIDADO', M, y);
    y += 9;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor.apply(doc, C_INK);
    doc.text('Reporte Vehicular', M, y);
    y += 9.5;
    doc.text('Integral', M, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, C_MUTED);
    doc.text('Emitido el ' + fecha, M, y);
    y += 12;

    // Ficha del vehículo: placa dominante + atributos en dos columnas
    var fichaTop = y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.setTextColor.apply(doc, C_INK);
    doc.text(placa || '—', M, y + 9);
    var placaW = Math.max(doc.getTextWidth(placa || '—'), 24);
    fileteBicolor(M, y + 12.5, placaW, 1.1);

    var attrs = [
      ['Marca y modelo', marca], ['Año', anio], ['Color', color],
      ['Carrocería', carro], ['Estado', estado]
    ].filter(function (a) { return a[1]; });

    var ax = M + Math.max(placaW, 52) + 16;
    var ay = y + 1;
    attrs.forEach(function (a, i) {
      var cx = ax + (i % 2) * ((W - M - ax) / 2);
      var cy = ay + Math.floor(i / 2) * 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor.apply(doc, C_MUTED);
      doc.text(a[0].toUpperCase(), cx, cy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor.apply(doc, C_INK);
      doc.text(String(a[1]), cx, cy + 4, { maxWidth: (W - M - ax) / 2 - 4 });
    });
    y = Math.max(fichaTop + 16, ay + Math.ceil(attrs.length / 2) * 8 + 4);
    y += 6;
    hairline(y); y += 10;

    /* ── Veredicto ────────────────────────────────────────────────
       Lo primero de la primera página, y con una sola voz.

       Aquí antes iba el medidor circular con el puntaje del proveedor.
       Se veía bien y contradecía a la propia plataforma: el PDF decía
       «riesgo medio» —su criterio, que no conocemos— mientras la ficha
       en pantalla decía «riesgo alto» con el nuestro, que sí sabemos
       explicar. Dos cifras distintas para el mismo vehículo, en la misma
       consulta.

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

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.setTextColor.apply(doc, C_MUTED);
      doc.text('VEREDICTO', M, y + 4);

      doc.setFontSize(17);
      doc.setTextColor.apply(doc, vc);
      doc.text(VER.nivel === 'SIN DETERMINAR'
        ? 'Veredicto parcial'
        : 'Riesgo ' + VER.nivel.charAt(0) + VER.nivel.slice(1).toLowerCase(), M, y + 13);
      y += 19;

      // Las tres respuestas, en tres cajas del mismo ancho.
      var respuestas = [
        ['¿PUEDE CIRCULAR?', palabra(VER.circular.estado), VER.circular.resumen, VER.circular.estado],
        ['¿PUEDE TRANSFERIRSE?', palabra(VER.transferir.estado), VER.transferir.resumen, VER.transferir.estado],
        ['DEUDA REGISTRADA',
         (!VER.deuda.exacta && VER.deuda.total === 0) ? 'No totalizada' : VER.deuda.totalTexto,
         (!VER.deuda.exacta && VER.deuda.total === 0)
           ? 'Registros sin importe legible en ' + VER.deuda.entidadesIlegibles.join(', ')
           : (VER.deuda.ilegibles ? 'Y deuda sin totalizar en ' + VER.deuda.entidadesIlegibles.join(', ')
              : (VER.deuda.fuentesMudas ? VER.deuda.fuentesMudas + ' fuente(s) sin respuesta'
                 : 'Todas las fuentes respondieron')),
         !VER.deuda.exacta ? 'con reparos' : (VER.deuda.total > 0 ? 'no' : 'si')],
      ];
      var hueco = 4, anchoCaja = (COLW - hueco * 2) / 3, altoCaja = 25;
      respuestas.forEach(function (r, i) {
        var x0 = M + i * (anchoCaja + hueco);
        doc.setFillColor.apply(doc, C_SOFT);
        doc.rect(x0, y, anchoCaja, altoCaja, 'F');
        // Filete a color con el estado de ESA respuesta, no del conjunto.
        doc.setFillColor.apply(doc, estadoColor(r[3]));
        doc.rect(x0, y, 1.4, altoCaja, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.6);
        doc.setTextColor.apply(doc, C_MUTED);
        doc.text(r[0], x0 + 4, y + 5, { maxWidth: anchoCaja - 7 });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor.apply(doc, estadoColor(r[3]));
        doc.text(String(r[1]), x0 + 4, y + 12.5, { maxWidth: anchoCaja - 7 });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.4);
        doc.setTextColor.apply(doc, C_MUTED);
        doc.text(String(r[2] || ''), x0 + 4, y + 17.5, { maxWidth: anchoCaja - 7 });
      });
      y += altoCaja + 7;

      // Por qué. Sin esto el veredicto es una opinión.
      if (VER.motivos.length) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor.apply(doc, C_MUTED);
        doc.text('POR QUÉ', M, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.6);
        doc.setTextColor.apply(doc, C_INK);
        VER.motivos.forEach(function (mo) {
          var lineas = doc.splitTextToSize('·  ' + mo, COLW);
          doc.text(lineas, M, y);
          y += lineas.length * 4;
        });
        y += 3;
      }

      // El índice del proveedor, dicho de quién es.
      if (R.score) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.6);
        doc.setTextColor.apply(doc, C_MUTED);
        doc.text('Índice del proveedor: ' + R.score + ' de 100' +
                 (R.nivel ? ' (' + R.nivel.toLowerCase() + ')' : '') +
                 '. Criterio no publicado; el veredicto de arriba es el de la plataforma.',
                 M, y, { maxWidth: COLW });
        y += 6;
      }

      hairline(y); y += 8;
    }

    /* ── Indicadores del proveedor ────────────────────────────────
       Se conservan porque traen recuentos que el veredicto no da
       —propietarios, denuncias— pero rotulados: son su resumen, no el
       nuestro. Sin ese rótulo, dos bloques de cifras seguidos parecían
       el mismo análisis partido en dos. */
    if (R.indEtiquetas && R.indValores && R.indEtiquetas.length === R.indValores.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor.apply(doc, C_MUTED);
      doc.text('RESUMEN DEL PROVEEDOR', M, y);
      y += 4;
      var n = R.indEtiquetas.length;
      var ciclo = [C_ACCENT, C_TURQ, C_INK];
      var gap = 4, cardW = (COLW - (n - 1) * gap) / n, cardH = 17;
      for (var ci = 0; ci < n; ci++) {
        var cx0 = M + ci * (cardW + gap);
        doc.setFillColor.apply(doc, C_SOFT);
        doc.rect(cx0, y, cardW, cardH, 'F');
        doc.setFillColor.apply(doc, ciclo[ci % ciclo.length]);
        doc.rect(cx0, y, 1.4, cardH, 'F');   // filete lateral a color
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor.apply(doc, C_INK);
        doc.text(String(R.indValores[ci] || '—'), cx0 + 4, y + 7.5, { maxWidth: cardW - 7 });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.6);
        doc.setTextColor.apply(doc, C_MUTED);
        doc.text(String(R.indEtiquetas[ci] || ''), cx0 + 4, y + 12.5, { maxWidth: cardW - 7 });
      }
      y += cardH + 12;
    }

    /* ══ SECCIONES ══ */
    var numSec = 0;
    secciones.forEach(function (sec) {
      var kv  = sec.filas.filter(function (f) { return f.t === 'kv'; });
      var txt = sec.filas.filter(function (f) { return f.t === 'txt'; });
      var row = sec.filas.filter(function (f) { return f.t === 'row'; });
      if (!kv.length && !txt.length && !row.length && !sec.imgs.length) return;

      numSec++;
      need(26);

      // Encabezado: número en acento (alterna verde/turquesa), título en
      // tinta, filete debajo con un tramo del mismo acento.
      var acc = (numSec % 2) ? C_ACCENT : C_TURQ;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, acc);
      doc.text(('0' + numSec).slice(-2), M, y);
      doc.setFontSize(11);
      doc.setTextColor.apply(doc, C_INK);
      doc.text(sec.titulo, M + 9, y, { maxWidth: COLW - 9 });
      y += 3.5;
      hairline(y);
      doc.setDrawColor.apply(doc, acc);
      doc.setLineWidth(0.8);
      doc.line(M, y, M + 14, y);
      y += 7;

      // Campos: etiqueta tenue a la izquierda, valor en tinta
      if (kv.length) {
        doc.autoTable({
          startY: y,
          body: kv.map(function (f) { return [f.a, f.b]; }),
          margin: { left: M, right: M, top: TOP, bottom: H - FOOT + 6 },
          tableLineWidth: 0,
          didDrawPage: cromo,
          bodyStyles: {
            fontSize: 8.2, textColor: C_INK, valign: 'top',
            cellPadding: { top: 2.4, bottom: 2.4, left: 0, right: 2 },
            lineWidth: { bottom: 0.1 }, lineColor: C_HAIR
          },
          columnStyles: {
            0: { cellWidth: 54, textColor: C_MUTED, fontSize: 7.6 },
            1: { cellWidth: 'auto', fontStyle: 'bold' }
          },
          styles: { overflow: 'linebreak', lineWidth: 0, fillColor: false }
        });
        y = (doc.lastAutoTable && doc.lastAutoTable.finalY) || y;
        y += 5;
      }

      // Tablas: primera fila como cabecera cuando viene en versalitas
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
          margin: { left: M, right: M, top: TOP, bottom: H - FOOT + 6 },
          tableLineWidth: 0,
          didDrawPage: cromo,
          headStyles: {
            fontSize: 6.6, textColor: C_MUTED, fontStyle: 'bold', fillColor: false,
            cellPadding: { top: 0, bottom: 2, left: 0, right: 2 },
            lineWidth: { bottom: 0.3 }, lineColor: C_INK
          },
          bodyStyles: {
            fontSize: 7.6, textColor: C_INK, valign: 'top',
            cellPadding: { top: 2.2, bottom: 2.2, left: 0, right: 2 },
            lineWidth: { bottom: 0.1 }, lineColor: C_HAIR
          },
          styles: { overflow: 'linebreak', lineWidth: 0, fillColor: false },
          theme: 'plain'
        });
        y = (doc.lastAutoTable && doc.lastAutoTable.finalY) || y;
        y += 5;
      }

      // Notas al pie de sección
      txt.forEach(function (f) {
        if (!f.a || f.a.length < 2) return;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.4);
        doc.setTextColor.apply(doc, C_MUTED);
        var ls = doc.splitTextToSize(f.a, COLW);
        need(ls.length * 3.5 + 4);
        doc.text(ls, M, y + 2);
        y += ls.length * 3.5 + 3;
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
          var maxH = 32;
          need(maxH + 12);
          var slot = COLW / chicas.length, base = y + maxH;
          chicas.forEach(function (im, i) {
            var esc = Math.min((slot - 10) / im.px, maxH / im.py);
            var dw = im.px * esc, dh = im.py * esc, cx = M + slot * i + slot / 2;
            try {
              doc.addImage(im.dataUrl, 'JPEG', cx - dw / 2, base - dh, dw, dh, undefined, 'FAST');
            } catch (e) { /* imagen no insertable */ }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor.apply(doc, C_MUTED);
            doc.text(rotulos[i] || ('Imagen ' + (i + 1)), cx, base + 4, { align: 'center' });
          });
          y = base + 10;
        }

        // Documentos: a página ancha, con su pie tomado del original
        var caps = sec.caps || [];
        grandes.forEach(function (im, gi) {
          var cap = caps[gi] || '';
          var maxH = FOOT - TOP - 14;
          var esc = Math.min(COLW / im.px, maxH / im.py);
          var dw = im.px * esc, dh = im.py * esc;
          if (y + dh + (cap ? 6 : 0) > FOOT - 6) nuevaPagina();
          if (cap) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.4);
            doc.setTextColor.apply(doc, C_MUTED);
            doc.text(cap.toUpperCase(), M, y);
            y += 3.5;
          }
          var ix = M + (COLW - dw) / 2;
          try {
            doc.addImage(im.dataUrl, 'JPEG', ix, y, dw, dh, undefined, 'FAST');
          } catch (e) { /* imagen no insertable */ }
          doc.setDrawColor.apply(doc, C_HAIR);
          doc.setLineWidth(0.2);
          doc.rect(ix, y, dw, dh);
          y += dh + 7;
        });
      }

      y += 6;
    });

    /* ── Cobertura ────────────────────────────────────────────────
       Qué se consultó y qué contestó cada fuente. Es el apartado que
       convierte el silencio en información: sin él, una sección que no
       respondió se lee igual que una sección limpia, y alguien puede
       comprar un vehículo confiando en algo que nunca se comprobó. */
    if (VER && VER.modelo && VER.modelo.cobertura && VER.modelo.cobertura.length) {
      need(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor.apply(doc, C_INK);
      doc.text('Fuentes consultadas', M, y);
      y += 3.5;
      hairline(y);
      doc.setDrawColor.apply(doc, C_TURQ);
      doc.setLineWidth(0.8);
      doc.line(M, y, M + 14, y);
      y += 7;

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
        margin: { left: M, right: M, top: TOP, bottom: H - FOOT + 6 },
        tableLineWidth: 0,
        didDrawPage: cromo,
        headStyles: {
          fontSize: 6.6, textColor: C_MUTED, fontStyle: 'bold', fillColor: false,
          cellPadding: { top: 0, bottom: 2, left: 0, right: 2 },
          lineWidth: { bottom: 0.3 }, lineColor: C_INK
        },
        bodyStyles: {
          fontSize: 7.6, textColor: C_INK, valign: 'top',
          cellPadding: { top: 2.2, bottom: 2.2, left: 0, right: 2 },
          lineWidth: { bottom: 0.1 }, lineColor: C_HAIR
        },
        columnStyles: { 1: { cellWidth: 58 } },
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

    /* ── Folio ── */
    var total = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : 1;
    for (var pn = 1; pn <= total; pn++) {
      doc.setPage(pn);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor.apply(doc, C_MUTED);
      doc.text('PÁGINA', W - M, FOOT + 4.6, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor.apply(doc, C_INK);
      doc.text(pn + ' de ' + total, W - M, FOOT + 8.4, { align: 'right' });
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
