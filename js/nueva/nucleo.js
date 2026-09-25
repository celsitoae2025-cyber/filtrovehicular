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
    filter:     'Consulta vehicular',
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
  NV.ORDEN = ['filter', 'vehiculos', 'reniec', 'sunarp', 'telefonia', 'familiares', 'financiero', 'delitos', 'extras'];

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

  NV.pintarSaldo = function () {
    var ilimitado = NV.esAdmin();
    var n = NV.perfil ? NV.perfil.credits_balance : null;
    document.querySelectorAll('[data-saldo]').forEach(function (el) {
      el.textContent = ilimitado ? 'Ilimitado' : (n == null ? '—' : NV.numero(n));
    });
    document.querySelectorAll('[data-saldo-uni]').forEach(function (el) {
      el.hidden = ilimitado;
    });
  };

  NV.refrescarSaldo = async function () {
    await NV.cargarPerfil();
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
    cuenta:    { titulo: 'Mi cuenta' },
    regiones:  { titulo: 'Infracciones por regiones' }
  };

  /* Los enlaces de siempre (#saldo en los mensajes del bot, #dashboard,
     #compras…) siguen llevando a su sitio en esta plataforma. */
  var ALIAS = {
    dashboard: 'resumen', saldo: 'pagos', compras: 'pagos', filter: 'consultar',
    consultas: 'consultar', configuracion: 'cuenta', notificaciones: 'resumen'
  };

  NV.alEntrar = {};   // nombre -> función que pinta la pantalla al abrirla

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
    document.title = p.titulo + ' · Filtro Vehicular+';
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
    [/email not confirmed/i, 'Tu correo todavía no está confirmado. Revisa tu bandeja de entrada.'],
    [/captcha/i, 'No se pudo comprobar que no eres un robot. Vuelve a intentarlo.'],
    [/rate limit|too many/i, 'Demasiados intentos seguidos. Espera un minuto.'],
    [/network|fetch/i, 'Sin conexión. Revisa tu internet e inténtalo otra vez.']
  ];
  function traducir(msg) {
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
      var email = (form.email.value || '').trim();
      var pass = form.password.value || '';
      err.hidden = true;
      if (!email || !pass) {
        err.textContent = 'Escribe tu correo y tu contraseña.';
        err.hidden = false;
        return;
      }
      btn.disabled = true;
      btn.innerHTML = '<span class="nv-giro" aria-hidden="true"></span>Entrando…';
      try {
        var token = C.Turnstile ? await C.Turnstile.getToken('nvTsAcceso') : null;
        var res = await C.Auth.signIn(email, pass, !!form.remember.checked, token);
        if (C.Turnstile) C.Turnstile.reset('nvTsAcceso');
        if (res.error) throw res.error;
        form.password.value = '';
        await entrarALaApp();
      } catch (ex) {
        err.textContent = traducir(ex && ex.message);
        err.hidden = false;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar';
      }
    });
  }


  /* ── Arranque ─────────────────────────────────────────────── */

  var motorArrancado = false;

  async function entrarALaApp() {
    await NV.cargarPerfil();
    if (!NV.usuario) { enseñarAcceso(); return; }

    $('nvPuerta').hidden = true;
    $('nvApp').hidden = false;
    document.body.classList.remove('auth-locked');
    NV.pintarSaldo();

    var nombre = (NV.perfil && NV.perfil.full_name) || NV.usuario.email || '';
    var iniciales = nombre.split(/[\s@.]+/).filter(Boolean).slice(0, 2)
      .map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || '·';
    $('nvAvatar').textContent = iniciales;
    $('nvYoNombre').textContent = (NV.perfil && NV.perfil.full_name) || 'Mi cuenta';
    $('nvYoCorreo').textContent = NV.usuario.email || '';
    var grande = $('nvAvatarGrande');
    if (grande) grande.textContent = iniciales;
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
    if (!boton || !menu) return;
    function abrir(si) {
      menu.hidden = !si;
      boton.setAttribute('aria-expanded', String(si));
      boton.classList.toggle('es-abierto', si);
    }
    boton.addEventListener('click', function (e) {
      e.stopPropagation();
      abrir(menu.hidden);
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) abrir(false);
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !menu.contains(e.target) && e.target !== boton) abrir(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { abrir(false); boton.focus(); }
    });
    window.addEventListener('hashchange', function () { abrir(false); });
  }

  document.addEventListener('DOMContentLoaded', function () {
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
  });
})();
