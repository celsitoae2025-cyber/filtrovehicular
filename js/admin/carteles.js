/* ============================================================
   ADMIN — PUBLICIDAD

   El dueño sube una imagen y esa imagen aparece dentro de la
   aplicación de TODOS los clientes, en computadora y en teléfono.

   Qué NO es: no es un anuncio de la campana (eso es js/admin/
   broadcasts.js, que manda notificaciones) ni la cinta de incidencia
   (eso es aviso-clientes.js). Esto es un cartel, y vive en su propia
   tabla `public.carteles` con su depósito de Storage.

   Dos reglas, las dos del mismo motivo —que nadie publique algo sin
   querer—:

     1. Subir NO publica. La imagen entra apagada y se enciende con su
        interruptor, igual que el aviso a clientes.
     2. Borrar pide confirmación y se lleva también el archivo del
        depósito, para que el depósito no se llene de imágenes que ya
        no usa nadie.

   La imagen se sube antes que la fila: si la subida falla, no queda
   una fila apuntando a una imagen que no existe.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};
  window.Consultia.Admin = window.Consultia.Admin || {};
  var A = window.Consultia.Admin;

  var BUCKET = 'carteles';
  var MAX_BYTES = 5 * 1024 * 1024;
  var TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

  var elegido = null;   // el File que espera a subirse
  var filas = [];       // lo que hay en la tabla
  var trabajando = false;

  function sb() { return (window.Consultia && window.Consultia.supabase) || null; }
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function avisar(tipo, titulo, mensaje) {
    if (Consultia.toast) Consultia.toast({ type: tipo, title: titulo, message: mensaje });
    else if (tipo === 'error') alert(titulo + ': ' + mensaje);
  }

  function fecha(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  /* ── La imagen que se va a subir ─────────────────────────── */

  function mostrarElegida(file) {
    var previa = $('ctlPrevia');
    var vacio  = $('ctlZonaVacio');
    var nombre = $('ctlArchivo');
    if (!file) {
      elegido = null;
      if (previa) { previa.hidden = true; previa.removeAttribute('src'); }
      if (vacio) vacio.hidden = false;
      if (nombre) { nombre.hidden = true; nombre.textContent = ''; }
      return;
    }
    elegido = file;
    var lector = new FileReader();
    lector.onload = function () {
      if (previa) { previa.src = lector.result; previa.hidden = false; }
      if (vacio) vacio.hidden = true;
    };
    lector.readAsDataURL(file);
    if (nombre) {
      nombre.hidden = false;
      /* Un archivo de 700 bytes ponia «0 KB» y parecia que algo habia
         salido mal. */
      var kb = file.size / 1024;
      nombre.textContent = file.name + ' · ' +
        (kb < 1 ? 'menos de 1 KB' : Math.round(kb) + ' KB');
    }
  }

  function aceptar(file) {
    if (!file) return;
    if (TIPOS.indexOf(file.type) === -1) {
      avisar('error', 'Ese archivo no vale', 'Tiene que ser una imagen PNG, JPG, WEBP o GIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      avisar('error', 'La imagen pesa demasiado', 'El tope son 5 MB y esta tiene ' +
        Math.round(file.size / 1024 / 1024 * 10) / 10 + ' MB.');
      return;
    }
    mostrarElegida(file);
  }

  function limpiarFormulario() {
    mostrarElegida(null);
    var f = $('ctlCampo'); if (f) f.value = '';
    var t = $('ctlTitulo'); if (t) t.value = '';
    var e = $('ctlEnlace'); if (e) e.value = '';
  }

  /* ── Subir ───────────────────────────────────────────────── */

  async function subir() {
    if (trabajando) return;
    var c = sb();
    if (!c) { avisar('error', 'Sin conexión', 'No se pudo hablar con la base de datos.'); return; }
    if (!elegido) { avisar('warning', 'Falta la imagen', 'Elige primero la imagen que quieres subir.'); return; }

    var enlace = ($('ctlEnlace') && $('ctlEnlace').value || '').trim();
    /* Un enlace que no sea http(s) no se acepta: `javascript:` dentro de
       un cartel que ven todos los clientes es una puerta abierta. */
    if (enlace && !/^https?:\/\//i.test(enlace)) {
      avisar('error', 'El enlace no vale', 'Tiene que empezar por http:// o https://');
      return;
    }

    var btn = $('ctlSubirBtn');
    trabajando = true;
    if (btn) { btn.disabled = true; btn.dataset.txt = btn.textContent; btn.textContent = 'Subiendo…'; }

    try {
      var limpio = (elegido.name || 'imagen')
        .replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-60);
      var ruta = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + limpio;

      var up = await c.storage.from(BUCKET).upload(ruta, elegido, {
        contentType: elegido.type || 'image/png',
        upsert: false
      });
      if (up.error) throw up.error;

      var pub = c.storage.from(BUCKET).getPublicUrl(ruta);
      var url = (pub && pub.data && pub.data.publicUrl) || '';
      if (!url) throw new Error('El depósito no devolvió la dirección de la imagen');

      var sesion = await c.auth.getUser();
      var uid = sesion && sesion.data && sesion.data.user ? sesion.data.user.id : null;

      var siguiente = filas.length
        ? Math.max.apply(null, filas.map(function (f) { return f.orden || 0; })) + 1
        : 0;

      var ins = await c.from('carteles').insert({
        titulo: ($('ctlTitulo') && $('ctlTitulo').value || '').trim(),
        imagen_url: url,
        imagen_path: ruta,
        enlace: enlace || null,
        activa: false,
        orden: siguiente,
        created_by: uid
      });
      /* Si la fila no entra, el archivo ya subido se retira: no se deja
         basura en el depósito por un fallo a medio camino. */
      if (ins.error) {
        try { await c.storage.from(BUCKET).remove([ruta]); } catch (_) {}
        throw ins.error;
      }

      limpiarFormulario();
      avisar('success', 'Imagen subida', 'Enciéndela abajo cuando quieras que la vean.');
      await cargar();
    } catch (e) {
      console.error('[carteles] no se pudo subir:', e);
      avisar('error', 'No se pudo subir', (e && e.message) || 'Inténtalo otra vez.');
    } finally {
      trabajando = false;
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.txt || 'Subir imagen'; }
    }
  }

  /* ── La lista ────────────────────────────────────────────── */

  function pintar() {
    var lista = $('ctlLista');
    var vacio = $('ctlVacio');
    if (!lista) return;

    if (!filas.length) {
      lista.innerHTML = '';
      if (vacio) vacio.hidden = false;
      return;
    }
    if (vacio) vacio.hidden = true;

    lista.innerHTML = filas.map(function (f, i) {
      var enlace = f.enlace
        ? '<a class="cartel-fila-enlace" href="' + esc(f.enlace) + '" target="_blank" rel="noopener noreferrer">' + esc(f.enlace) + '</a>'
        : '<span class="cartel-fila-enlace cartel-sin">Sin enlace</span>';
      return '' +
      '<article class="cartel-fila' + (f.activa ? ' esta-encendida' : '') + '" data-id="' + esc(f.id) + '">' +
        '<img class="cartel-fila-img" src="' + esc(f.imagen_url) + '" alt="">' +
        '<div class="cartel-fila-txt">' +
          '<strong>' + esc(f.titulo || 'Sin nombre') + '</strong>' +
          enlace +
          '<span class="cartel-fila-meta">' + (f.activa ? 'Encendida' : 'Apagada') +
            ' · subida el ' + esc(fecha(f.created_at)) + '</span>' +
        '</div>' +
        '<div class="cartel-fila-btns">' +
          '<button type="button" class="btn btn-sm ' + (f.activa ? 'btn-outline' : 'btn-primary') +
            '" data-accion="alternar">' + (f.activa ? 'Apagar' : 'Encender') + '</button>' +
          '<button type="button" class="btn btn-sm btn-outline" data-accion="subir"' +
            (i === 0 ? ' disabled' : '') + ' aria-label="Subir en el orden">↑</button>' +
          '<button type="button" class="btn btn-sm btn-outline" data-accion="bajar"' +
            (i === filas.length - 1 ? ' disabled' : '') + ' aria-label="Bajar en el orden">↓</button>' +
          '<button type="button" class="btn btn-sm btn-outline" data-accion="borrar">Borrar</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  async function cargar() {
    var c = sb();
    if (!c) return;
    var res = await c.from('carteles').select('*')
      .order('orden', { ascending: true })
      .order('created_at', { ascending: true });
    if (res.error) {
      console.error('[carteles] no se pudo leer la lista:', res.error);
      avisar('error', 'No se pudo cargar', 'Revisa que la migración de los carteles esté aplicada.');
      return;
    }
    filas = res.data || [];
    pintar();
  }

  /* ── Acciones sobre una fila ─────────────────────────────── */

  async function alternar(f) {
    var c = sb();
    var res = await c.from('carteles').update({ activa: !f.activa }).eq('id', f.id);
    if (res.error) {
      avisar('error', 'No se pudo cambiar', res.error.message || '');
      return;
    }
    avisar('success', f.activa ? 'Imagen apagada' : 'Imagen encendida',
      f.activa ? 'Ya no se ve en la aplicación.' : 'Ya se ve en la aplicación de todos.');
    await cargar();
  }

  /* El orden se guarda como número: para mover una fila se intercambia
     su número con el de la vecina. Se escriben las dos o ninguna tiene
     sentido, así que si la segunda falla se deshace la primera. */
  async function mover(f, delta) {
    var c = sb();
    var i = filas.indexOf(f);
    var j = i + delta;
    if (j < 0 || j >= filas.length) return;
    var otra = filas[j];
    var mio = f.orden, suyo = otra.orden;
    if (mio === suyo) { suyo = mio + delta; }

    var a = await c.from('carteles').update({ orden: suyo }).eq('id', f.id);
    if (a.error) { avisar('error', 'No se pudo mover', a.error.message || ''); return; }
    var b = await c.from('carteles').update({ orden: mio }).eq('id', otra.id);
    if (b.error) {
      await c.from('carteles').update({ orden: mio }).eq('id', f.id);
      avisar('error', 'No se pudo mover', b.error.message || '');
      return;
    }
    await cargar();
  }

  async function borrar(f) {
    /* Consultia.confirm es el que devuelve promesa; confirmDialog, su
       hermano de al lado, trabaja con callbacks y aqui haria que el
       borrado se ejecutara sin esperar respuesta. */
    var seguro = Consultia.confirm
      ? await Consultia.confirm({
          title: 'Borrar la imagen',
          message: 'Se quita de la aplicación y se borra el archivo. No se puede deshacer.',
          confirmText: 'Borrar',
          danger: true
        })
      : window.confirm('¿Borrar la imagen? No se puede deshacer.');
    if (!seguro) return;

    var c = sb();
    var res = await c.from('carteles').delete().eq('id', f.id);
    if (res.error) { avisar('error', 'No se pudo borrar', res.error.message || ''); return; }
    /* El archivo se borra DESPUÉS de la fila: si esto falla, lo que
       queda es un archivo suelto que ya no ve nadie, y no una fila que
       apunta a una imagen borrada. */
    if (f.imagen_path) {
      try { await c.storage.from('carteles').remove([f.imagen_path]); } catch (_) {}
    }
    avisar('success', 'Imagen borrada', 'Ya no se ve en la aplicación.');
    await cargar();
  }

  /* ── Conexiones ──────────────────────────────────────────── */

  var conectado = false;

  function conectar() {
    if (conectado) return;
    conectado = true;

    var zona = $('ctlZona');
    var file = $('ctlCampo');

    if (zona && file) {
      /* Aqui ya NO se abre el explorador por codigo ni se intercepta el
         arrastre. La zona es una <label> y el campo la cubre entera, asi
         que el navegador hace las dos cosas solo:

           · pulsar la zona = pulsar el campo -> se abre el explorador;
           · soltar una imagen encima = soltarla en el campo -> el campo
             se queda con el archivo y avisa con 'change'.

         Lo unico que queda en JavaScript es lo que el navegador no hace:
         pintar el borde mientras algo se arrastra por encima, y ensenar
         la imagen elegida. Si este archivo no llegara a cargar, elegir la
         imagen seguiria funcionando igual. */
      file.addEventListener('change', function () { aceptar(file.files && file.files[0]); });

      ['dragenter', 'dragover'].forEach(function (ev) {
        zona.addEventListener(ev, function () { zona.classList.add('esta-encima'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        zona.addEventListener(ev, function () { zona.classList.remove('esta-encima'); });
      });
    }

    var subirBtn = $('ctlSubirBtn');
    if (subirBtn) subirBtn.addEventListener('click', subir);
    var limpiarBtn = $('ctlLimpiarBtn');
    if (limpiarBtn) limpiarBtn.addEventListener('click', limpiarFormulario);

    var lista = $('ctlLista');
    if (lista) lista.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-accion]');
      if (!btn) return;
      var art = btn.closest('.cartel-fila');
      if (!art) return;
      var f = filas.filter(function (x) { return x.id === art.dataset.id; })[0];
      if (!f) return;
      if (btn.dataset.accion === 'alternar') alternar(f);
      if (btn.dataset.accion === 'subir')    mover(f, -1);
      if (btn.dataset.accion === 'bajar')    mover(f, 1);
      if (btn.dataset.accion === 'borrar')   borrar(f);
    });
  }

  A.renderCarteles = function () {
    conectar();
    cargar();
  };
})();
