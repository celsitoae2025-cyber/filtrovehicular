/* ============================================================
   INTERFAZ NUEVA — el núcleo

   Lo que comparten todas las pantallas:
     · la sesión y el perfil (una sola lectura, compartida);
     · el saldo, pintado en todos los sitios que llevan [data-saldo];
     · la navegación por el hash (#consultar, #pagos…);
     · los avisos flotantes (Consultia.toast), que el motor de consultas
       usa para contar errores y cobros.

   Se carga ANTES que el motor (filter.js y compañía) para que, cuando
   el motor pida un aviso o quiera refrescar el saldo, ya exista quien
   lo atienda.
============================================================ */
(function () {
  'use strict';
  var C = window.Consultia = window.Consultia || {};
  var NV = C.NV = C.NV || {};

  C.WHATSAPP_NUMBER = C.WHATSAPP_NUMBER || '51932465820';
  /* El saludo con que empiezan los mensajes a WhatsApp (soporte y aviso
     a clientes lo usan). */
  C.greeting = C.greeting || function () {
    var h = new Date().getHours();
    if (h >= 5 && h < 12)  return 'Buenos días';
    if (h >= 12 && h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  function $(id) { return document.getElementById(id); }
  NV.$ = $;

  NV.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  NV.llano = function (s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  NV.fecha = function (iso, conHora) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var f = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
      return conHora ? f + ' · ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : f;
    } catch (e) { return ''; }
  };

  NV.numero = function (n) {
    return Number(n || 0).toLocaleString('es-PE');
  };

  NV.soles = function (n) {
    return 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  NV.CATEGORIAS = {
    filter:     'Vehicular',
    vehiculos:  'Vehículos',
    reniec:     'Reniec',
    sunarp:     'Sunarp',
    telefonia:  'Telefonía',
    familiares: 'Familia',
    financiero: 'Financiero',
    delitos:    'Justicia',
    extras:     'Extras',
    premium:    'Premium',
    general:    'General'
  };
  NV.ORDEN = ['filter', 'reniec', 'sunarp', 'telefonia', 'familiares', 'financiero', 'delitos', 'extras'];

  NV.whatsapp = function (texto) {
    return 'https://wa.me/' + C.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(texto || '');
  };


  /* ── Avisos flotantes ─────────────────────────────────────── */
  /* Misma firma que el Consultia.toast de /app ({type, title, message}):
     el motor de consultas lo llama tal cual. */
  C.toast = function (o) {
    o = o || {};
    var caja = $('nvAvisos');
    if (!caja) return;
    var el = document.createElement('div');
    el.className = 'nv-aviso nv-aviso-' + (o.type || 'info');
    el.setAttribute('role', o.type === 'error' ? 'alert' : 'status');
    el.innerHTML =
      '<strong>' + NV.esc(o.title || '') + '</strong>' +
      (o.message ? '<span>' + NV.esc(o.message) + '</span>' : '');
    /* Un mismo error no debe llenar la pantalla al repetir una acción. */
    Array.from(caja.children).forEach(function (aviso) {
      if (aviso.textContent === el.textContent) aviso.remove();
    });
    while (caja.children.length >= 3) caja.firstElementChild.remove();
    caja.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('es-visible'); });
    setTimeout(function () {
      el.classList.remove('es-visible');
      setTimeout(function () { el.remove(); }, 250);
    }, o.duration || 4200);
  };

  /* Si el motor pide iniciar sesión (sesión vencida a mitad de una
     consulta), se enseña el formulario de acceso de esta misma página. */
  C.AuthModals = C.AuthModals || {
    openLogin: function () { enseñarAcceso(); }
  };


  /* ── Sesión, perfil y saldo ───────────────────────────────── */

  NV.usuario = null;
  NV.perfil = null;

  NV.cargarPerfil = async function () {
    if (!C.Auth) return null;
    var u = await C.Auth.getUser();
    NV.usuario = u || null;
    if (!u) { NV.perfil = null; return null; }
    /* Si la lectura falla (red), se conserva el perfil que ya habia: un
       corte de un segundo no puede dejar el saldo en blanco. */
    try {
      var sb = C.supabase;
      var res = await sb.from('profiles').select('*').eq('id', u.id).single();
      if (res.data) NV.perfil = res.data;
    } catch (e) { /* se queda el anterior */ }
    return NV.perfil;
  };

  NV.esAdmin = function () { return !!(NV.perfil && NV.perfil.is_admin); };

  NV.pintarIdentidad = function () {
    var usuario = NV.usuario || {};
    var perfil = NV.perfil || {};
    var metadata = usuario.user_metadata || {};
    var nombre = String(perfil.full_name || metadata.full_name || metadata.name || '').trim();
    var correo = usuario.email || '';
    if (!nombre) nombre = correo.split('@')[0] || 'Mi cuenta';
    var palabras = nombre.split(/\s+/).filter(Boolean);
    var iniciales = palabras[0].charAt(0) + (palabras.length > 1 ? palabras[palabras.length - 1].charAt(0) : '');
    document.querySelectorAll('[data-avatar-iniciales]').forEach(function (el) { el.textContent = iniciales.toUpperCase(); });
    var nombreEl = $('nvYoNombre'); if (nombreEl) nombreEl.textContent = nombre;
    var correoEl = $('nvYoCorreo'); if (correoEl) correoEl.textContent = correo;
    var avatar = $('nvAvatar'); if (avatar) avatar.setAttribute('aria-label', 'Menú de la cuenta de ' + nombre);
  };

  NV.pintarSaldo = function () {
    var ilimitado = NV.esAdmin();
    var n = NV.perfil ? NV.perfil.credits_balance : null;
    document.querySelectorAll('[data-saldo]').forEach(function (el) {
      el.textContent = ilimitado ? 'Ilimitado' : (n == null ? '—' : NV.numero(n));
    });
    document.querySelectorAll('[data-saldo-uni]').forEach(function (el) {
      el.hidden = ilimitado;
    });
    var accion = $('nvYoAccionSaldo');
    if (accion) accion.textContent = ilimitado ? 'Ver pagos' : 'Recargar';
  };

  NV.refrescarSaldo = async function () {
    await NV.cargarPerfil();
    NV.pintarIdentidad();
    NV.pintarSaldo();
  };

  /* El motor, al terminar una consulta, pide refrescar la barra de
     arriba con Consultia.AuthUI.refresh(): aquí es el saldo. */
  C.AuthUI = C.AuthUI || {};
  C.AuthUI.refresh = function () { NV.refrescarSaldo(); };


  /* ── Navegación ───────────────────────────────────────────── */

  var PANTALLAS = {
    consultar: { titulo: 'Consultar' },
    resumen:   { titulo: 'Resumen' },
    pagos:     { titulo: 'Pagos' },
    historial: { titulo: 'Historial' },
    vehiculos: { titulo: 'Vehículos' },
    cuenta:    { titulo: 'Mi cuenta' },
    regiones:  { titulo: 'Regiones' }
  };

  /* Los enlaces de siempre (#saldo en los mensajes del bot, #dashboard,
     #compras…) siguen llevando a su sitio en esta plataforma. */
  var ALIAS = {
    dashboard: 'resumen', saldo: 'pagos', compras: 'pagos', filter: 'consultar',
    consultas: 'consultar', configuracion: 'cuenta', notificaciones: 'resumen'
  };

  NV.alEntrar = {};   // nombre -> función que pinta la pantalla al abrirla

  NV.actualizarInicio = function () {
    var inicio = $('nvInicio');
    if (!inicio) return;
    var seleccion = $('nvConsultaSeleccion');
    var resultado = $('filter-result');
    var enCatalogo = pantallaDelHash() === 'consultar' &&
      (!seleccion || seleccion.hidden) && (!resultado || resultado.hidden);
    inicio.hidden = enCatalogo;
    if (pantallaDelHash() === 'consultar') {
      $('nvTitulo').textContent = enCatalogo && NV.nombreCategoriaActiva
        ? NV.nombreCategoriaActiva() : 'Consultar';
    }
    if (NV.actualizarBusquedaCatalogo) NV.actualizarBusquedaCatalogo(enCatalogo);
  };

  function pantallaDelHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (ALIAS[h]) h = ALIAS[h];
    return PANTALLAS[h] ? h : 'consultar';
  }

  NV.ir = function (nombre) {
    if (ALIAS[nombre]) nombre = ALIAS[nombre];
    if (!PANTALLAS[nombre]) nombre = 'consultar';
    if (location.hash !== '#' + nombre) {
      history.pushState(null, '', '#' + nombre);
    }
    ultimoHash = location.hash;
    mostrar(nombre);
  };

  function mostrar(nombre) {
    document.querySelectorAll('.nv-pantalla').forEach(function (s) {
      s.hidden = s.dataset.pantalla !== nombre;
    });
    document.querySelectorAll('[data-ir]').forEach(function (a) {
      var activo = a.dataset.ir === nombre;
      a.classList.toggle('es-activo', activo);
      if (activo) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var p = PANTALLAS[nombre];
    $('nvTitulo').textContent = p.titulo;
    NV.actualizarInicio();
    document.title = nombre === 'consultar'
      ? 'Plataforma Filtro Vehicular+'
      : p.titulo + ' · Plataforma Filtro Vehicular+';
    window.scrollTo(0, 0);
    if (NV.alEntrar[nombre]) {
      try { NV.alEntrar[nombre](); } catch (e) { console.error('[nueva] ' + nombre + ':', e); }
    }
  }

  window.addEventListener('hashchange', function () { mostrar(pantallaDelHash()); });


  /* ── Capas y el botón «atrás» ──────────────────────────────
     Elegir una consulta o abrir el visor de un PDF no cambia de
     pantalla, así que sin esto el «atrás» del navegador —o el del
     teléfono— sacaba al cliente de la plataforma y lo devolvía a la
     página principal, perdiendo lo que estaba consultando.

     Cada capa deja su propia entrada en el historial SIN tocar el hash:
     así se distingue de un cambio de pantalla (de eso ya se encarga
     `hashchange`) y «atrás» solo cierra la capa de arriba. */
  var capas = [];
  var cerrandoDesdeHistorial = false;
  var ultimoHash = location.hash;

  /* Volver al inicio es una acción explícita: restablece el catálogo aun
     cuando el hash ya sea #consultar. Se cierran las capas sin retroceder
     de forma asíncrona a una ruta anterior. */
  NV.volverAlInicio = function () {
    var pendientes = capas.splice(0);
    for (var i = pendientes.length - 1; i >= 0; i--) {
      try { pendientes[i].cerrar(); } catch (e) { console.error('[nueva] inicio:', e); }
    }
    if (NV.volverAlCatalogo) NV.volverAlCatalogo();
    if (history.state && history.state.nvCapa) {
      history.replaceState(null, '', location.href);
    }
    NV.ir('consultar');
    $('nvTitulo').focus({ preventScroll: true });
  };

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var enlace = e.target.closest('[data-inicio], [data-ir="consultar"]');
    if (!enlace) return;
    e.preventDefault();
    NV.volverAlInicio();
  });

  NV.abrirCapa = function (nombre, cerrar) {
    capas.push({ nombre: nombre, cerrar: cerrar });
    history.pushState({ nvCapa: capas.length }, '', location.href);
  };

  /* La cerró el cliente (la X, un clic fuera, Escape): se retira su
     entrada del historial para que «atrás» no tenga que darse dos veces. */
  NV.cerrarCapa = function (nombre) {
    for (var i = capas.length - 1; i >= 0; i--) {
      if (capas[i].nombre === nombre) {
        capas.splice(i, 1);
        cerrandoDesdeHistorial = true;
        history.back();
        return;
      }
    }
  };

  /* «Cambiar consulta» retira la consulta y un posible resultado abierto
     en un solo paso, para que Atrás no recorra capas ya cerradas. */
  NV.cerrarDesdeCapa = function (nombre) {
    for (var i = capas.length - 1; i >= 0; i--) {
      if (capas[i].nombre === nombre) {
        var pasos = capas.length - i;
        capas.splice(i, pasos);
        /* Si ya se visitó otra pantalla, la entrada activa no es una
           capa. No retroceder hasta una ruta anterior. */
        if (!history.state || !history.state.nvCapa) return;
        cerrandoDesdeHistorial = true;
        history.go(-pasos);
        return;
      }
    }
  };

  window.addEventListener('popstate', function () {
    var cambioDePantalla = location.hash !== ultimoHash;
    ultimoHash = location.hash;
    if (cambioDePantalla) return;
    if (cerrandoDesdeHistorial) { cerrandoDesdeHistorial = false; return; }
    var capa = capas.pop();
    if (capa) { try { capa.cerrar(); } catch (e) { console.error('[nueva] capa:', e); } }
  });


  /* ── Acceso ───────────────────────────────────────────────── */

  var MENSAJES = [
    [/invalid login credentials/i, 'El correo o la contraseña no son correctos.'],
    [/email not confirmed/i, 'Tu cuenta aún no está activada. Abre el correo que te mandamos y pulsa «Activa tu cuenta».'],
    [/captcha/i, 'No se pudo comprobar que no eres un robot. Vuelve a intentarlo.'],
    [/rate limit|too many/i, 'Demasiados intentos seguidos. Espera un minuto.'],
    [/network|fetch/i, 'Sin conexión. Revisa tu internet e inténtalo otra vez.']
  ];
  function traducir(msg) {
    if (/captcha/i.test(msg || '') && C.Turnstile && C.Turnstile.LOCAL_TEST_MODE) {
      return 'La verificación local pasó, pero Supabase exige un CAPTCHA validado por el servidor. Para usar el Supabase remoto desde localhost, autoriza localhost en la clave real de Turnstile; la clave de prueba requiere un Supabase de desarrollo con su clave secreta de prueba.';
    }
    for (var i = 0; i < MENSAJES.length; i++) if (MENSAJES[i][0].test(msg || '')) return MENSAJES[i][1];
    return 'No se pudo entrar. Inténtalo de nuevo.';
  }

  /* `auth-locked` en el body marca que se está en la puerta: el botón de
     instalar y el de WhatsApp lo miran. */
  function enseñarAcceso() {
    $('nvApp').hidden = true;
    $('nvPuerta').hidden = false;
    document.body.classList.add('auth-locked');
    if (NV.verPuerta) { NV.verPuerta(NV.pasoInicial || 'acceso'); return; }
    if (C.Turnstile) C.Turnstile.render('nvTsAcceso');
    var correo = document.querySelector('#nvAcceso [name="email"]');
    if (correo && window.matchMedia('(hover: hover)').matches) correo.focus();
  }
  NV.enseñarAcceso = enseñarAcceso;

  function conectarAcceso() {
    var form = $('nvAcceso');
    if (!form || form.dataset.conectado) return;
    form.dataset.conectado = '1';
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = $('nvAccesoError');
      var btn = $('nvAccesoBtn');
      if (btn.disabled) return;
      var email = (form.email.value || '').trim();
      var pass = form.password.value || '';
      err.hidden = true;
      if (!email || !pass) {
        err.textContent = 'Escribe tu correo y tu contraseña.';
        err.hidden = false;
        return;
      }
      if (!C.EmailValidator.isValidFormat(email)) {
        err.textContent = 'El correo no tiene un formato válido.';
        err.hidden = false;
        return;
      }
      btn.disabled = true;
      btn.innerHTML = '<span class="nv-giro" aria-hidden="true"></span>Entrando…';
      var envioIntentado = false;
      var conservarPantalla = false;
      var mensajeDeError = '';
      try {
        var token = C.Turnstile ? await C.Turnstile.getToken('nvTsAcceso') : null;
        if (!token) throw new Error('captcha verification required');
        envioIntentado = true;
        var res = await C.Auth.signIn(email, pass, !!form.remember.checked, token);
        if (C.Turnstile) C.Turnstile.reset('nvTsAcceso');
        if (res.error) throw res.error;
        form.password.value = '';
        await entrarALaApp();
      } catch (ex) {
        /* Cuenta creada pero sin activar: en vez de un error seco, se le
           reenvía el correo con el botón y se le lleva a la pantalla que
           lo explica. Es el camino que más gente perdía. */
        if (/email not confirmed/i.test((ex && ex.message) || '')) {
          if (NV.pendienteDeActivar) {
            NV.pendienteDeActivar(email);
            conservarPantalla = true;
            if (NV.reenviarActivacion) await NV.reenviarActivacion();
            return;
          }
        }
        if (/captcha/i.test((ex && ex.message) || '') && !envioIntentado && NV.prepararVerificacionAcceso) {
          if (C.Turnstile) C.Turnstile.reset('nvTsAcceso');
          NV.prepararVerificacionAcceso('Completa de nuevo la verificación de seguridad para continuar.', 'acceso');
        } else {
          mensajeDeError = traducir(ex && ex.message);
          err.textContent = mensajeDeError;
          err.hidden = false;
        }
      } finally {
        if (envioIntentado && !NV.usuario && !conservarPantalla && NV.prepararVerificacionAcceso &&
            !(C.Turnstile && C.Turnstile.LOCAL_TEST_MODE)) {
          if (C.Turnstile) C.Turnstile.reset('nvTsAcceso');
          NV.prepararVerificacionAcceso((mensajeDeError ? mensajeDeError + ' ' : '') + 'Verifica de nuevo para intentar iniciar sesión.');
        }
        btn.disabled = false;
        btn.textContent = 'Iniciar sesión';
      }
    });

  }


  /* ── Arranque ─────────────────────────────────────────────── */

  var motorArrancado = false;

  async function entrarALaApp() {
    await NV.cargarPerfil();
    if (!NV.usuario) { enseñarAcceso(); return; }

    /* La puerta ya puede abrirse antes de descargar el generador de PDF.
       Una sesión activa espera a que estén cargados los módulos del panel. */
    if (document.readyState === 'loading') {
      await new Promise(function (resolver) {
        document.addEventListener('DOMContentLoaded', resolver, { once: true });
      });
    }

    $('nvPuerta').hidden = true;
    $('nvApp').hidden = false;
    document.body.classList.remove('auth-locked');
    NV.pintarSaldo();

    NV.pintarIdentidad();
    /* Administración: en el menú lateral, en la barra de arriba (que es
       lo que se ve en el teléfono) y en Mi cuenta. Solo para el rol. */
    document.querySelectorAll('[data-solo-admin]').forEach(function (el) {
      el.hidden = !NV.esAdmin();
    });

    /* El motor de consultas y las pantallas se conectan una sola vez,
       aunque se vuelva a entrar tras una sesión vencida. */
    if (!motorArrancado) {
      motorArrancado = true;
      if (C.initFilterCombo) C.initFilterCombo();
      if (NV.arrancarPantallas) NV.arrancarPantallas();
    }
    mostrar(pantallaDelHash());
  }
  NV.entrarALaApp = entrarALaApp;


  /* ── El menú del avatar ───────────────────────────────────── */
  /* Se abre con el avatar y se cierra al elegir algo, al tocar fuera o
     con Escape. El foco vuelve al avatar al cerrar con teclado. */
  function conectarMenuYo() {
    var boton = $('nvAvatar');
    var menu = $('nvYoMenu');
    if (!boton || !menu || boton.dataset.menuConectado) return;
    boton.dataset.menuConectado = '1';
    function abrir(si) {
      menu.hidden = !si;
      boton.setAttribute('aria-expanded', String(si));
      boton.classList.toggle('es-abierto', si);
    }
    function opciones() {
      return Array.prototype.filter.call(menu.querySelectorAll('[role="menuitem"]'), function (el) {
        return !el.disabled && !el.closest('[hidden]');
      });
    }
    boton.addEventListener('click', function (e) {
      e.stopPropagation();
      abrir(menu.hidden);
      if (!menu.hidden && e.detail === 0) { var items = opciones(); if (items[0]) items[0].focus(); }
    });
    boton.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      abrir(true);
      var items = opciones();
      var destino = e.key === 'ArrowUp' ? items[items.length - 1] : items[0];
      if (destino) destino.focus();
    });
    menu.addEventListener('keydown', function (e) {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) === -1) return;
      var items = opciones();
      if (!items.length) return;
      e.preventDefault();
      var actual = items.indexOf(document.activeElement);
      var siguiente = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 :
        (actual + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[siguiente].focus();
    });
    menu.addEventListener('focusout', function (e) {
      if (!menu.contains(e.relatedTarget) && e.relatedTarget !== boton) abrir(false);
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) abrir(false);
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !menu.contains(e.target) && !boton.contains(e.target)) abrir(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { abrir(false); boton.focus(); }
    });
    window.addEventListener('hashchange', function () { abrir(false); });
  }
  NV.conectarMenuCuenta = conectarMenuYo;

  var accesoIniciado = false;
  function iniciarAcceso() {
    if (accesoIniciado) return;
    accesoIniciado = true;
    conectarAcceso();
    conectarMenuYo();
    entrarALaApp();
    /* Si la sesión se cierra sin pasar por el botón (inactividad, otra
       pestaña, sesión vencida), se vuelve a la puerta en vez de dejar
       la plataforma a la vista sin nadie dentro. */
    if (C.Auth && C.Auth.onAuthChange) {
      C.Auth.onAuthChange(function (evento) {
        if (evento === 'SIGNED_OUT' && !$('nvApp').hidden) {
          NV.usuario = null;
          NV.perfil = null;
          enseñarAcceso();
        }
      });
    }
  }
  document.addEventListener('fv:entry-ready', iniciarAcceso);
  document.addEventListener('DOMContentLoaded', iniciarAcceso);
})();
