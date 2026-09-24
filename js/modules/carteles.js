/* ============================================================
   LOS CARTELES — la ventana flotante que ve el cliente

   Lo que el administrador sube y enciende en «Publicidad» sale en una
   VENTANA FLOTANTE en cuanto el cliente abre la aplicación, en
   computadora y en teléfono. No va incrustado en ninguna pantalla: se
   pone delante de todo, se ve entero y se cierra con la equis, tocando
   fuera o con Escape.

   Cuándo sale, y cuántas veces:

     · Al abrir la aplicación, UNA vez por visita. Se recuerda en
       sessionStorage: recargar la página no la vuelve a sacar, pero
       abrir la aplicación otro día sí.
     · Si el administrador cambia lo encendido —enciende otra imagen,
       apaga una, cambia el orden—, es algo nuevo y vuelve a salir,
       aunque el cliente ya hubiera cerrado la anterior en esta visita.
       Por eso lo recordado no es «ya la vi» sino la FIRMA de lo que vio.
     · Si el cliente tiene la aplicación abierta en otra pestaña y el
       administrador publica algo, lo ve al volver a ella.

   Cuándo NO sale:

     · Sobre la pantalla de acceso. Taparía el formulario y el cliente no
       podría entrar; se espera a que haya sesión (la misma regla que el
       aviso a clientes).
     · Encima del aviso a clientes. Si ese cuadro está abierto, este
       espera a que se cierre: dos ventanas apiladas no las lee nadie.

   Varias imágenes se turnan cada 6 segundos, con flechas y puntos para
   pasarlas a mano. Todas ocupan la misma celda de la rejilla, así que
   la ventana mide lo que la más alta y no da saltos al cambiar.

   Por qué se llama «carteles» y no «publicidad»: los bloqueadores de
   anuncios cortan cualquier dirección que lleve esa palabra, y con ella
   este archivo no llegaba a cargar (comprobado en el navegador del
   dueño). Ver la migración 20260924200000_carteles_renombre.sql.

   Un fallo aquí NO puede romper la aplicación: si algo sale mal, la
   ventana simplemente no aparece.
============================================================ */

