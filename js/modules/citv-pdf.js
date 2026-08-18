/* ============================================================
   DUPLICADO CITV — el PDF, con texto de verdad
   ------------------------------------------------------------
   Antes esto era una foto: se rasterizaba la hoja con html2canvas y
   se pegaba la imagen dentro de una página A4. Salía bien a la vista
   y mal para todo lo demás — no se podía seleccionar una placa, ni
   buscar un número, ni corregir una letra, y pesaba más de un mega.

   Ahora el PDF se dibuja. Se recorre el documento del certificado —el
   mismo <iframe> que el cliente está viendo, ya maquetado por el
   navegador— y cada caja se traduce: los bordes a líneas, los fondos a
   rectángulos, las letras a texto. El resultado es vectorial y
   editable; lo único que sigue siendo imagen es el fondo ornamental,
   que ya nació como tal.

   Por qué leer del navegador y no dibujar de memoria: la maqueta vive
   en citv-certificado.js y cambia. Un PDF con sus propias coordenadas
   se separaría del papel a la primera corrección; midiendo el documento
   real, los dos van siempre a la vez.

   La unidad es el milímetro y el factor sale de la propia hoja: 210 mm
   entre los píxeles que mide, así nada depende de a cuántos puntos por
   pulgada esté trabajando el navegador.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  // 1 px CSS son 0,75 pt. Es la conversión de siempre entre el tamaño de
  // letra de la pantalla y el de la imprenta.
  var PX_A_PT = 0.75;

  // Por debajo de esto una línea no se ve; jsPDF admite 0 y desaparece.
  var GROSOR_MINIMO_MM = 0.1;

  function color(txt) {
    var m = String(txt || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (n) { return parseFloat(n); });
    var a = p.length > 3 ? p[3] : 1;
    if (!a) return null;
    // Lo translúcido se mezcla con blanco: el papel de debajo es claro y
    // jsPDF no tiene transparencia de relleno sin estados gráficos.
    return {
      r: Math.round(255 - (255 - p[0]) * a),
      g: Math.round(255 - (255 - p[1]) * a),
      b: Math.round(255 - (255 - p[2]) * a),
    };
  }

  function esBlanco(txt) { return !String(txt || '').trim(); }

  function cargarImagen(url) {
    return new Promise(function (ok, fallo) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { fallo(new Error('No se pudo cargar ' + url)); };
      img.src = url;
    });
  }

  function formatoDe(src) {
    return /\.png|image\/png/i.test(src || '') ? 'PNG' : 'JPEG';
  }

  /* El fondo, comprimido antes de entrar.
     Dado un <img>, jsPDF lo pasa por un lienzo y lo guarda sin pérdida:
     la filigrana del certificado son 3 MB de PNG dentro del archivo, por
     una imagen que es papel envejecido y ni siquiera tiene bordes duros.
     Se convierte a JPEG con un tope de ancho —a 1600 px la trama sigue
     limpia impresa a 210 mm— y el PDF baja a unos pocos cientos de kB. */
  var FONDO_MAX_ANCHO = 1600;
  var FONDO_CALIDAD = 0.82;

  function aJpeg(img) {
    var escala = Math.min(1, FONDO_MAX_ANCHO / img.naturalWidth);
    var lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.naturalWidth * escala);
    lienzo.height = Math.round(img.naturalHeight * escala);
    var ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/jpeg', FONDO_CALIDAD);
  }

  /* Las líneas de una caja. Las tablas del certificado van con
     `border-collapse`, así que la raya entre dos celdas la declaran las
     dos: se dibuja dos veces en el mismo sitio y no se nota. */
  function bordes(pdf, cs, x, y, an, al) {
    var lados = [
      ['Top',    x,      y,      x + an, y],
      ['Right',  x + an, y,      x + an, y + al],
      ['Bottom', x,      y + al, x + an, y + al],
      ['Left',   x,      y,      x,      y + al],
    ];
    for (var i = 0; i < lados.length; i++) {
      var lado = lados[i][0];
      var grosor = parseFloat(cs['border' + lado + 'Width']) || 0;
      if (!grosor) continue;
      if (cs['border' + lado + 'Style'] === 'none') continue;
      var c = color(cs['border' + lado + 'Color']);
      if (!c) continue;
      pdf.setDrawColor(c.r, c.g, c.b);
      pdf.setLineWidth(Math.max(GROSOR_MINIMO_MM, grosor * this.mm));
      pdf.line(lados[i][1], lados[i][2], lados[i][3], lados[i][4]);
    }
  }

  /* Las líneas en que se parte un nodo de texto. El navegador ya decidió
     dónde corta cada renglón; aquí solo se le pregunta. Se mira letra a
     letra a qué altura cayó y se agrupan las que comparten renglón, que
     es la única forma de saber qué palabras fueron a parar a cada uno
     sin volver a calcular el reparto. */
  function renglones(nodo) {
    var rango = nodo.ownerDocument.createRange();
    rango.selectNodeContents(nodo);
    var cajas = rango.getClientRects();
    var texto = nodo.nodeValue;

    if (cajas.length <= 1) {
      if (!cajas.length) return [];
      return [{ texto: texto.trim(), caja: cajas[0] }];
    }

    var out = [];
    var actual = null;
    for (var i = 0; i < texto.length; i++) {
      rango.setStart(nodo, i);
      rango.setEnd(nodo, i + 1);
      var c = rango.getBoundingClientRect();
      if (!c.width && !c.height) continue;          // espacio al doblar
      if (!actual || Math.abs(c.top - actual.top) > 1) {
        actual = { top: c.top, izq: c.left, der: c.right, alto: c.height, letras: [] };
        out.push(actual);
      }
      actual.der = Math.max(actual.der, c.right);
      actual.izq = Math.min(actual.izq, c.left);
      actual.letras.push(texto[i]);
    }
    return out.map(function (l) {
      return {
        texto: l.letras.join('').trim(),
        caja: { left: l.izq, right: l.der, top: l.top, width: l.der - l.izq, height: l.alto },
      };
    }).filter(function (l) { return l.texto; });
  }

  async function generar(marco, nombre) {
    var doc = marco.contentDocument;
    var hoja = doc.querySelector('.page');
    var origen = hoja.getBoundingClientRect();
    var mm = 210 / origen.width;          // píxeles de la hoja → milímetros

    var pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var ctx = { mm: mm };

    // ── El fondo ornamental ────────────────────────────────────────
    // Es la única imagen que queda, y con razón: es una filigrana. Se
    // coloca como `cover`, igual que en pantalla — se agranda hasta tapar
    // la hoja y lo que sobra se sale por los lados, no se deforma.
    var capa = doc.querySelector('.page-background');
    var url = (getComputedStyle(capa).backgroundImage || '').match(/url\(["']?([^"')]+)/);
    if (url) {
      try {
        var fondo = await cargarImagen(url[1]);
        var proporcion = Math.max(210 / fondo.naturalWidth, 297 / fondo.naturalHeight);
        var fa = fondo.naturalWidth * proporcion, fl = fondo.naturalHeight * proporcion;
        pdf.addImage(aJpeg(fondo), 'JPEG', (210 - fa) / 2, (297 - fl) / 2, fa, fl, 'fondo');
      } catch (e) {
        console.warn('[citv] el PDF va sin el fondo:', e);
      }
    }

    var x0 = origen.left, y0 = origen.top;
    var aX = function (px) { return (px - x0) * mm; };
    var aY = function (px) { return (px - y0) * mm; };

    function pintarCaja(el) {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;

      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return true;
      var x = aX(r.left), y = aY(r.top), an = r.width * mm, al = r.height * mm;

      // El círculo azul del pie: un div redondo con fondo, nada más.
      var relleno = color(cs.backgroundColor);
      var radio = cs.borderTopLeftRadius || '';
      if (relleno && radio.indexOf('%') > -1 && Math.abs(r.width - r.height) < 2) {
        pdf.setFillColor(relleno.r, relleno.g, relleno.b);
        pdf.circle(x + an / 2, y + al / 2, an / 2, 'F');
        return true;
      }

      if (relleno) {
        pdf.setFillColor(relleno.r, relleno.g, relleno.b);
        pdf.rect(x, y, an, al, 'F');
      }
      bordes.call(ctx, pdf, cs, x, y, an, al);

      if (el.tagName === 'IMG' && el.src) {
        try {
          pdf.addImage(el, formatoDe(el.src), x, y, an, al, undefined, 'MEDIUM');
        } catch (e) {
          console.warn('[citv] una imagen se quedó fuera del PDF:', e);
        }
      }
      return true;
    }

    function pintarTexto(nodo, cs) {
      var c = color(cs.color) || { r: 0, g: 0, b: 0 };
      var cuerpo = parseFloat(cs.fontSize) * PX_A_PT;
      var negrita = (parseInt(cs.fontWeight, 10) || 400) >= 600 || cs.fontWeight === 'bold';
      var cursiva = cs.fontStyle === 'italic';
      var estilo = negrita ? (cursiva ? 'bolditalic' : 'bold') : (cursiva ? 'italic' : 'normal');
      var alineado = cs.textAlign;

      pdf.setTextColor(c.r, c.g, c.b);
      pdf.setFont('helvetica', estilo);

      renglones(nodo).forEach(function (linea) {
        var caja = linea.caja;
        var an = caja.width * mm;
        var y = aY(caja.top + caja.height / 2);

        /* Helvetica no mide exactamente igual que la Arial de la
           pantalla. Si por eso el texto se pasa de su casilla, se le baja
           el cuerpo lo justo: antes se salga una letra del recuadro,
           mejor medio punto menos. */
        pdf.setFontSize(cuerpo);
        var ancho = pdf.getTextWidth(linea.texto);
        if (ancho > an && an > 0) pdf.setFontSize(cuerpo * (an / ancho));

        var x, ancla;
        if (alineado === 'center') { x = aX(caja.left) + an / 2; ancla = 'center'; }
        else if (alineado === 'right' || alineado === 'end') { x = aX(caja.right); ancla = 'right'; }
        else { x = aX(caja.left); ancla = 'left'; }

        pdf.text(linea.texto, x, y, { align: ancla, baseline: 'middle' });
      });
    }

    /* El recorrido empieza en `.page-content`, no en la hoja.

       La hoja lleva `background: white` y se pintaba entera de blanco
       después de haber colocado la filigrana: el PDF salía con el fondo
       dentro del archivo pero tapado, y el cliente recibía un
       certificado en papel liso. La hoja no hay que pintarla —la página
       del PDF ya es blanca— y lo único que va debajo del contenido es la
       filigrana, que ya está puesta.

       De ahí para adentro, cada caja antes que lo que lleva dentro, para
       que ningún fondo tape el texto que ya se pintó. */
    (function recorrer(el) {
      if (el.classList && el.classList.contains('page-background')) return;
      if (!pintarCaja(el)) return;

      var cs = getComputedStyle(el);
      for (var i = 0; i < el.childNodes.length; i++) {
        var hijo = el.childNodes[i];
        if (hijo.nodeType === 3) {
          if (!esBlanco(hijo.nodeValue)) pintarTexto(hijo, cs);
        } else if (hijo.nodeType === 1) {
          recorrer(hijo);
        }
      }
    })(doc.querySelector('.page-content'));

    pdf.save(nombre);
  }

  Consultia.CitvPdf = { generar: generar };
})();
