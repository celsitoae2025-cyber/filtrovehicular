/* ============================================================
   EL CARTEL PUBLICITARIO — lo que ve el cliente

   Lee de `public.publicidad` las imágenes ENCENDIDAS y las pinta en
   cada hueco marcado con `data-publicidad` del documento. Hoy hay dos
   huecos —la pantalla principal y la lista de consultas del teléfono—,
   y para añadir un tercero basta con poner el atributo en el HTML: aquí
   no hay que tocar nada.

   Por qué se lee directo de la tabla y no por una función: la política
   de lectura solo deja ver las filas con `activa = true`, y está
   abierta también a quien todavía no ha iniciado sesión. Lo apagado no
   sale de la base de datos, así que no hay nada que esconder después.

   Si hay varias imágenes, se turnan cada 7 segundos. Se turnan solas
   porque un cartel quieto con tres anuncios detrás solo enseña uno; y
   se paran cuando la pestaña no se está viendo, para no gastar batería
   pintando lo que nadie mira.

   Un fallo aquí NO puede romper la aplicación: si la consulta falla,
   los huecos se quedan vacíos y la plataforma sigue como si nada.
============================================================ */

(function () {
  'use strict';
  window.Consultia = window.Consultia || {};

  var CADA_MS = 7000;

  var laminas = [];     // las imágenes encendidas
  var carteles = [];    // { raiz, laminas, puntos, i }
  var reloj = null;

  function sb() { return (window.Consultia && window.Consultia.supabase) || null; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Solo http(s). El panel ya lo comprueba al guardar; se vuelve a
     comprobar aquí porque esto es lo que acaba siendo un enlace en el
     navegador del cliente. */
  function enlaceSeguro(url) {
    if (!url) return '';
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function html(lista) {
    var laminasHtml = lista.map(function (p, i) {
      var url = enlaceSeguro(p.enlace);
      var alt = esc(p.titulo || 'Publicidad');
      var clases = 'pub-lamina' + (i === 0 ? ' esta-visible' : '') + (url ? ' tiene-enlace' : '');
      var img = '<img src="' + esc(p.imagen_url) + '" alt="' + alt + '" loading="lazy">';
      if (url) {
        return '<a class="' + clases + '" href="' + esc(url) + '" target="_blank" ' +
          'rel="noopener noreferrer nofollow sponsored">' + img + '</a>';
      }
      return '<div class="' + clases + '">' + img + '</div>';
    }).join('');

    var puntos = lista.length > 1
      ? '<div class="pub-puntos">' + lista.map(function (p, i) {
          return '<button class="pub-punto' + (i === 0 ? ' esta-activo' : '') + '" type="button" ' +
            'data-i="' + i + '" aria-label="Ver la imagen ' + (i + 1) + '"></button>';
        }).join('') + '</div>'
      : '';

    return '<div class="pub-marco">' + laminasHtml + '</div>' + puntos;
  }

  function mostrar(cartel, i) {
    if (!cartel.laminas.length) return;
    cartel.i = (i + cartel.laminas.length) % cartel.laminas.length;
    cartel.laminas.forEach(function (l, n) {
      l.classList.toggle('esta-visible', n === cartel.i);
    });
    cartel.puntos.forEach(function (p, n) {
      p.classList.toggle('esta-activo', n === cartel.i);
    });
  }

  function girar() {
    if (document.hidden) return;
    carteles.forEach(function (c) {
      if (c.laminas.length > 1 && c.raiz.offsetParent !== null) mostrar(c, c.i + 1);
    });
  }

  function pintar() {
    carteles = [];
    var huecos = document.querySelectorAll('[data-publicidad]');
    Array.prototype.forEach.call(huecos, function (hueco) {
      if (!laminas.length) {
        hueco.innerHTML = '';
        hueco.hidden = true;
        return;
      }
      hueco.className = 'pub-cartel';
      hueco.innerHTML = html(laminas);
      hueco.hidden = false;

      var cartel = {
        raiz: hueco,
        laminas: Array.prototype.slice.call(hueco.querySelectorAll('.pub-lamina')),
        puntos: Array.prototype.slice.call(hueco.querySelectorAll('.pub-punto')),
        i: 0
      };
      cartel.puntos.forEach(function (p) {
        p.addEventListener('click', function () { mostrar(cartel, Number(p.dataset.i) || 0); });
      });
      carteles.push(cartel);
    });

    if (reloj) { clearInterval(reloj); reloj = null; }
    if (laminas.length > 1) reloj = setInterval(girar, CADA_MS);
  }

  async function cargar() {
    var c = sb();
    if (!c) return;
    try {
      var res = await c.from('publicidad')
        .select('id, titulo, imagen_url, enlace, orden')
        .eq('activa', true)
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true });
      if (res.error) throw res.error;
      laminas = res.data || [];
      pintar();
    } catch (e) {
      /* Sin ruido para el cliente: un cartel que no carga no es un
         problema suyo. Queda en la consola para quien lo mire. */
      console.warn('[publicidad] no se pudo cargar:', e && e.message);
    }
  }

  function arrancar() {
    if (!document.querySelector('[data-publicidad]')) return;
    cargar();
    /* Al volver a la pestaña se vuelve a preguntar: si el dueño encendió
       o apagó una imagen mientras tanto, el cliente la ve sin recargar. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) cargar();
    });
  }

  Consultia.recargarPublicidad = cargar;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
})();
