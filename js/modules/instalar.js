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

  /* La hoja del iPhone. Se abre solo si el cliente pulsa el botón: no se
     le suelta un aviso a nadie que no lo haya pedido. */
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
        '<div class="citv-aviso">' +
          '<header class="citv-membrete">' +
            '<span class="citv-chip">Filtro Vehicular+</span>' +
            '<h4 class="citv-titulo">Instálala en tu iPhone</h4>' +
            '<p class="citv-sigla">Queda como una aplicación más, con su icono.</p>' +
            '<div class="citv-linea"><span></span><span></span><span></span><span></span></div>' +
          '</header>' +
          '<div class="citv-cuerpo">' +
            '<ol class="inst-pasos">' +
              '<li><span class="inst-ico">' + COMPARTIR_IOS + '</span>' +
                  '<div>Toca <strong>Compartir</strong>, abajo en la barra de Safari.</div></li>' +
              '<li><span class="inst-ico">' + MAS_IOS + '</span>' +
                  '<div>Baja y elige <strong>Añadir a pantalla de inicio</strong>.</div></li>' +
            '</ol>' +
            '<p class="citv-texto">Safari no deja instalarla desde un botón; en el iPhone hay que ' +
            'hacerlo desde ahí. En Android y en la computadora sale sola.</p>' +
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

  function arrancar() {
    registrarServicio();

    var caja = document.querySelector('.sidebar-actions');
    if (!caja) return;
    caja.insertAdjacentHTML('afterbegin', htmlBoton());
    var boton = document.getElementById('btnInstalar');
    if (!boton) return;

    // Ya está instalada: el botón no pinta nada.
    if (yaInstalada()) return;

    if (esIOS()) {
      boton.hidden = false;
      boton.addEventListener('click', abrirAyudaIOS);
      return;
    }

    /* Android y escritorio. El aviso llega cuando el navegador decide que
       la aplicación cumple —manifiesto, iconos, service worker y HTTPS—,
       y hay que quedárselo: si no se guarda, se pierde y ya no se puede
       pedir la instalación más tarde. */
    var guardado = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      guardado = e;
      boton.hidden = false;
    });

    boton.addEventListener('click', async function () {
      if (!guardado) return;
      boton.disabled = true;
      try {
        guardado.prompt();
        await guardado.userChoice;
      } catch (e) {
        console.warn('[instalar] el navegador rechazó la instalación:', e);
      } finally {
        // El aviso guardado solo sirve una vez.
        guardado = null;
        boton.disabled = false;
        boton.hidden = true;
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
