/* ============================================================
   DESLIZAR PARA ACTUALIZAR (pull to refresh)

   POR QUÉ HACE FALTA ESCRIBIRLO:
   El navegador trae este gesto de serie, pero solo funciona cuando el
   que scrollea es el DOCUMENTO. Aquí no lo es: `html` y `body` están a
   `overflow:hidden` con altura fija —el maquetado de barra + menú fijos
   lo necesita— y quien scrollea es `.main`. El gesto se lo come ese
   contenedor y el navegador nunca se entera.

   Y aunque el documento scrollease, la app instalada en el teléfono
   corre en modo `standalone`, donde Chrome desactiva el gesto nativo.

   Así que se implementa sobre el contenedor real: se detecta el arrastre
   hacia abajo estando arriba del todo y, si se pasa del umbral, se
   recarga.

   NO PINTA NADA. Hubo un indicador —un círculo verde con una flecha que
   seguía al dedo— y se retiró entero: el gesto actualiza y punto. Si
   alguien lo echa de menos, está en el historial de git; no se vuelve a
   añadir sin pedirlo.

   Va de la mano de `overscroll-behavior-y: contain` en html y body
   (base.css), que apaga el círculo que el propio navegador saca al
   deslizar. Si se quita aquello, vuelven a salir dos cosas a la vez.

   Solo actúa con el dedo (touch). Con ratón no se toca nada.
============================================================ */
(function () {
  window.Consultia = window.Consultia || {};

  var UMBRAL   = 70;    // px de arrastre para que dispare
  var TOPE     = 110;   // no se estira más allá de esto
  var RESIST   = 0.5;   // el arrastre se siente con resistencia, como en el sistema

  var cont = null;      // contenedor que scrollea
  var y0 = null;        // dónde empezó el dedo
  var arrastre = 0;
  var tirando = false;  // ya se decidió que esto es un tirón, no un scroll

  /* ── Qué scrollea bajo el dedo ──
     No se puede dar por hecho que sea `.main`: según dónde toques puede
     ser el formulario de acceso, un panel o una lista. Se busca el
     primer antecesor que scrollee de verdad, y si no hay ninguno se cae
     a `.main`, que es el scroller de la aplicación. */
  function scrollerDe(nodo) {
    var el = nodo;
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      var s = getComputedStyle(el);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight + 2) {
        return el;
      }
      el = el.parentElement;
    }
    return document.querySelector('.main') ||
           document.scrollingElement ||
           document.documentElement;
  }

  function scrollDe(el) {
    return (el === document.documentElement || el === document.body)
      ? (window.scrollY || document.documentElement.scrollTop || 0)
      : el.scrollTop;
  }

  /* ── Situaciones en las que NO se toca el gesto ──
     Solo cuando hay algo ENCIMA de la aplicación: un modal, el menú
     lateral abierto. Ahí el dedo está haciendo otra cosa y recargar
     sería una interrupción.

     La pantalla de acceso NO entra en esta lista: es la aplicación
     entera, no una capa encima, y recargar ahí es tan normal como en
     cualquier otra página. Bloquearla dejaba el gesto muerto justo para
     quien todavía no ha iniciado sesión. */
  function bloqueado() {
    var h = document.documentElement.classList;
    var b = document.body.classList;
    return h.contains('avc-abierto') ||       // aviso a clientes
           h.contains('mnt-locked') ||        // modo mantenimiento
           b.contains('sidebar-open') ||      // menú lateral
           b.contains('admin-sidebar-open') ||
           b.contains('wa-abierto');          // menú de WhatsApp
  }

  /* SIN INDICADOR.

     Aqui se dibujaba un circulo verde con una flecha que seguia al dedo
     y giraba. Se retiro por completo: el gesto tiene que actualizar y
     nada mas, sin nada que aparezca en pantalla. Por eso este modulo ya
     no necesita `css/pull-refresh.css` y esa hoja no se carga.

     Lo unico que se ve es la propia recarga de la pagina. */

  function alEmpezar(e) {
    if (bloqueado() || e.touches.length !== 1) { y0 = null; return; }
    cont = scrollerDe(e.target);
    // Solo cuenta si eso que hay bajo el dedo ya está arriba del todo
    y0 = scrollDe(cont) <= 0 ? e.touches[0].clientY : null;
    arrastre = 0;
    tirando = false;
  }

  function alMover(e) {
    if (y0 === null || bloqueado()) return;

    var dy = e.touches[0].clientY - y0;
    if (dy <= 0) {                 // se fue hacia arriba: es un scroll normal
      if (tirando) tirando = false;
      y0 = null;
      return;
    }

    // Si mientras tanto el contenedor se movió, esto era un scroll
    if (scrollDe(cont) > 0) {
      y0 = null;
      if (tirando) tirando = false;
      return;
    }

    // Umbral pequeño para no confundir un scroll con un tirón
    if (!tirando && dy < 8) return;
    tirando = true;

    arrastre = Math.min(dy * RESIST, TOPE);
    // Se corta el scroll del contenedor mientras se tira
    if (e.cancelable) e.preventDefault();
  }

  function alSoltar() {
    if (!tirando) { y0 = null; return; }
    tirando = false;
    y0 = null;

    if (arrastre >= UMBRAL) window.location.reload();
    arrastre = 0;
  }

  function iniciar() {
    // Sin dedo no hay gesto: en escritorio esto no existe
    if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;

    document.addEventListener('touchstart', alEmpezar, { passive: true });
    document.addEventListener('touchmove', alMover, { passive: false });
    document.addEventListener('touchend', alSoltar, { passive: true });
    document.addEventListener('touchcancel', function () {
      tirando = false;
      y0 = null;
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  Consultia.PullRefresh = { iniciar: iniciar };
})();