(function () {
  'use strict';
  window.Consultia = window.Consultia || {};

  var CADA_MS   = 6000;
  var CLAVE     = 'fv_carteles_vistos';
  var ID        = 'ctlVentana';

  var lista = [];       // los carteles encendidos
  var reloj = null;
  var actual = 0;
  var foco = null;      // lo que tenía el foco antes de abrir
  var esperando = false;

  function sb() { return (window.Consultia && window.Consultia.supabase) || null; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Solo http(s): esto acaba siendo un enlace en el navegador de cada
     cliente, y `javascript:` ahí sería una puerta abierta. */
  function enlaceSeguro(url) {
    return url && /^https?:\/\//i.test(url) ? url : '';
  }

  /* La firma de lo encendido: cambia si cambia cualquier imagen, su
     enlace o su orden. */
  function firma(filas) {
    return filas.map(function (f) { return f.id + ':' + (f.orden || 0) + ':' + (f.imagen_url || ''); }).join('|');
  }

  function yaVista(f) {
    try { return sessionStorage.getItem(CLAVE) === f; } catch (e) { return false; }
  }
  function marcarVista(f) {
    try { sessionStorage.setItem(CLAVE, f); } catch (e) {}
  }

  /* ── ¿Se puede sacar ahora? ─────────────────────────────── */

  function haySesion() {
    return !document.body.classList.contains('auth-locked');
  }
  function avisoAbierto() {
    return document.documentElement.classList.contains('avc-abierto');
  }
  function yaAbierta() {
    return !!document.getElementById(ID);
  }

  /* Si ahora no se puede —pantalla de acceso, o el aviso a clientes
     delante—, se vigila hasta que se pueda. Se miran las clases del
     <body> y del <html>, que es lo que cambian esos dos módulos. */
  function esperarMomento() {
    if (esperando) return;
    esperando = true;
    var obs = new MutationObserver(function () {
      if (haySesion() && !avisoAbierto()) {
        obs.disconnect();
        esperando = false;
        decidir();
      }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  function decidir() {
    if (!lista.length || yaAbierta()) return;
    var f = firma(lista);
    if (yaVista(f)) return;
    if (!haySesion() || avisoAbierto()) { esperarMomento(); return; }
    precargarYMostrar(f);
  }

  /* ── La ventana ─────────────────────────────────────────── */

  /* Se espera a que llegue la primera imagen antes de abrir: una ventana
     vacía que se rellena medio segundo después parece un fallo. Con un
     tope, por si la red va lenta. */
  function precargarYMostrar(f) {
    var hecho = false;
    var img = new Image();
    function seguir(ok) {
      if (hecho) return;
      hecho = true;
      if (!ok && lista.length === 1) return;   // la única imagen no carga: no se abre nada
      if (yaAbierta() || yaVista(f)) return;
      mostrar(f);
    }
    img.onload = function () { seguir(true); };
    img.onerror = function () { seguir(false); };
    setTimeout(function () { seguir(true); }, 4000);
    img.src = lista[0].imagen_url;
  }

  var FLECHA_IZQ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 6 9 12 15 18"/></svg>';
  var FLECHA_DER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>';
  var EQUIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function html() {
    var varias = lista.length > 1;

    var laminas = lista.map(function (c, i) {
      var url = enlaceSeguro(c.enlace);
      var alt = esc(c.titulo || 'Imagen de Filtro Vehicular+');
      var clases = 'ctl-lamina' + (i === 0 ? ' esta-visible' : '');
      var img = '<img src="' + esc(c.imagen_url) + '" alt="' + alt + '">';
      return url
        ? '<a class="' + clases + ' tiene-enlace" href="' + esc(url) + '" target="_blank" ' +
            'rel="noopener noreferrer nofollow">' + img + '</a>'
        : '<div class="' + clases + '">' + img + '</div>';
    }).join('');

    var flechas = varias
      ? '<button type="button" class="ctl-flecha ctl-flecha-izq" data-paso="-1" aria-label="Anterior">' + FLECHA_IZQ + '</button>' +
        '<button type="button" class="ctl-flecha ctl-flecha-der" data-paso="1" aria-label="Siguiente">' + FLECHA_DER + '</button>'
      : '';

    var puntos = varias
      ? '<div class="ctl-puntos">' + lista.map(function (c, i) {
          return '<button type="button" class="ctl-punto' + (i === 0 ? ' esta-activo' : '') + '" ' +
            'data-i="' + i + '" aria-label="Ver la imagen ' + (i + 1) + ' de ' + lista.length + '"></button>';
        }).join('') + '</div>'
      : '';

    return '<div class="ctl-ventana">' +
        '<button type="button" class="ctl-cerrar" aria-label="Cerrar">' + EQUIS + '</button>' +
        '<div class="ctl-marco">' + laminas + flechas + '</div>' +
        puntos +
      '</div>';
  }

  function ir(i) {
    var el = document.getElementById(ID);
    if (!el || !lista.length) return;
    actual = (i + lista.length) % lista.length;
    Array.prototype.forEach.call(el.querySelectorAll('.ctl-lamina'), function (l, n) {
      l.classList.toggle('esta-visible', n === actual);
    });
    Array.prototype.forEach.call(el.querySelectorAll('.ctl-punto'), function (p, n) {
      p.classList.toggle('esta-activo', n === actual);
    });
  }

  function arrancarReloj() {
    pararReloj();
    if (lista.length > 1) reloj = setInterval(function () {
      if (!document.hidden) ir(actual + 1);
    }, CADA_MS);
  }
  function pararReloj() {
    if (reloj) { clearInterval(reloj); reloj = null; }
  }

  function alPulsarTecla(e) {
    if (!yaAbierta()) return;
    if (e.key === 'Escape') { cerrar(); return; }
    if (lista.length > 1 && e.key === 'ArrowRight') { ir(actual + 1); arrancarReloj(); }
    if (lista.length > 1 && e.key === 'ArrowLeft')  { ir(actual - 1); arrancarReloj(); }
  }

  function mostrar(f) {
    if (yaAbierta()) return;
    actual = 0;
    foco = document.activeElement;

    var el = document.createElement('div');
    el.id = ID;
    el.className = 'ctl-fondo';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Novedades de Filtro Vehicular+');
    el.dataset.firma = f;
    el.innerHTML = html();

    document.body.appendChild(el);
    document.documentElement.classList.add('ctl-abierto');
    /* La marca de «vista» se pone al ABRIR, no al cerrar: si el cliente
       recarga con la ventana delante, no se la vuelve a encontrar. */
    marcarVista(f);

    el.addEventListener('click', function (e) {
      if (e.target === el) { cerrar(); return; }
      if (e.target.closest('.ctl-cerrar')) { cerrar(); return; }
      var flecha = e.target.closest('.ctl-flecha');
      if (flecha) { ir(actual + Number(flecha.dataset.paso)); arrancarReloj(); return; }
      var punto = e.target.closest('.ctl-punto');
      if (punto) { ir(Number(punto.dataset.i) || 0); arrancarReloj(); }
    });
    document.addEventListener('keydown', alPulsarTecla);

    /* Una imagen que no carga se retira de la ronda; si no queda
       ninguna, la ventana se cierra sola. */
    Array.prototype.forEach.call(el.querySelectorAll('.ctl-lamina img'), function (img) {
      img.addEventListener('error', function () {
        var lam = img.closest('.ctl-lamina');
        var idx = Array.prototype.indexOf.call(el.querySelectorAll('.ctl-lamina'), lam);
        if (idx === -1) return;
        lista.splice(idx, 1);
        if (!lista.length) { cerrar(); return; }
        el.innerHTML = html();
        ir(0);
        arrancarReloj();
      });
    });

    arrancarReloj();
    var x = el.querySelector('.ctl-cerrar');
    try { x.focus({ preventScroll: true }); } catch (e) {}
  }

  function cerrar() {
    var el = document.getElementById(ID);
    pararReloj();
    document.removeEventListener('keydown', alPulsarTecla);
    document.documentElement.classList.remove('ctl-abierto');
    if (el) el.remove();
    if (foco && foco.focus) { try { foco.focus({ preventScroll: true }); } catch (e) {} }
    foco = null;
  }

  /* ── Leer lo encendido ──────────────────────────────────── */

  async function cargar() {
    var c = sb();
    if (!c) return;
    try {
      var res = await c.from('carteles')
        .select('id, titulo, imagen_url, enlace, orden, created_at')
        .eq('activa', true)
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true });
      if (res.error) throw res.error;
      var nuevas = res.data || [];

      /* Si la ventana está abierta y el administrador cambió algo, se
         deja como está: repintarla con el cliente mirando sería peor
         que enseñarle lo nuevo la próxima vez. */
      if (yaAbierta()) return;
      lista = nuevas;
      decidir();
    } catch (e) {
      console.warn('[carteles] no se pudieron leer:', e && e.message);
    }
  }

  function arrancar() {
    /* Un respiro tras cargar: la primera pantalla termina de pintarse y
       la sesión termina de restaurarse antes de que salga nada. */
    setTimeout(cargar, 900);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) cargar();
    });
  }

  Consultia.Carteles = { recargar: cargar, cerrar: cerrar };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
})();
