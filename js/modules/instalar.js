/* ============================================================
   INSTALAR LA APLICACIÓN

   Un botón redondo encima del de WhatsApp. Se pulsa y el teléfono la
   instala. Nada más.

   Antes esto era un botón escondido en el menú lateral —que en el
   celular está en display:none, así que allí no existía— y una hoja
   explicando dónde buscar la opción en el menú del navegador. Contar los
   pasos es admitir que el botón no sirve: si hay que leer instrucciones
   para instalar una aplicación, no se instala nadie.

   Por eso el botón solo aparece cuando la instalación se puede hacer de
   verdad, en un toque. Si el navegador no la ofrece, no hay botón.

   La excepción es el iPhone: Safari no deja instalar por código, y ahí
   la única vía posible son los dos toques del menú Compartir. Para no
   dejar a esos clientes sin nada, esa explicación sigue existiendo, pero
   descolgada del desplegable del usuario y solo en iPhone — nunca como
   la puerta principal.

   También registra el service worker, que es requisito para que el
   navegador ofrezca instalar nada.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var DESCARGA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v11"/><polyline points="7.5 10 12 14.5 16.5 10"/>' +
    '<path d="M4 17.5v1.6A1.9 1.9 0 0 0 5.9 21h12.2a1.9 1.9 0 0 0 1.9-1.9v-1.6"/></svg>';

  var COMPARTIR_IOS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 15V3"/><polyline points="8 6.5 12 2.8 16 6.5"/>' +
    '<path d="M5 12v7.2A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.8V12"/></svg>';

  var MAS_IOS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

  var CERRAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  /* ── El service worker ──────────────────────────────────────────
     Se registra al terminar de cargar y no antes: durante el arranque
     compite por la misma red que necesita la primera pantalla. */
  function registrarServicio() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (e) {
        console.warn('[instalar] el service worker no se registró:', e);
      });
    });
  }

  function esIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      // El iPad moderno se hace pasar por Mac; se le reconoce porque el
      // escritorio no tiene pantalla táctil.
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function yaInstalada() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      navigator.standalone === true;
  }

  /* ── Cuándo se ofrece, y cuántas veces ──────────────────────────
     DOS REGLAS, las dos del dueño:

     1. NUNCA en la pantalla de acceso. Ahí el cliente está escribiendo
        su correo y su contraseña; ofrecerle instalar una aplicación en
        la que todavía no ha entrado es interrumpir lo único que ha
        venido a hacer. Solo se ofrece ya dentro.

     2. UNA SOLA VEZ. Se ofrece la primera vez que entra y no vuelve a
        aparecer nunca, acepte o no. Un botón que reaparece cada vez que
        abres la aplicación deja de ser una oferta y pasa a ser un
        estorbo — y se acaba tocando sin querer.

     La marca vive en el navegador del cliente. Si borra sus datos
     volverá a salir una vez: es el precio de no tener que guardar esto
     en su cuenta, y sale barato. */
  var CLAVE_OFRECIDO = 'fv:instalar-ofrecido';

  function yaSeOfrecio() {
    try { return localStorage.getItem(CLAVE_OFRECIDO) === '1'; } catch (e) { return false; }
  }

  function anotarOfrecido() {
    try { localStorage.setItem(CLAVE_OFRECIDO, '1'); } catch (e) { /* modo privado */ }
  }

  /* Dentro de la plataforma = el guardián del acceso ya no está puesto.
     `auth-locked` tapa la aplicación mientras no hay sesión, e
     `is-anonymous` marca al visitante sin cuenta; con cualquiera de las
     dos, aquí no se ofrece nada. */
  function dentroDeLaPlataforma() {
    var c = document.body.classList;
    return !c.contains('auth-locked') && !c.contains('is-anonymous');
  }

  /* ── El botón ───────────────────────────────────────────────────
     Redondo, del tamaño del de WhatsApp y justo encima. Oscuro, para que
     no compita con el verde del otro: son dos cosas distintas y no deben
     leerse como una pareja. */
  function crearBoton() {
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'instFab';
    b.className = 'inst-fab';
    b.hidden = true;
    b.setAttribute('aria-label', 'Instalar la aplicación');
    b.setAttribute('title', 'Instalar la aplicación');
    b.innerHTML = DESCARGA_SVG;
    document.body.appendChild(b);
    return b;
  }

  /* ── El iPhone ──────────────────────────────────────────────────
     Lo único que se puede hacer es enseñar los dos toques. */
  function abrirAyudaIOS() {
    var previo = document.getElementById('inst-ios');
    if (previo) previo.remove();

    var root = document.createElement('div');
    root.id = 'inst-ios';
    root.className = 'rep-modal inst-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Instalar la aplicación');
    root.innerHTML =
      '<div class="rep-modal-fondo"></div>' +
      '<div class="rep-modal-caja">' +
        '<button class="rep-modal-cerrar" type="button" aria-label="Cerrar">' + CERRAR_SVG + '</button>' +
        '<div class="inst-hoja">' +
          '<h4 class="inst-titulo">Instálala en tu iPhone</h4>' +
          '<ol class="inst-pasos">' +
            '<li><span class="inst-ico">' + COMPARTIR_IOS + '</span>' +
                '<div>Toca <strong>Compartir</strong> en la barra de Safari.</div></li>' +
            '<li><span class="inst-ico">' + MAS_IOS + '</span>' +
                '<div>Elige <strong>Añadir a pantalla de inicio</strong>.</div></li>' +
          '</ol>' +
        '</div>' +
        '<div class="rep-modal-pie"><button class="rep-modal-ok" type="button">Entendido</button></div>' +
      '</div>';
    document.body.appendChild(root);
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () { root.classList.add('is-abierto'); });

    function cerrar() {
      document.removeEventListener('keydown', alPulsar);
      document.body.classList.remove('modal-open');
      root.remove();
    }
    function alPulsar(e) { if (e.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', alPulsar);
    root.querySelector('.rep-modal-fondo').addEventListener('click', cerrar);
    root.querySelector('.rep-modal-cerrar').addEventListener('click', cerrar);
    root.querySelector('.rep-modal-ok').addEventListener('click', cerrar);
  }

  function itemIOS() {
    var salir = document.querySelector('#userDropdown #logoutBtn');
    if (!salir) return;
    salir.insertAdjacentHTML('beforebegin',
      '<button class="dropdown-item" type="button" role="menuitem" id="itemInstalar">' +
        DESCARGA_SVG + '<span>Instalar la app</span></button>');
    var it = document.getElementById('itemInstalar');
    if (it) it.addEventListener('click', abrirAyudaIOS);
  }

  function arrancar() {
    registrarServicio();
    if (yaInstalada()) return;

    if (esIOS()) { itemIOS(); return; }

    var boton = crearBoton();

    /* El aviso del navegador llega UNA vez y puede llegar antes que este
       guion, que carga al final del documento. Lo recoge un fragmento en
       la cabecera de app.html y lo deja en `window.__fvInstalable`; aquí
       se mira si ya está y, si no, se espera al que reenvía. */
    function hayAviso() { return window.__fvInstalable || null; }

    /* Tres condiciones y las tres tienen que cumplirse: que el navegador
       lo ofrezca, que ya se haya entrado, y que no se haya ofrecido
       antes. En cuanto el botón se enseña, queda anotado — aunque el
       cliente ni lo mire. Eso es lo que significa «una sola vez». */
    function revisar() {
      if (yaSeOfrecio() || !dentroDeLaPlataforma() || !hayAviso()) {
        boton.hidden = true;
        return;
      }
      boton.hidden = false;
      anotarOfrecido();
      dejarDeVigilar();
    }

    /* El acceso se cierra DESPUÉS de que este guion arranque, así que no
       basta con mirar una vez: se vigila la clase del body hasta que la
       sesión entra. Cuando el botón ya se ha enseñado, la vigilancia
       sobra y se suelta. */
    var vigia = null;
    function dejarDeVigilar() {
      if (!vigia) return;
      vigia.disconnect();
      vigia = null;
    }
    if (window.MutationObserver) {
      vigia = new MutationObserver(revisar);
      vigia.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    window.addEventListener('fv-instalable', revisar);
    revisar();

    boton.addEventListener('click', async function () {
      var aviso = hayAviso();
      if (!aviso) { boton.hidden = true; return; }
      boton.disabled = true;
      try {
        aviso.prompt();
        var eleccion = await aviso.userChoice;
        // Si dice que no, el botón se va: insistir es acosar.
        if (eleccion && eleccion.outcome !== 'accepted') boton.hidden = true;
      } catch (e) {
        console.warn('[instalar] el navegador rechazó la instalación:', e);
        boton.hidden = true;
      } finally {
        // El aviso guardado solo sirve una vez.
        window.__fvInstalable = null;
        boton.disabled = false;
      }
    });

    window.addEventListener('appinstalled', function () {
      boton.hidden = true;
      if (Consultia.toast) Consultia.toast({
        type: 'success',
        title: 'Instalada',
        message: 'Filtro Vehicular+ ya está en tu pantalla de inicio.',
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
})();
