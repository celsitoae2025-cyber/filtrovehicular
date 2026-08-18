/* ============================================================
   DUPLICADO CITV — el trámite entero, en un solo cuadro
   ------------------------------------------------------------
   Cuatro pasos sin sacar al cliente de donde está:

     1. el aviso  — qué es un CITV y cuánto tarda
     2. la placa  — y, si quiere, el logotipo de su centro
     3. la espera — rueda de carga mientras se consulta
     4. el papel  — la vista previa del certificado, con su PDF

   Antes el paso 4 no existía: el cuadro decía «se envió
   correctamente» y alguien, al otro lado, armaba el documento a mano
   en citv-emisor.html. Ese acuse se ha ido. Lo que hacía el emisor
   —leer /citv, leer /placa, numerar y montar la hoja— pasó aquí, y
   ahora el duplicado se emite solo, como cualquier otra consulta.

   Reusa el esqueleto del modal del Reporte Completo (.rep-modal):
   mismo cuadro, mismo fondo, mismo botón. Solo cambia el contenido.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var CERRAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var RELOJ_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';

  function htmlAviso() {
    return '' +
      '<div class="citv-aviso">' +
        '<header class="citv-membrete">' +
          '<span class="citv-chip">Trámite en línea</span>' +
          '<h4 class="citv-titulo">Duplicado de CITV</h4>' +
          '<p class="citv-sigla">Certificado de Inspección Técnica Vehicular</p>' +
          '<div class="citv-linea"><span></span><span></span><span></span><span></span></div>' +
        '</header>' +

        '<div class="citv-cuerpo">' +
          '<div class="citv-tiempo">' +
            '<span class="citv-tiempo-ico">' + RELOJ_SVG + '</span>' +
            '<div>' +
              '<strong class="citv-tiempo-cifra">Alrededor de un minuto</strong>' +
              '<span class="citv-tiempo-txt">Se emite aquí mismo, sin salir de esta pantalla.</span>' +
            '</div>' +
          '</div>' +

          '<p class="citv-texto">Tu duplicado se consulta al registro y se arma al instante. ' +
          'Cuando esté listo lo verás en este mismo cuadro y podrás descargarlo en PDF.</p>' +

          '<ul class="citv-puntos">' +
            '<li>Es el mismo certificado, con la validez de siempre.</li>' +
            '<li>Sirve para el original perdido, deteriorado o ilegible.</li>' +
            '<li>Si algo impide emitirlo, te avisamos y no se te cobra.</li>' +
          '</ul>' +
        '</div>' +
      '</div>';
  }

  /* Lo que cuesta el trámite. El precio es fijo y no vive en el catálogo,
     pero por debajo se pagan dos consultas que sí están en él (/citv y
     /placa). Para que el cliente no pague dos veces, lo que se le cobra
     aparte es solo la diferencia —ver `cobrarDiferencia()`—: entre las
     consultas y esa diferencia, el trámite suma exactamente esto. */
  var COSTO_CITV = 40;

  var PLACA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h2M11 10h2M16 10h2M6 14h12"/></svg>';

  var PDF_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v11"/><polyline points="8 10.5 12 14.5 16 10.5"/><path d="M4 17.5v1.6A1.9 1.9 0 0 0 5.9 21h12.2a1.9 1.9 0 0 0 1.9-1.9v-1.6"/></svg>';

  /* ── El logotipo del cliente ─────────────────────────────────────
     El certificado lleva el logo del centro de inspección, así que lo
     pone quien lo pide. Casi siempre llegará un cuadrado con fondo
     blanco —así lo guarda todo el mundo—, y sobre el papel ese blanco
     se ve como un parche. Se le quita aquí mismo, en el navegador del
     cliente, antes de montarlo en el certificado.

     Cómo se limpia: se miran los píxeles del borde hacia adentro; los
     que son casi blancos se vuelven transparentes, y después se
     recorta el marco vacío que queda. No se toca el blanco de dentro
     del dibujo —una letra blanca sobre un círculo verde sigue ahí—
     porque solo se borra lo que está conectado con el borde. */
  var LOGO_MAX_LADO = 600;      // más que esto no aporta al papel
  var BLANCO_MIN = 238;         // a partir de aquí se considera fondo

  function limpiarFondo(img) {
    var lienzo = document.createElement('canvas');
    var escala = Math.min(1, LOGO_MAX_LADO / Math.max(img.width, img.height));
    var an = Math.max(1, Math.round(img.width * escala));
    var al = Math.max(1, Math.round(img.height * escala));
    lienzo.width = an;
    lienzo.height = al;
    var ctx = lienzo.getContext('2d');
    ctx.drawImage(img, 0, 0, an, al);

    var datos = ctx.getImageData(0, 0, an, al);
    var px = datos.data;
    var esFondo = function (i) {
      return px[i] >= BLANCO_MIN && px[i + 1] >= BLANCO_MIN && px[i + 2] >= BLANCO_MIN;
    };

    /* Inundación desde los cuatro bordes: solo se borra el blanco que
       se toca con el marco. Se usa una pila propia y no recursión —una
       imagen de 600×600 desbordaría la pila del navegador. */
    var visto = new Uint8Array(an * al);
    var pila = [];
    for (var x = 0; x < an; x++) { pila.push(x, 0); pila.push(x, al - 1); }
    for (var y = 0; y < al; y++) { pila.push(0, y); pila.push(an - 1, y); }

    while (pila.length) {
      var py = pila.pop(), pxx = pila.pop();
      if (pxx < 0 || py < 0 || pxx >= an || py >= al) continue;
      var idx = py * an + pxx;
      if (visto[idx]) continue;
      visto[idx] = 1;
      var i4 = idx * 4;
      if (!esFondo(i4)) continue;
      px[i4 + 3] = 0;
      pila.push(pxx + 1, py); pila.push(pxx - 1, py);
      pila.push(pxx, py + 1); pila.push(pxx, py - 1);
    }
    ctx.putImageData(datos, 0, 0);

    // Recorte del marco vacío que dejó la limpieza.
    var x0 = an, y0 = al, x1 = -1, y1 = -1;
    for (var yy = 0; yy < al; yy++) {
      for (var xx = 0; xx < an; xx++) {
        if (px[(yy * an + xx) * 4 + 3] > 8) {
          if (xx < x0) x0 = xx;
          if (yy < y0) y0 = yy;
          if (xx > x1) x1 = xx;
          if (yy > y1) y1 = yy;
        }
      }
    }
    if (x1 < x0 || y1 < y0) return lienzo;   // imagen vacía: se deja igual

    var recorte = document.createElement('canvas');
    recorte.width = x1 - x0 + 1;
    recorte.height = y1 - y0 + 1;
    recorte.getContext('2d').drawImage(lienzo, x0, y0, recorte.width, recorte.height,
                                       0, 0, recorte.width, recorte.height);
    return recorte;
  }

  function leerImagen(archivo) {
    return new Promise(function (ok, fallo) {
      var lector = new FileReader();
      lector.onload = function (e) {
        var img = new Image();
        img.onload = function () { ok(img); };
        img.onerror = function () { fallo(new Error('No se pudo leer la imagen.')); };
        img.src = e.target.result;
      };
      lector.onerror = function () { fallo(new Error('No se pudo leer el archivo.')); };
      lector.readAsDataURL(archivo);
    });
  }

  function aBlob(lienzo) {
    return new Promise(function (ok) { lienzo.toBlob(ok, 'image/png'); });
  }

  /* ── Lo que contesta el bot a /citv ──────────────────────────────
     Una ficha por cada inspección que tuvo el vehículo, de la más nueva
     a la más vieja, así:

         ⌞ INDX: 1
         ⌞ ESTADO: VIGENTE
         ⌞ RESULTADO: APROBADO
         ⌞ CERTIFICADO: C-2026-138-354-000780
         ⌞ VIG. INICIO: 13/01/2026
         ⌞ VIG. FIN: 13/01/2027
         EMPRESA: ...
         DIRECCIÓN: ...

     Se toma la VIGENTE. Si ninguna lo está —el vehículo dejó vencer su
     revisión— se toma la que venció más tarde, que es la última que se
     le emitió, y el certificado sale con esas fechas: aquí no se
     inventa una vigencia que el vehículo no tiene.

     La vigencia (6 o 12 meses) no viene dicha: se calcula de la
     distancia entre inicio y fin, que es como se lee en el papel. */
  function bloquesCitv(texto) {
    var partes = String(texto || '').split(/⌞\s*INDX\s*:/);
    var out = [];
    for (var i = 1; i < partes.length; i++) {
      var b = partes[i];
      var dato = function (re) {
        var m = b.match(re);
        // El bot entrecomilla algunos nombres de empresa; en el papel
        // esas comillas no pintan nada.
        return m ? m[1].trim().replace(/^"+|"+$/g, '').trim() : '';
      };
      out.push({
        indx:        (b.match(/^\s*(\d+)/) || [])[1] || '',
        estado:      dato(/ESTADO\s*:\s*([^\n]+)/i),
        resultado:   dato(/RESULTADO\s*:\s*([^\n]+)/i),
        certificado: dato(/CERTIFICADO\s*:\s*([^\n]+)/i),
        inicio:      dato(/VIG\.?\s*INICIO\s*:\s*([0-9\/\-]+)/i),
        fin:         dato(/VIG\.?\s*FIN\s*:\s*([0-9\/\-]+)/i),
        empresa:     dato(/EMPRESA\s*:\s*([^\n]+)/i),
        direccion:   dato(/DIRECCI[ÓO]N\s*:\s*([^\n]+)/i),
        servicio:    dato(/SERVICIO\s*:\s*([^\n]+)/i),
        obs:         dato(/OBS\s*:\s*([^\n]+)/i),
      });
    }
    return out;
  }

  function aFecha(ddmmyyyy) {
    var m = String(ddmmyyyy || '').match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1]);
  }

  function elegirRevision(bloques) {
    if (!bloques.length) return null;
    var vigentes = bloques.filter(function (b) { return /VIGENTE/i.test(b.estado); });
    var lista = vigentes.length ? vigentes : bloques;
    return lista.sort(function (a, b) {
      var fa = aFecha(a.fin), fb = aFecha(b.fin);
      return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
    })[0];
  }

  function mesesEntre(inicio, fin) {
    var a = aFecha(inicio), b = aFecha(fin);
    if (!a || !b) return null;
    return Math.round((b - a) / (1000 * 60 * 60 * 24 * 30.44));
  }

  /* ── Lo que contesta el bot a /placa ─────────────────────────────
     La ficha del registro. De todo lo que manda —partida, título,
     oficina registral, propietarios— al certificado solo le tocan estos
     veinte cuadros. El resto no se copia: son datos de otra cosa.

     «PESO BRUTO / NETO: 2.49 / 1.83» viene en una sola línea y en el
     certificado son dos cuadros, así que se parte por la barra. */
  function datosDePlaca(texto) {
    var t = String(texto || '');
    var dato = function (re) {
      var m = t.match(re);
      return m ? m[1].trim() : '';
    };
    var pesos = dato(/PESO\s+BRUTO\s*\/\s*NETO\s*:\s*([^\n]+)/i).split('/');
    return {
      placa:        dato(/B[UÚ]SQUEDA\s+DE\s+PLACA\s*-\s*([A-Z0-9-]+)\s*-/i),
      marca:        dato(/^\s*MARCA\s*:\s*([^\n]+)/im),
      modelo:       dato(/^\s*MODELO\s*:\s*([^\n]+)/im),
      color:        dato(/^\s*COLOR\s*:\s*([^\n]+)/im),
      estado:       dato(/^\s*ESTADO\s*:\s*([^\n]+)/im),
      anioFab:      dato(/A[ÑN]O\s+DE\s+FABRICACI[ÓO]N\s*:\s*([^\n]+)/i),
      tipoUso:      dato(/TIPO\s+DE\s+USO\s*:\s*([^\n]+)/i),
      carroceria:   dato(/TIPO\s+DE\s+CARROCER[ÍI]A\s*:\s*([^\n]+)/i),
      combustible:  dato(/TIPO\s+DE\s+COMBUSTIBLE\s*:\s*([^\n]+)/i),
      cilindrada:   dato(/CILINDRADA\s*:\s*([^\n]+)/i),
      cilindros:    dato(/N[ÚU]MERO\s+DE\s+CILINDROS\s*:\s*([^\n]+)/i),
      motor:        dato(/N[ÚU]MERO\s+DE\s+MOTOR\s*:\s*([^\n]+)/i),
      serie:        dato(/N[ÚU]MERO\s+DE\s+SERIE\s*:\s*([^\n]+)/i),
      placaAnterior:dato(/PLACA\s+ANTERIOR\s*:\s*([^\n]+)/i),
      ruedas:       dato(/N[ÚU]MERO\s+DE\s+RUEDAS\s*:\s*([^\n]+)/i),
      pasajeros:    dato(/N[ÚU]MERO\s+DE\s+PASAJEROS\s*:\s*([^\n]+)/i),
      asientos:     dato(/N[ÚU]MERO\s+DE\s+ASIENTOS\s*:\s*([^\n]+)/i),
      pesoBruto:    (pesos[0] || '').trim(),
      pesoNeto:     (pesos[1] || '').trim(),
      cargaUtil:    dato(/CARGA\s+[ÚU]TIL\s*:\s*([^\n]+)/i),
    };
  }

  /* ── Los números del documento ───────────────────────────────────
     El correlativo del pie (CI- 228-XXXXXXX) tiene que ser distinto en
     cada certificado. En el emisor se llevaba con un contador guardado
     en el navegador; aquí eso no vale, porque quien emite ya no es una
     sola máquina sino cada cliente desde la suya, y dos clientes
     estrenarían el mismo número.

     Se saca del identificador que devuelve el servidor al cobrar la
     consulta: es único por emisión, lo asigna la base de datos y no
     depende de nada guardado aquí. El número de informe sale del mismo
     sitio, con otra longitud. */
  function revolver(semilla, sal) {
    var h = 2166136261;
    var s = String(sal) + '|' + String(semilla == null ? Date.now() : semilla);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h;
  }

  function digitos(n, largo) {
    var t = String(n % Math.pow(10, largo));
    while (t.length < largo) t = '0' + t;
    return t;
  }

  function correlativoDe(id) { return digitos(revolver(id, 'ci'), 7); }
  function informeDe(id)     { return digitos(revolver(id, 'inf'), 10) + '-V1'; }

  function htmlFormulario() {
    return '' +
      '<div class="citv-aviso">' +
        '<header class="citv-membrete">' +
          '<span class="citv-chip">Duplicado de CITV</span>' +
          '<h4 class="citv-titulo">¿De qué vehículo?</h4>' +
          '<p class="citv-sigla">Escribe la placa tal como figura en la tarjeta.</p>' +
          '<div class="citv-linea"><span></span><span></span><span></span><span></span></div>' +
        '</header>' +

        '<div class="citv-cuerpo">' +
          '<label class="citv-label" for="citvPlaca">Placa del vehículo</label>' +
          '<div class="citv-campo">' +
            '<span class="citv-campo-ico">' + PLACA_SVG + '</span>' +
            '<input class="input citv-input" type="text" id="citvPlaca" maxlength="10" ' +
                   'placeholder="ABC-123" autocomplete="off" spellcheck="false" inputmode="text">' +
          '</div>' +
          '<p class="citv-error" id="citvError" hidden></p>' +

          '<label class="citv-label citv-label-logo" for="citvLogo">Logotipo del centro ' +
            '<span class="citv-opcional">(opcional)</span></label>' +
          '<p class="citv-ayuda">Va impreso en el certificado. Si tiene fondo blanco se lo ' +
          'quitamos nosotros.</p>' +
          '<div class="citv-logo-fila">' +
            '<input type="file" id="citvLogo" accept="image/png,image/jpeg,image/webp" hidden>' +
            '<button type="button" class="citv-logo-btn" id="citvLogoBtn">Elegir imagen</button>' +
            '<div class="citv-logo-previa" id="citvLogoPrevia" hidden></div>' +
            '<span class="citv-logo-nombre" id="citvLogoNombre"></span>' +
          '</div>' +

          '<div class="citv-costo">' +
            '<span>Costo del trámite</span>' +
            '<strong>' + COSTO_CITV + ' créditos</strong>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* La espera. Lleva la clase `cr-loading` a propósito: es la que busca
     el motor de consultas para colgar ahí su aviso de «el proveedor
     tarda, cancela sin costo» si la cosa se alarga. Así ese aviso sale
     dentro del cuadro y no en una pantalla que nadie está mirando. */
  function htmlCargando(placa) {
    return '' +
      '<div class="citv-aviso">' +
        '<div class="cr-loading citv-cargando">' +
          '<div class="cr-spinner"></div>' +
          '<div class="cr-loading-text">Emitiendo el duplicado de ' + esc(placa) + '…</div>' +
          '<div class="cr-loading-hint">Consultamos el registro. ' +
          'Suele tardar cerca de un minuto: no cierres esta ventana.</div>' +
        '</div>' +
      '</div>';
  }

  /* Aquí no hay membrete. El paso 4 no necesita presentarse —el papel ya
     lleva la placa, el ministerio y el número— y esa franja oscura le
     estaba robando a la hoja un tercio de la altura del cuadro. El
     certificado ocupa todo el ancho y todo el alto que hay. */
  function htmlPrevia(nota) {
    return '' +
      '<div class="citv-aviso citv-aviso-previa">' +
        (nota ? '<p class="citv-nota">' + esc(nota) + '</p>' : '') +
        '<div class="citv-previa" id="citvPrevia"></div>' +
      '</div>';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function esperar(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* Lo que se deja respirar al bot entre un comando y el siguiente. Las
     dos consultas van EN SERIE: es la misma cuenta de Telegram hablando
     con el mismo bot y, lanzadas a la vez, las respuestas se pisan —una
     consulta se lleva el texto de la otra. */
  var PAUSA_ENTRE_COMANDOS_MS = 7000;

  /* Se puede entrar por dos puertas. Desde el menú lateral se entra en
     frío y el cuadro empieza por el aviso —qué es un CITV, cuánto
     tarda—. Desde la pestaña de Vehículos se entra con la placa ya
     escrita, así que ese aviso sobra: se salta directo al paso de la
     placa, con el dato puesto, y lo único que queda por decidir es el
     logotipo. */
  function abrir(placaInicial) {
    var previo = document.getElementById('citv-modal');
    if (previo) previo.remove();

    var root = document.createElement('div');
    root.id = 'citv-modal';
    root.className = 'rep-modal citv-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Duplicado de CITV');
    root.innerHTML =
      '<div class="rep-modal-fondo"></div>' +
      '<div class="rep-modal-caja">' +
        '<button class="rep-modal-cerrar" type="button" aria-label="Cerrar">' + CERRAR_SVG + '</button>' +
        htmlAviso() +
        '<div class="rep-modal-pie"><button class="rep-modal-ok" type="button">Entendido</button></div>' +
      '</div>';
    document.body.appendChild(root);
    document.body.classList.add('modal-open');
    // Un fotograma de margen para que el navegador vea el estado inicial y
    // el cuadro entre animado en vez de aparecer puesto.
    requestAnimationFrame(function () { root.classList.add('is-abierto'); });

    var logoLimpio = null;      // el logotipo del cliente, ya sin fondo
    var marcoHoja = null;       // el <iframe> con el certificado
    var reajustar = null;       // el oyente que lo escala al cambiar la ventana
    var emitiendo = false;      // hay consultas en vuelo

    function cerrar() {
      document.removeEventListener('keydown', alPulsarTecla);
      if (reajustar) { window.removeEventListener('resize', reajustar); reajustar = null; }
      // Cerrar durante la espera corta la consulta: el motor aborta la
      // petición y el servidor devuelve la reserva. Nadie paga por algo
      // que ya no va a ver.
      if (emitiendo && Consultia.ConsultaRunner) Consultia.ConsultaRunner.cancelarConsulta();
      document.body.classList.remove('modal-open');
      root.remove();
    }
    function alPulsarTecla(e) { if (e.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', alPulsarTecla);
    root.querySelector('.rep-modal-fondo').addEventListener('click', cerrar);
    root.querySelector('.rep-modal-cerrar').addEventListener('click', cerrar);

    var caja  = root.querySelector('.rep-modal-caja');
    var pie   = root.querySelector('.rep-modal-pie');
    var boton = root.querySelector('.rep-modal-ok');

    function pintar(html, textoBoton) {
      var viejo = caja.querySelector('.citv-aviso');
      if (viejo) viejo.remove();
      pie.insertAdjacentHTML('beforebegin', html);
      boton.innerHTML = textoBoton;
      boton.disabled = false;
      caja.scrollTop = 0;
    }

    function paso2(placaPrevia, errorPrevio) {
      root.classList.remove('is-previa');
      pintar(htmlFormulario(), 'Emitir certificado');
      var campo = root.querySelector('#citvPlaca');
      if (campo) {
        if (placaPrevia) campo.value = placaPrevia;
        campo.focus();
        // La placa se lee y se guarda en mayúsculas, como en la tarjeta.
        campo.addEventListener('input', function () {
          campo.value = campo.value.toUpperCase();
          var err = root.querySelector('#citvError');
          if (err) err.hidden = true;
        });
        campo.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); enviar(); }
        });
      }
      var campoLogo = root.querySelector('#citvLogo');
      var botonLogo = root.querySelector('#citvLogoBtn');
      if (botonLogo) botonLogo.addEventListener('click', function () { campoLogo.click(); });
      if (campoLogo) campoLogo.addEventListener('change', async function () {
        var archivo = campoLogo.files && campoLogo.files[0];
        if (!archivo) return;
        try {
          var img = await leerImagen(archivo);
          logoLimpio = limpiarFondo(img);
          var previa = root.querySelector('#citvLogoPrevia');
          previa.innerHTML = '';
          previa.appendChild(logoLimpio);
          previa.hidden = false;
          root.querySelector('#citvLogoNombre').textContent = archivo.name;
          botonLogo.textContent = 'Cambiar imagen';
        } catch (e) {
          logoLimpio = null;
          mostrarError('No se pudo leer esa imagen. Prueba con un PNG o un JPG.');
        }
      });

      // El logotipo elegido antes de un intento fallido sigue puesto: no
      // se le pide dos veces la misma imagen.
      if (logoLimpio) {
        var previaLogo = root.querySelector('#citvLogoPrevia');
        previaLogo.innerHTML = '';
        previaLogo.appendChild(logoLimpio);
        previaLogo.hidden = false;
        if (botonLogo) botonLogo.textContent = 'Cambiar imagen';
      }

      if (errorPrevio) mostrarError(errorPrevio);
      boton.onclick = enviar;
    }

    function mostrarError(texto) {
      var err = root.querySelector('#citvError');
      if (!err) return;
      err.textContent = texto;
      err.hidden = false;
    }

    /* La hoja va dentro de un <iframe> con su propio documento; ver
       js/modules/citv-certificado.js. Aquí solo se encaja: se pinta a
       tamaño real y se encoge con `transform` hasta el ancho que dé el
       cuadro, que es lo único que no deforma el papel. */
    function montarHoja(docHtml) {
      var C = Consultia.CitvCertificado;
      var marco = root.querySelector('#citvPrevia');
      if (!marco) return null;

      var hoja = document.createElement('iframe');
      hoja.className = 'citv-hoja';
      hoja.setAttribute('title', 'Vista previa del certificado');
      hoja.setAttribute('scrolling', 'no');
      hoja.width = C.ANCHO_PX;
      hoja.height = C.ALTO_PX;
      hoja.srcdoc = docHtml;
      marco.appendChild(hoja);

      /* Quien manda es la hoja: se calcula cuánto cabe de alto y de ancho,
         se elige la escala que entra por los dos lados, y el cuadro se
         estrecha hasta medir exactamente lo que mide el papel. Al revés
         —primero el cuadro, después la hoja— quedaba blanco a los lados
         y el certificado no llenaba nada.

         El alto disponible descuenta el pie con su botón y, si la hay, la
         nota de arriba; el ancho, el aire que el modal deja alrededor.
         Nunca por encima de 1: se encoge para caber, no se estira. */
      var MARGEN_MODAL = 32;      // el aire del .rep-modal alrededor del cuadro

      function medir() {
        var nota = root.querySelector('.citv-nota');
        var alto = window.innerHeight - MARGEN_MODAL - pie.offsetHeight -
                   (nota ? nota.offsetHeight + 12 : 0);
        var ancho = Math.min(window.innerWidth - MARGEN_MODAL, 900);
        return Math.min(1, Math.max(alto, 220) / C.ALTO_PX, ancho / C.ANCHO_PX);
      }

      reajustar = function () {
        // Dos pasadas: la primera fija el ancho del cuadro y la segunda
        // vuelve a medir, porque la nota reparte sus líneas según ese
        // ancho y con una sola pasada la hoja se pasaba de alto.
        var escala = medir();
        caja.style.width = Math.round(C.ANCHO_PX * escala) + 'px';
        escala = medir();
        caja.style.width = Math.round(C.ANCHO_PX * escala) + 'px';
        hoja.style.transform = 'scale(' + escala + ')';
        marco.style.height = Math.round(C.ALTO_PX * escala) + 'px';
      };
      reajustar();
      window.addEventListener('resize', reajustar);
      return hoja;
    }

    /* ── El PDF ──────────────────────────────────────────────────────
       Pulsar y que baje el archivo. Nada de abrir el diálogo de
       impresión y confiar en que el cliente acierte con «Guardar como
       PDF», el tamaño A4 y los márgenes a cero: eso es pedirle que
       maquete él el documento que vino a comprar.

       Quien lo dibuja es js/modules/citv-pdf.js, y lo dibuja de verdad:
       texto seleccionable y líneas vectoriales, no una foto de la
       pantalla. Si algo fallara queda el diálogo de impresión, que sigue
       imprimiendo bien: mejor un camino más largo que ninguno. */
    async function descargarPdf(placa) {
      if (!marcoHoja || !marcoHoja.contentDocument) return;

      var aImprimir = function () {
        marcoHoja.contentWindow.focus();
        marcoHoja.contentWindow.print();
      };
      if (!Consultia.CitvPdf || !window.jspdf || !window.jspdf.jsPDF) { aImprimir(); return; }

      var textoBoton = boton.innerHTML;
      boton.disabled = true;
      boton.innerHTML = '<span>Preparando el PDF…</span>';
      try {
        await Consultia.CitvPdf.generar(
          marcoHoja, 'CITV-' + String(placa).replace(/[^A-Z0-9]/gi, '') + '.pdf');
      } catch (e) {
        console.error('[citv] no se pudo armar el PDF:', e);
        aImprimir();
      } finally {
        boton.disabled = false;
        boton.innerHTML = textoBoton;
      }
    }

    /* La diferencia entre lo que cuesta el trámite y lo que ya cobraron
       las consultas del catálogo. Si el catálogo subiera de precio hasta
       igualar el trámite, esto es cero y no se cobra nada aparte —nunca
       se cobra de más por encima de los 30. */
    async function cobrarDiferencia(sb, yaCobrado, placa) {
      var falta = COSTO_CITV - yaCobrado;
      if (falta <= 0) return;
      var res = await sb.rpc('consume_credits', {
        cost: falta,
        module_name: 'citv',
        q_type: 'placa',
        q_input: placa.slice(0, 200),
      });
      if (res.error) throw res.error;
    }

    // El logotipo se guarda para que el emisor de administración pueda
    // rehacer el documento a mano si alguna vez hace falta. Va detrás de
    // la entrega y sin bloquear: al cliente ya se le dio su certificado.
    async function guardarLogo(sb, userId, placa) {
      if (!logoLimpio) return;
      try {
        var blob = await aBlob(logoLimpio);
        var ruta = userId + '/' + placa.replace(/[^A-Z0-9]/gi, '') + '-' + Date.now() + '.png';
        var subida = await sb.storage.from('citv-logos')
          .upload(ruta, blob, { contentType: 'image/png', upsert: true });
        if (subida.error) throw subida.error;
      } catch (errLogo) {
        console.warn('[citv] no se pudo guardar el logotipo:', errLogo);
      }
    }

    async function enviar() {
      var campo = root.querySelector('#citvPlaca');
      var placa = ((campo && campo.value) || '').trim().toUpperCase();
      if (placa.length < 5) {
        mostrarError('Escribe la placa completa, tal como figura en la tarjeta.');
        if (campo) campo.focus();
        return;
      }

      boton.disabled = true;
      boton.textContent = 'Emitiendo…';

      var sb = window.Consultia.supabase;
      /* La sesión que ya está en memoria, NO `getUser()`: aquella va al
         servidor a validar el token y, si el refresco falla, Supabase
         cierra la sesión — el cliente enviaba su solicitud y la
         plataforma lo escupía al login. */
      var user = null;
      try {
        var ses = await sb.auth.getSession();
        user = ses && ses.data && ses.data.session && ses.data.session.user;
      } catch (e) { user = null; }
      if (!user) {
        cerrar();
        if (window.Consultia.AuthModals) window.Consultia.AuthModals.openLogin();
        return;
      }

      emitiendo = true;
      pintar(htmlCargando(placa), 'Cancelar');
      boton.onclick = cerrar;

      try {
        var runner = Consultia.ConsultaRunner;
        var catalogo = await runner.loadCatalog();
        var buscar = function (re) {
          return (catalogo || []).filter(function (c) { return re.test(c.comando || ''); })[0];
        };
        var cCitv  = buscar(/^\/citv\b/);
        var cPlaca = buscar(/^\/placa\b/);
        if (!cCitv) throw new Error('El trámite no está disponible en este momento.');

        /* El saldo se mira por el trámite entero antes de tocar nada. Si
           no llega, no se empieza: quedarse a medias sería cobrar las
           consultas y no entregar el papel. Los administradores no pagan
           —consume_credits lo resuelve por rol— y se saltan la revisión. */
        var esCuentaAdmin = await runner.esAdmin(user.id);
        if (!esCuentaAdmin) {
          var alcanza = await runner.verificarSaldo(user.id, COSTO_CITV);
          if (!alcanza) {
            throw new Error('No te alcanzan los créditos. El trámite cuesta ' + COSTO_CITV + '.');
          }
        }

        // Primero la revisión, siete segundos de aire, y después la ficha
        // del vehículo. Ver PAUSA_ENTRE_COMANDOS_MS.
        var rCitv = await runner.ejecutarConsultaConCobro(user.id, cCitv, placa);
        var rPlaca = null;
        if (cPlaca) {
          await esperar(PAUSA_ENTRE_COMANDOS_MS);
          try {
            rPlaca = await runner.ejecutarConsultaConCobro(user.id, cPlaca, placa);
          } catch (e) {
            // Sin la ficha del registro el certificado sale con los
            // veinte cuadros vacíos, pero sale. Lo que no puede faltar es
            // la revisión.
            console.warn('[citv] la ficha del vehículo no llegó:', e);
          }
        }

        var texto = (rCitv && rCitv.parsed && rCitv.parsed.raw) || '';
        var rev = elegirRevision(bloquesCitv(texto));
        if (!rev) throw new Error('El registro no devolvió ninguna revisión para esa placa.');

        var v = datosDePlaca((rPlaca && rPlaca.parsed && rPlaca.parsed.raw) || '');

        var yaCobrado = (rCitv && rCitv.costo_deducido) || 0;
        if (rPlaca) yaCobrado += (rPlaca.costo_deducido || 0);
        if (!esCuentaAdmin) await cobrarDiferencia(sb, yaCobrado, placa);

        var meses = mesesEntre(rev.inicio, rev.fin);
        var id = (rCitv && rCitv.consulta_id) || null;

        var doc = Consultia.CitvCertificado.html({
          placa:         v.placa || placa,
          marca:         v.marca,
          modelo:        v.modelo,
          color:         v.color,
          estado:        v.estado,
          anioFab:       v.anioFab,
          tipoUso:       v.tipoUso,
          carroceria:    v.carroceria,
          combustible:   v.combustible,
          cilindrada:    v.cilindrada,
          cilindros:     v.cilindros,
          motor:         v.motor,
          serie:         v.serie,
          placaAnterior: v.placaAnterior,
          ruedas:        v.ruedas,
          pasajeros:     v.pasajeros,
          asientos:      v.asientos,
          pesoBruto:     v.pesoBruto,
          pesoNeto:      v.pesoNeto,
          cargaUtil:     v.cargaUtil,

          empresa:       rev.empresa,
          direccionHtml: esc(rev.direccion),
          numCert:       rev.certificado,
          tipo:          'ORDINARIA',
          fecha:         rev.inicio,
          informe:       informeDe(id),
          obs:           rev.obs,
          resultado:     rev.resultado || 'APROBADO',
          vigencia:      meses === null ? '' : (meses <= 9 ? '6 MESES' : '12 MESES'),
          proxima:       rev.fin,
          correlativo:   correlativoDe(id),
          logo:          logoLimpio ? logoLimpio.toDataURL('image/png') : 'assets/citv/logo-citv.png',
        });

        emitiendo = false;

        /* Si la última revisión no está vigente el documento sale igual
           —es el duplicado de lo que hay— pero el cliente tiene que
           saberlo antes de imprimirlo. */
        var nota = /VIGENTE/i.test(rev.estado) ? '' :
          'La última revisión de esta placa figura como ' + (rev.estado || 'VENCIDA') +
          ': venció el ' + rev.fin + '. El duplicado sale con esas fechas.';

        root.classList.add('is-previa');
        pintar(htmlPrevia(nota), PDF_SVG + '<span>Descargar PDF</span>');
        marcoHoja = montarHoja(doc);
        boton.onclick = function () { descargarPdf(v.placa || placa); };

        if (window.Consultia.AuthUI && window.Consultia.AuthUI.refresh) {
          window.Consultia.AuthUI.refresh();   // el saldo de la cabecera, al día
        }
        guardarLogo(sb, user.id, placa);

      } catch (e) {
        emitiendo = false;
        if (e && e.code === 'CANCELLED') { cerrar(); return; }
        var msg = (e && e.message) || '';
        console.error('[citv] no se pudo emitir el duplicado:', e);
        paso2(placa, /cr[eé]dito|saldo|insufficient/i.test(msg)
          ? 'No te alcanzan los créditos. El trámite cuesta ' + COSTO_CITV + '.'
          : (msg || 'No se pudo emitir el duplicado. Intenta de nuevo en un momento.'));
      }
    }

    if (placaInicial) {
      paso2(String(placaInicial).trim().toUpperCase());
    } else {
      boton.onclick = function () { paso2(); };
      setTimeout(function () { if (boton) boton.focus(); }, 50);
    }
  }

  Consultia.CitvAviso = { abrir: abrir };

  /* El trámite se anuncia en la pestaña de Vehículos, al final del
     desplegable, como una consulta más. No lo es —no hay fila en el
     catálogo ni comando que mandar— pero para el cliente se pide igual:
     su placa y el botón de siempre. Lo recoge category-view.js. */
  Consultia.Tramites = Consultia.Tramites || [];
  Consultia.Tramites.push({
    id: 'tramite-citv',
    categoria: 'vehiculos',
    nombre: 'Duplicado de CITV',
    descripcion: 'Emite el duplicado del Certificado de Inspección Técnica Vehicular.',
    tipo_dato: 'placa',
    precio_venta: COSTO_CITV,
    tramite_abrir: function (placa) { abrir(placa); },
  });

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('navCitv');
    // Sin pasarle el evento: `abrir` toma una placa como primer argumento.
    if (btn) btn.addEventListener('click', function () { abrir(); });
  });
})();
