/* ============================================================
   INSTALAR LA APLICACIÓN

   Dos cosas que faltaban para que Filtro Vehicular+ se pudiera instalar
   como una aplicación más del teléfono o del escritorio:

   1. Registrar el service worker. Estaba escrito y mantenido desde hacía
      meses —sw.js, con su CACHE_VERSION que se sube en cada despliegue—
      pero NADIE lo registraba: la única llamada a `register` vivía en una
      página suelta del emisor de CITV. Así que ni había caché, ni la
      subida de versión servía de nada, ni el navegador ofrecía instalar,
      porque para ofrecerlo exige un service worker con manejador de
      `fetch`.

   2. Enseñar el botón. El navegador avisa de que la aplicación se puede
      instalar con `beforeinstallprompt` y, si nadie recoge ese aviso, se
      lo queda él y como mucho lo esconde en su menú. Aquí se recoge, se
      guarda, y se enciende el botón del menú lateral.

   El iPhone va aparte: Safari no lanza ese aviso y no deja instalar por
   código. Lo único que se puede hacer —y lo que se hace— es explicarle
   al cliente los dos toques que tiene que dar.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

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

  function htmlBoton() {
    return '' +
      '<button class="sb-action" type="button" id="btnInstalar" hidden ' +
             'aria-label="Instalar la aplicación" data-tooltip="Instalar la aplicación">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
             'stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 3v11"/><polyline points="8 10.5 12 14.5 16 10.5"/>' +
          '<path d="M4 17.5v1.6A1.9 1.9 0 0 0 5.9 21h12.2a1.9 1.9 0 0 0 1.9-1.9v-1.6"/>' +
        '</svg>' +
        '<span>Instalar la app</span>' +
      '</button>';
  }

  var MENU_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>';

  /* Los pasos, según dónde esté el cliente. Solo se abre si pulsa el
     botón: no se le suelta un aviso a nadie que no lo haya pedido. */
  function pasos() {
    if (esIOS()) {
      return {
        titulo: 'Instálala en tu iPhone',
        bajada: 'Queda como una aplicación más, con su icono.',
        lista: [
          [COMPARTIR_IOS, 'Toca <strong>Compartir</strong>, abajo en la barra de Safari.'],
          [MAS_IOS, 'Baja y elige <strong>Añadir a pantalla de inicio</strong>.'],
        ],
        nota: 'Safari no deja instalarla desde un botón; en el iPhone hay que hacerlo desde ahí.',
      };
    }
    return {
      titulo: 'Instálala en tu teléfono',
      bajada: 'Queda como una aplicación más, con su icono.',
      lista: [
        [MENU_SVG, 'Abre el <strong>menú del navegador</strong>, arriba a la derecha.'],
        [MAS_IOS, 'Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.'],
      ],
      nota: 'Si tu navegador no trae esa opción, prueba con Chrome: es el que mejor la soporta.',
    };
  }

  function abrirAyuda() {
    var previo = document.getElementById('inst-ios');
    if (previo) previo.remove();

    var root = document.createElement('div');
    root.id = 'inst-ios';
    root.className = 'rep-modal inst-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Instalar la aplicación');
    var p = pasos();
    root.innerHTML =
      '<div class="rep-modal-fondo"></div>' +
      '<div class="rep-modal-caja">' +
        '<button class="rep-modal-cerrar" type="button" aria-label="Cerrar">' + CERRAR_SVG + '</button>' +
        '<div class="citv-aviso">' +
          '<header class="citv-membrete">' +
            '<span class="citv-chip">Filtro Vehicular+</span>' +
            '<h4 class="citv-titulo">' + p.titulo + '</h4>' +
            '<p class="citv-sigla">' + p.bajada + '</p>' +
            '<div class="citv-linea"><span></span><span></span><span></span><span></span></div>' +
          '</header>' +
          '<div class="citv-cuerpo">' +
            '<ol class="inst-pasos">' +
              p.lista.map(function (paso) {
                return '<li><span class="inst-ico">' + paso[0] + '</span><div>' + paso[1] + '</div></li>';
              }).join('') +
            '</ol>' +
            '<p class="citv-texto">' + p.nota + '</p>' +
          '</div>' +
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

  function htmlItemMenu() {
    return '' +
      '<button class="dropdown-item" type="button" role="menuitem" id="itemInstalar">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
             'stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 3v11"/><polyline points="8 10.5 12 14.5 16 10.5"/>' +
          '<path d="M4 17.5v1.6A1.9 1.9 0 0 0 5.9 21h12.2a1.9 1.9 0 0 0 1.9-1.9v-1.6"/>' +
        '</svg>' +
        '<span>Instalar la app</span>' +
      '</button>';
  }

  function arrancar() {
    registrarServicio();

    // Ya está instalada: no hay nada que ofrecer.
    if (yaInstalada()) return;

    /* Dos sitios, y no por gusto.

       El botón vivía solo en el menú lateral, y en el celular ese menú
       está en `display:none`: en la pantalla donde más falta hace
       instalar la aplicación, el botón no existía. Ahora va también en
       el desplegable del usuario, que es lo que sí se abre desde la
       barra de arriba en un teléfono. */
    var puestos = [];

    var lateral = document.querySelector('.sidebar-actions');
    if (lateral) {
      lateral.insertAdjacentHTML('afterbegin', htmlBoton());
      var b1 = document.getElementById('btnInstalar');
      if (b1) puestos.push(b1);
    }

    var menu = document.querySelector('#userDropdown #logoutBtn');
    if (menu) {
      menu.insertAdjacentHTML('beforebegin', htmlItemMenu());
      var b2 = document.getElementById('itemInstalar');
      if (b2) puestos.push(b2);
    }
    if (!puestos.length) return;

    function mostrar(si) {
      puestos.forEach(function (b) { b.hidden = !si; });
    }

    /* El aviso del navegador puede haber llegado ANTES que este guion: se
       dispara en cuanto la página cumple, y este archivo carga al final.
       Por eso lo recoge un fragmento en la cabecera y lo deja en
       `window.__fvInstalable`; aquí se mira si ya está y, si no, se
       espera al aviso que ese fragmento reenvía. */
    function pendiente() { return window.__fvInstalable || null; }

    window.addEventListener('fv-instalable', function () { mostrar(true); });

    /* El botón se enseña SIEMPRE, haya aviso o no. Sin aviso no se puede
       instalar por código —en iPhone nunca se puede, y en Android hay
       casos en que el navegador no lo manda—, pero sí se puede explicar
       dónde está la opción en el menú del navegador. Un botón que enseña
       el camino vale más que ningún botón. */
    mostrar(true);

    puestos.forEach(function (boton) {
      boton.addEventListener('click', async function () {
        var aviso = pendiente();
        if (!aviso) { abrirAyuda(); return; }
        boton.disabled = true;
        try {
          aviso.prompt();
          await aviso.userChoice;
        } catch (e) {
          console.warn('[instalar] el navegador rechazó la instalación:', e);
          abrirAyuda();
        } finally {
          // El aviso guardado solo sirve una vez.
          window.__fvInstalable = null;
          boton.disabled = false;
        }
      });
    });

    window.addEventListener('appinstalled', function () {
      mostrar(false);
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
