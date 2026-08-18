/* ============================================================
   DUPLICADO CITV — el aviso del tiempo de emisión
   ------------------------------------------------------------
   Antes este acceso mandaba a WhatsApp de una. Ahora abre un aviso:
   el duplicado no sale al instante y el cliente tiene derecho a
   saberlo ANTES, no mientras espera sin entender por qué tarda.

   Dice también qué es un CITV. La sigla la usa todo el mundo en el
   rubro y casi nadie fuera de él: escribirla sin explicar deja
   afuera justo a quien viene a preguntar.

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
              '<strong class="citv-tiempo-cifra">Hasta 5 minutos</strong>' +
              '<span class="citv-tiempo-txt">Es el máximo. Casi siempre lo tenemos en menos.</span>' +
            '</div>' +
          '</div>' +

          '<p class="citv-texto">Tu duplicado se solicita al registro y se emite el mismo día. ' +
          'No hace falta que estés pendiente: apenas esté listo te llega.</p>' +

          '<ul class="citv-puntos">' +
            '<li>Es el mismo certificado, con la validez de siempre.</li>' +
            '<li>Sirve para el original perdido, deteriorado o ilegible.</li>' +
            '<li>Si algo impide emitirlo, te avisamos y no se te cobra.</li>' +
          '</ul>' +
        '</div>' +
      '</div>';
  }

  /* Lo que cuesta el trámite. Es un precio fijo y no vive en el catálogo:
     esto no pasa por ningún bot, lo emite el equipo a mano. Si cambia, se
     cambia aquí y en el texto que lee el cliente —está escrito una sola
     vez, más abajo, a partir de esta constante. */
  var COSTO_CITV = 30;

  var PLACA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h2M11 10h2M16 10h2M6 14h12"/></svg>';

  var LISTO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9.5"/></svg>';

  /* ── El logotipo del cliente ─────────────────────────────────────
     El certificado lleva el logo del centro de inspección, así que lo
     pone quien lo pide. Casi siempre llegará un cuadrado con fondo
     blanco —así lo guarda todo el mundo—, y sobre el papel ese blanco
     se ve como un parche. Se le quita aquí mismo, en el navegador del
     cliente, antes de subirlo: el que emite el certificado recibe el
     logo ya recortado y con el fondo transparente.

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

  function htmlEnviado(placa) {
    return '' +
      '<div class="citv-aviso">' +
        '<div class="citv-listo">' +
          '<span class="citv-listo-ico">' + LISTO_SVG + '</span>' +
          '<h4 class="citv-listo-titulo">Se envió correctamente</h4>' +
          '<p class="citv-listo-placa">' + esc(placa) + '</p>' +
          '<p class="citv-listo-txt">Ya estamos gestionando el duplicado de tu CITV. ' +
          'Puede demorar hasta 5 minutos; casi siempre lo tenemos en menos.</p>' +
          '<p class="citv-listo-cobro">Se descontaron ' + COSTO_CITV + ' créditos de tu cuenta.</p>' +
        '</div>' +
      '</div>';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function abrir() {
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

    function cerrar() {
      document.removeEventListener('keydown', alPulsarTecla);
      document.body.classList.remove('modal-open');
      root.remove();
    }
    function alPulsarTecla(e) { if (e.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', alPulsarTecla);
    root.querySelector('.rep-modal-fondo').addEventListener('click', cerrar);
    root.querySelector('.rep-modal-cerrar').addEventListener('click', cerrar);

    /* El aviso no termina en «Entendido»: ahí empieza el trámite. El mismo
       cuadro se convierte en el formulario de la placa y, al enviarlo, en
       el acuse. Tres pasos sin sacar al cliente de donde está. */
    var logoLimpio = null;      // el logotipo del cliente, ya sin fondo
    var caja  = root.querySelector('.rep-modal-caja');
    var pie   = root.querySelector('.rep-modal-pie');
    var boton = root.querySelector('.rep-modal-ok');

    function pintar(html, textoBoton) {
      var viejo = caja.querySelector('.citv-aviso');
      if (viejo) viejo.remove();
      pie.insertAdjacentHTML('beforebegin', html);
      boton.textContent = textoBoton;
      boton.disabled = false;
    }

    function paso2() {
      pintar(htmlFormulario(), 'Enviar solicitud');
      var campo = root.querySelector('#citvPlaca');
      if (campo) {
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

      boton.onclick = enviar;
    }

    function mostrarError(texto) {
      var err = root.querySelector('#citvError');
      if (!err) return;
      err.textContent = texto;
      err.hidden = false;
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
      boton.textContent = 'Enviando…';
      try {
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

        /* Se cobra con la misma función que el resto de la plataforma: es
           la que valida el saldo y descuenta en un solo paso, y deja la
           solicitud registrada para que el equipo la vea. */
        var res = await sb.rpc('consume_credits', {
          cost: COSTO_CITV,
          module_name: 'citv',
          q_type: 'placa',
          q_input: placa.slice(0, 200),
        });
        if (res.error) throw res.error;

        /* El logotipo va detrás del cobro, no antes: si algo falla al
           subirlo, la solicitud ya está hecha y el certificado se emite
           igual con el logo puesto a mano. Al revés se habría subido un
           archivo de una solicitud que nunca ocurrió. */
        if (logoLimpio) {
          try {
            var blob = await aBlob(logoLimpio);
            var ruta = user.id + '/' + placa.replace(/[^A-Z0-9]/gi, '') + '-' + Date.now() + '.png';
            var subida = await sb.storage.from('citv-logos')
              .upload(ruta, blob, { contentType: 'image/png', upsert: true });
            if (subida.error) throw subida.error;
          } catch (errLogo) {
            console.warn('[citv] no se pudo subir el logotipo:', errLogo);
          }
        }

        pintar(htmlEnviado(placa), 'Cerrar');
        boton.onclick = cerrar;
        if (window.Consultia.AuthUI && window.Consultia.AuthUI.refresh) {
          window.Consultia.AuthUI.refresh();   // el saldo de la cabecera, al día
        }
      } catch (e) {
        var msg = (e && e.message) || '';
        boton.disabled = false;
        boton.textContent = 'Enviar solicitud';
        if (/cr[eé]dito|saldo|insufficient/i.test(msg)) {
          mostrarError('No te alcanzan los créditos. El trámite cuesta ' + COSTO_CITV + '.');
          return;
        }
        console.error('[citv] no se pudo enviar la solicitud:', e);
        mostrarError('No se pudo enviar la solicitud. Intenta de nuevo en un momento.');
      }
    }

    boton.onclick = paso2;
    setTimeout(function () { if (boton) boton.focus(); }, 50);
  }

  Consultia.CitvAviso = { abrir: abrir };

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('navCitv');
    if (btn) btn.addEventListener('click', abrir);
  });
})();
