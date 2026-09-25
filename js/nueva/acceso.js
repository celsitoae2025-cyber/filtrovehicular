/* ============================================================
   LA PUERTA — crear cuenta, verificar el correo y cambiar la contraseña

   Entrar lo lleva js/nueva/nucleo.js. Aquí vive todo lo demás que pasa
   en la puerta, con las MISMAS llamadas que la plataforma de siempre
   (js/shared/auth.js), así que el alta, los 5 créditos y el código por
   correo funcionan igual:

     acceso → registro → verificar (código de 6 dígitos) → dentro
     acceso → olvido (correo) → restablecer (código + contraseña) → dentro

   Cambiar la contraseña desde «Mi cuenta» usa el mismo camino de
   olvido/restablecer, con la puerta ENCIMA de la aplicación y un botón
   para volver.

   Cada paso que pide el anti-bot (Turnstile) tiene su recuadro y lo
   pinta al enseñarse: el token vence a los 5 minutos y así llega fresco.
============================================================ */
(function () {
  'use strict';
  var C = window.Consultia = window.Consultia || {};
  var NV = C.NV = C.NV || {};

  function $(id) { return document.getElementById(id); }

  /* Qué recuadro anti-bot lleva cada paso. */
  var CAPTCHA = {
    acceso: 'nvTsAcceso',
    registro: 'nvTsRegistro',
    verificar: 'nvTsReenvio',
    olvido: 'nvTsOlvido',
    restablecer: 'nvTsReenvioClave'
  };

  var correoAlta = '';     // a quién se le mandó el código de verificación
  var correoClave = '';    // a quién se le mandó el código de la contraseña
  var encima = false;      // la puerta tapa la aplicación (cambio desde Mi cuenta)

  /* ── Mensajes, en cristiano ─────────────────────────────────── */
  function traducir(msg) {
    var m = String(msg || '').toLowerCase();
    if (!m) return 'Algo salió mal. Inténtalo de nuevo.';
    if (m.indexOf('captcha') !== -1) return 'No se pudo completar la verificación de seguridad. Recarga la página e inténtalo otra vez; si usas un bloqueador de anuncios, desactívalo para este sitio.';
    if (m.indexOf('sending confirmation email') !== -1) return 'No pudimos enviar el correo de verificación. Intenta en unos minutos o escríbenos por WhatsApp.';
    if (m.indexOf('sending recovery email') !== -1) return 'No pudimos enviar el correo con el código. Intenta en unos minutos.';
    if (m.indexOf('email rate limit') !== -1) return 'Se enviaron demasiados correos. Espera unos minutos antes de reintentar.';
    if (m.indexOf('user already registered') !== -1) return 'Este correo ya está registrado. Entra con tu contraseña.';
    if (m.indexOf('password should') !== -1) return 'La contraseña debe tener al menos 8 caracteres.';
    if (m.indexOf('same password') !== -1 || m.indexOf('different from the old') !== -1) return 'La nueva contraseña tiene que ser distinta de la anterior.';
    if (m.indexOf('rate limit') !== -1 || m.indexOf('too many') !== -1) return 'Demasiados intentos. Espera unos minutos.';
    if (m.indexOf('expired') !== -1) return 'El código venció. Pide uno nuevo.';
    if (m.indexOf('invalid') !== -1 || m.indexOf('otp') !== -1 || m.indexOf('token') !== -1) return 'El código es incorrecto o venció. Revísalo o pide uno nuevo.';
    if (m.indexOf('network') !== -1 || m.indexOf('fetch') !== -1) return 'Sin conexión. Revisa tu internet e inténtalo otra vez.';
    if (m.indexOf('signup is disabled') !== -1) return 'Los registros están desactivados por un momento.';
    return msg;
  }

  function error(id, texto) {
    var el = $(id);
    if (!el) return;
    el.textContent = texto || '';
    el.hidden = !texto;
  }

  /* El botón del paso, ocupado mientras se espera la respuesta. */
  function ocupado(boton, si, texto) {
    if (!boton) return;
    if (si) {
      boton.dataset.original = boton.dataset.original || boton.innerHTML;
      boton.disabled = true;
      boton.innerHTML = '<span>' + texto + '</span><i><span class="nv-giro" aria-hidden="true"></span></i>';
    } else {
      boton.disabled = false;
      if (boton.dataset.original) boton.innerHTML = boton.dataset.original;
    }
  }

  async function tokenAntiBot(paso) {
    if (!C.Turnstile) return null;
    try { return await C.Turnstile.getToken(CAPTCHA[paso]); } catch (e) { return null; }
  }
  function quemarToken(paso) {
    if (C.Turnstile) C.Turnstile.reset(CAPTCHA[paso]);
  }

  /* ── Cambiar de paso ────────────────────────────────────────── */
  NV.verPuerta = function (paso) {
    var formularios = document.querySelectorAll('#nvPuerta [data-paso]');
    var existe = false;
    formularios.forEach(function (f) {
      var es = f.dataset.paso === paso;
      f.hidden = !es;
      if (es) existe = true;
    });
    if (!existe) return NV.verPuerta('acceso');

    /* Desde Mi cuenta solo se cambia la contraseña: sin enlaces a
       entrar ni a crear cuenta, y con «Volver a mi cuenta». */
    $('nvPuertaVolver').hidden = !encima;
    document.querySelectorAll('#nvPuerta [data-solo-fuera]').forEach(function (el) { el.hidden = encima; });

    if (C.Turnstile && CAPTCHA[paso]) C.Turnstile.render(CAPTCHA[paso]);
    var puerta = $('nvPuerta');
    if (puerta) puerta.scrollTop = 0;
    window.scrollTo(0, 0);

    var primero = document.querySelector('#nvPuerta [data-paso="' + paso + '"] input:not([readonly]):not([type="checkbox"])');
    if (primero && window.matchMedia('(hover: hover)').matches) primero.focus();
  };

  /* Desde «Mi cuenta»: la puerta sale encima, en el paso de pedir el
     código, con el correo de la cuenta ya puesto. */
  NV.cambiarClave = function () {
    encima = true;
    var puerta = $('nvPuerta');
    puerta.classList.add('es-encima');
    puerta.hidden = false;
    document.body.classList.add('nv-puerta-encima');
    var correo = document.querySelector('#nvOlvido [name="email"]');
    if (correo && NV.usuario) { correo.value = NV.usuario.email || ''; correo.readOnly = true; }
    NV.verPuerta('olvido');
  };

  function cerrarEncima() {
    if (!encima) return;
    encima = false;
    var puerta = $('nvPuerta');
    puerta.classList.remove('es-encima');
    puerta.hidden = true;
    document.body.classList.remove('nv-puerta-encima');
    var correo = document.querySelector('#nvOlvido [name="email"]');
    if (correo) correo.readOnly = false;
  }

  /* ── Crear cuenta ───────────────────────────────────────────── */
  var CLAVE_FUERTE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

  function conectarRegistro() {
    var form = $('nvRegistro');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      error('nvRegistroError', '');
      var nombre = form.full_name.value.trim();
      var correo = form.email.value.trim();
      var telefono = form.phone.value.trim();
      var clave = form.password.value;

      if (!nombre || !correo || !telefono || !clave) {
        return error('nvRegistroError', 'Completa tu nombre, correo, teléfono y contraseña.');
      }
      if (C.EmailValidator) {
        var v = C.EmailValidator.validate(correo);
        if (!v.ok) return error('nvRegistroError', v.error);
      }
      if (!/^[0-9+\s()-]{6,20}$/.test(telefono)) {
        return error('nvRegistroError', 'Escribe un teléfono válido.');
      }
      if (!CLAVE_FUERTE.test(clave)) {
        return error('nvRegistroError', 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.');
      }
      if (!form.terms.checked) {
        return error('nvRegistroError', 'Acepta los términos y condiciones para crear tu cuenta.');
      }

      var boton = $('nvRegistroBtn');
      ocupado(boton, true, 'Creando…');
      try {
        var token = await tokenAntiBot('registro');
        var res = await C.Auth.signUp({
          email: correo, password: clave, full_name: nombre, phone: telefono, captchaToken: token
        });
        quemarToken('registro');
        if (res.error) throw res.error;
        correoAlta = correo;
        $('nvVerificarCorreo').textContent = correo;
        form.reset();
        NV.verPuerta('verificar');
      } catch (ex) {
        error('nvRegistroError', traducir(ex && ex.message));
      } finally {
        ocupado(boton, false);
      }
    });
  }

  /* ── Verificar el correo con el código ─────────────────────── */
  function conectarVerificar() {
    var form = $('nvVerificar');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      error('nvVerificarError', '');
      var codigo = (form.code.value || '').replace(/\D/g, '');
      if (codigo.length !== 6) return error('nvVerificarError', 'El código tiene 6 dígitos.');
      if (!correoAlta) return NV.verPuerta('registro');

      var boton = $('nvVerificarBtn');
      ocupado(boton, true, 'Verificando…');
      try {
        var res = await C.Auth.verifyOtp(correoAlta, codigo);
        if (res.error) throw res.error;
        form.reset();
        if (C.toast) C.toast({ type: 'success', title: '¡Cuenta verificada!', message: 'Bienvenido a Filtro Vehicular+' });
        await NV.entrarALaApp();
      } catch (ex) {
        error('nvVerificarError', traducir(ex && ex.message));
      } finally {
        ocupado(boton, false);
      }
    });

    $('nvReenviarAlta').addEventListener('click', async function (e) {
      e.preventDefault();
      if (!correoAlta) return NV.verPuerta('registro');
      error('nvVerificarError', '');
      try {
        var token = await tokenAntiBot('verificar');
        var res = await C.Auth.resendVerification(correoAlta, token);
        quemarToken('verificar');
        if (res && res.error) throw res.error;
        if (C.toast) C.toast({ type: 'success', title: 'Código reenviado', message: 'Revisa tu correo (y la carpeta de spam).' });
      } catch (ex) {
        error('nvVerificarError', traducir(ex && ex.message));
      }
    });
  }

  /* ── Pedir el código para cambiar la contraseña ────────────── */
  async function pedirCodigoClave(correo, paso) {
    var token = await tokenAntiBot(paso);
    var res = await C.Auth.requestPasswordReset(correo, token);
    quemarToken(paso);
    /* Si el correo no existe no se dice: sería decirle a cualquiera qué
       correos tienen cuenta. Solo se frena si hay demasiados intentos o
       falló el anti-bot. */
    if (res && res.error) {
      var m = String(res.error.message || '').toLowerCase();
      if (m.indexOf('rate') !== -1 || m.indexOf('captcha') !== -1) throw res.error;
      console.warn('[acceso] pedir código:', res.error);
    }
  }

  function conectarOlvido() {
    var form = $('nvOlvido');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      error('nvOlvidoError', '');
      var correo = form.email.value.trim();
      if (!correo) return error('nvOlvidoError', 'Escribe tu correo.');

      var boton = $('nvOlvidoBtn');
      ocupado(boton, true, 'Enviando…');
      try {
        await pedirCodigoClave(correo, 'olvido');
        correoClave = correo;
        $('nvRestablecerCorreo').textContent = correo;
        NV.verPuerta('restablecer');
      } catch (ex) {
        error('nvOlvidoError', traducir(ex && ex.message));
      } finally {
        ocupado(boton, false);
      }
    });
  }

  /* ── Poner la contraseña nueva ──────────────────────────────── */
  function conectarRestablecer() {
    var form = $('nvRestablecer');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      error('nvRestablecerError', '');
      var codigo = (form.code.value || '').replace(/\D/g, '');
      var clave = form.password.value;
      if (codigo.length !== 6) return error('nvRestablecerError', 'El código tiene 6 dígitos.');
      if (!clave || clave.length < 8) return error('nvRestablecerError', 'La contraseña debe tener al menos 8 caracteres.');
      if (clave !== form.password2.value) return error('nvRestablecerError', 'Las dos contraseñas no coinciden.');
      if (!correoClave) return NV.verPuerta('olvido');

      var boton = $('nvRestablecerBtn');
      ocupado(boton, true, 'Guardando…');
      try {
        /* El código abre una sesión de recuperación y con ella se
           cambia la contraseña. Con esa sesión ya se está dentro. */
        var ver = await C.Auth.verifyResetOtp(correoClave, codigo);
        if (ver && ver.error) throw ver.error;
        var upd = await C.Auth.updatePassword(clave);
        if (upd && upd.error) throw upd.error;
        form.reset();
        if (C.toast) C.toast({ type: 'success', title: 'Contraseña actualizada', message: 'Ya puedes usarla para entrar.' });
        if (encima) cerrarEncima();
        else await NV.entrarALaApp();
      } catch (ex) {
        error('nvRestablecerError', traducir(ex && ex.message));
      } finally {
        ocupado(boton, false);
      }
    });

    $('nvReenviarClave').addEventListener('click', async function (e) {
      e.preventDefault();
      if (!correoClave) return NV.verPuerta('olvido');
      error('nvRestablecerError', '');
      try {
        await pedirCodigoClave(correoClave, 'restablecer');
        if (C.toast) C.toast({ type: 'success', title: 'Código reenviado', message: 'Revisa tu correo (y la carpeta de spam).' });
      } catch (ex) {
        error('nvRestablecerError', traducir(ex && ex.message));
      }
    });
  }

  /* ── El código: solo números, seis como mucho ──────────────── */
  function soloDigitos() {
    document.querySelectorAll('#nvPuerta .nv-codigo').forEach(function (c) {
      c.addEventListener('input', function () {
        var limpio = c.value.replace(/\D/g, '').slice(0, 6);
        if (limpio !== c.value) c.value = limpio;
      });
    });
  }

  /* ── Filtro Vehicular Completo ────────────────────────────────
     El reporte completo lo emite un operador y se pide sin cuenta: la
     ventana enseña qué incluye y el precio, y el mensaje sale a WhatsApp
     con la placa ya escrita. Misma ventana y mismos estilos
     (css/oferta.css) que tenía el acceso de siempre. */
  var FVC_INCLUYE = [
    'Propietarios e historial registral (Sunarp)',
    'Papeletas de tránsito, ATU y multirregión',
    'SOAT y revisión técnica vigentes',
    'Denuncias, requisitorias y orden de captura'
  ];
  var VISTO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.8 12.4 4.8 4.8L19.2 6.8"/></svg>';
  var CERRAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var fvcAbridor = null;

  function placaLimpia(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }

  function cerrarFvc() {
    var modal = $('fvcModal');
    if (!modal) return;
    document.removeEventListener('keydown', teclaFvc);
    modal.classList.remove('is-abierto');
    setTimeout(function () { if (modal.parentNode) modal.remove(); }, 200);
    if (fvcAbridor && fvcAbridor.focus) fvcAbridor.focus();
  }
  function teclaFvc(e) { if (e.key === 'Escape') { e.preventDefault(); cerrarFvc(); } }

  function abrirFvc(desde) {
    if ($('fvcModal')) return;
    fvcAbridor = desde || null;
    var sello = desde ? desde.querySelector('svg').outerHTML : '';
    document.body.insertAdjacentHTML('beforeend',
      '<div class="fvc-modal" id="fvcModal" role="dialog" aria-modal="true" aria-labelledby="fvcModalTitulo">' +
        '<div class="fvc-modal-fondo" data-fvc-cerrar></div>' +
        '<div class="fvc-modal-caja" role="document">' +
          '<button type="button" class="fvc-cerrar" aria-label="Cerrar" data-fvc-cerrar>' + CERRAR + '</button>' +
          '<header class="fvc-cabecera">' +
            '<span class="fvc-sello">' + sello + '</span>' +
            '<div class="fvc-cabecera-txt">' +
              '<h2 class="fvc-titulo" id="fvcModalTitulo">Filtro Vehicular Completo</h2>' +
              '<p class="fvc-bajada">Un solo PDF con todo el historial del vehículo.</p>' +
            '</div>' +
          '</header>' +
          '<div class="fvc-precio">' +
            '<strong class="fvc-ahora">S/ 15</strong>' +
            '<s class="fvc-antes"><span class="visually-hidden">Antes </span>S/ 30</s>' +
            '<span class="fvc-promo">Promoción por tiempo limitado</span>' +
          '</div>' +
          '<div class="fvc-incluye">' +
            '<h3 class="fvc-sub">Qué incluye</h3>' +
            '<ul class="fvc-lista">' + FVC_INCLUYE.map(function (t) {
              return '<li><span class="fvc-visto">' + VISTO + '</span><span>' + t + '</span></li>';
            }).join('') + '</ul>' +
          '</div>' +
          '<div class="fvc-accion">' +
            '<label class="fvc-label" for="fvcPlaca">Placa del vehículo</label>' +
            '<input class="fvc-input" id="fvcPlaca" type="text" autocomplete="off" spellcheck="false" maxlength="6" placeholder="ABC123" aria-describedby="fvcMsg">' +
            '<p class="fvc-msg" id="fvcMsg" role="alert" hidden></p>' +
            '<button type="button" class="fvc-enviar" id="fvcSend">Solicitar por WhatsApp</button>' +
            '<p class="fvc-pie">Te lo enviamos por WhatsApp. No necesitas crear una cuenta.</p>' +
          '</div>' +
        '</div>' +
      '</div>');

    var modal = $('fvcModal');
    var input = $('fvcPlaca');
    var aviso = $('fvcMsg');
    function mensaje(t) { aviso.textContent = t || ''; aviso.hidden = !t; }

    modal.querySelectorAll('[data-fvc-cerrar]').forEach(function (b) { b.addEventListener('click', cerrarFvc); });
    document.addEventListener('keydown', teclaFvc);
    input.addEventListener('input', function () { input.value = placaLimpia(input.value); mensaje(''); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('fvcSend').click(); } });
    $('fvcSend').addEventListener('click', function () {
      var placa = placaLimpia(input.value);
      input.value = placa;
      if (!/^[A-Z0-9]{6}$/.test(placa)) { mensaje('Escribe la placa completa, por ejemplo ABC123.'); input.focus(); return; }
      window.open(NV.whatsapp('Hola, quiero solicitar el Filtro Vehicular Completo de la placa ' + placa + '.'), '_blank', 'noopener');
      cerrarFvc();
    });
    requestAnimationFrame(function () {
      modal.classList.add('is-abierto');
      setTimeout(function () { input.focus({ preventScroll: true }); }, 140);
    });
  }

  /* ── Lo que pide la dirección al llegar ─────────────────────── */
  /* ?action=signup (landing, anuncios) abre «Crear cuenta»; los enlaces
     viejos de recuperación abren «Cambiar contraseña». Se limpia la
     dirección para que al recargar no vuelva a abrirse. */
  function pasoDeLaDireccion() {
    var p = new URLSearchParams(location.search);
    var h = location.hash || '';
    var paso = null;
    if (p.get('action') === 'signup' || p.get('action') === 'register') paso = 'registro';
    else if (p.get('action') === 'login') paso = 'acceso';
    else if (p.get('recovery') === '1' || p.get('token_hash') || h.indexOf('type=recovery') !== -1) paso = 'olvido';
    if (paso && history.replaceState) {
      p.delete('action'); p.delete('recovery'); p.delete('token_hash'); p.delete('type');
      var q = p.toString();
      var hashLimpio = h.indexOf('type=recovery') !== -1 || h.indexOf('access_token') !== -1 ? '' : h;
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + hashLimpio);
    }
    return paso;
  }

  document.addEventListener('DOMContentLoaded', function () {
    NV.pasoInicial = pasoDeLaDireccion() || 'acceso';

    document.getElementById('nvPuerta').addEventListener('click', function (e) {
      var a = e.target.closest('[data-paso-ir]');
      if (!a) return;
      e.preventDefault();
      NV.verPuerta(a.dataset.pasoIr);
    });
    $('nvPuertaVolver').addEventListener('click', cerrarEncima);
    $('fvcOpen').addEventListener('click', function () { abrirFvc(this); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && encima && !document.querySelector('.modal:not([hidden])')) cerrarEncima();
    });

    conectarRegistro();
    conectarVerificar();
    conectarOlvido();
    conectarRestablecer();
    soloDigitos();

    /* Términos, cookies y recibo: los modales de siempre. Se conectan
       aquí porque la puerta ya los enlaza antes de entrar. */
    if (C.initOverlays) C.initOverlays();
    /* Soporte por WhatsApp (también en la puerta: es por donde pregunta
       quien no sabe registrarse) y el aviso de pago acreditado. */
    if (C.initWhatsappSupport) C.initWhatsappSupport();
    if (C.PaymentWatcher) C.PaymentWatcher.init();
  });
})();
