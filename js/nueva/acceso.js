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

  var accesoVerificado = false;
  var pasoTrasVerificacion = 'acceso';
  var verificacionAvanzando = false;

  function estadoVerificacion(texto) {
    var estado = $('nvAccesoVerificacionEstado');
    if (estado && texto) estado.textContent = texto;
  }

  function actualizarPestanas(paso, visible) {
    var tabs = $('nvPuertaTabs');
    if (!tabs) return;
    tabs.hidden = !visible;
    tabs.querySelectorAll('[role="tab"]').forEach(function (tab) {
      var activo = visible && tab.dataset.pasoIr === paso;
      tab.setAttribute('aria-selected', String(activo));
      tab.tabIndex = activo ? 0 : -1;
    });
  }

  function prepararVerificacionAcceso(mensaje, destino) {
    pasoTrasVerificacion = destino === 'registro' ? 'registro' : 'acceso';
    accesoVerificado = false;
    NV.accesoVerificado = false;
    verificacionAvanzando = false;
    var verificacion = $('nvAccesoVerificacion');
    var credenciales = $('nvAccesoCredenciales');
    var reintentar = $('nvAccesoReintentar');
    if (!verificacion || !credenciales) return;
    document.querySelectorAll('#nvPuerta [data-paso]').forEach(function (formulario) {
      formulario.hidden = formulario.dataset.paso !== 'acceso';
    });
    verificacion.hidden = false;
    credenciales.hidden = true;
    if (reintentar) reintentar.hidden = true;
    actualizarPestanas('acceso', false);
    var puerta = $('nvPuerta');
    puerta.dataset.pasoActivo = 'acceso';
    puerta.classList.remove('es-acceso-limpio');
    puerta.classList.remove('es-cuenta-ayuda');
    puerta.classList.add('es-verificacion');
    estadoVerificacion(mensaje || 'Completa la verificación para continuar.');
  }

  function habilitarCredenciales() {
    if (verificacionAvanzando || accesoVerificado) return;
    if (!C.Turnstile || !C.Turnstile.getToken) {
      estadoVerificacion('No se pudo cargar la verificación. Revisa tu conexión e inténtalo otra vez.');
      return;
    }
    verificacionAvanzando = true;
    C.Turnstile.getToken('nvTsAcceso').then(function (token) {
      if (!token) {
        verificacionAvanzando = false;
        prepararVerificacionAcceso('No pudimos completar la verificación. Inténtalo otra vez.', pasoTrasVerificacion);
        return;
      }
      accesoVerificado = true;
      NV.accesoVerificado = true;
      verificacionAvanzando = false;
      var siguiente = pasoTrasVerificacion;
      pasoTrasVerificacion = 'acceso';
      $('nvPuerta').classList.remove('es-verificacion');
      if (siguiente === 'registro' && !encima) {
        NV.verPuerta('registro');
      } else {
        $('nvAccesoVerificacion').hidden = true;
        $('nvAccesoCredenciales').hidden = false;
        $('nvPuerta').classList.add('es-acceso-limpio');
        actualizarPestanas('acceso', !encima);
        var correo = document.querySelector('#nvAcceso [name="email"]');
        if (correo && window.matchMedia('(hover: hover)').matches) correo.focus();
      }
    }).catch(function () {
      verificacionAvanzando = false;
      prepararVerificacionAcceso('No pudimos completar la verificación. Inténtalo otra vez.', pasoTrasVerificacion);
    });
  }

  document.addEventListener('consultia:turnstile-verified', function (e) {
    if (!e.detail || e.detail.containerId !== 'nvTsAcceso' || accesoVerificado || verificacionAvanzando) return;
    var reintentar = $('nvAccesoReintentar');
    if (reintentar) reintentar.hidden = true;
    estadoVerificacion('Verificación completada. Abriendo el acceso…');
    habilitarCredenciales();
  });
  document.addEventListener('consultia:turnstile-error', function (e) {
    if (!e.detail || e.detail.containerId !== 'nvTsAcceso') return;
    estadoVerificacion('No se pudo completar la verificación. Revisa tu conexión e inténtalo otra vez.');
    var reintentar = $('nvAccesoReintentar');
    if (reintentar) reintentar.hidden = false;
  });
  document.addEventListener('consultia:turnstile-script-error', function () {
    estadoVerificacion('No se pudo cargar la verificación. Revisa tu conexión e inténtalo otra vez.');
    var reintentar = $('nvAccesoReintentar');
    if (reintentar) reintentar.hidden = false;
  });
  document.addEventListener('consultia:turnstile-expired', function (e) {
    if (!e.detail || e.detail.containerId !== 'nvTsAcceso') return;
    var pasoActual = $('nvRegistro') && !$('nvRegistro').hidden ? 'registro' : 'acceso';
    if (accesoVerificado) prepararVerificacionAcceso('La verificación venció. Confirma de nuevo para continuar.', pasoActual);
    else estadoVerificacion('La verificación venció. Confirma de nuevo para continuar.');
  });
  NV.prepararVerificacionAcceso = prepararVerificacionAcceso;

  /* La verificación de entrada habilita el acceso y el registro. */
  var CAPTCHA = {
    acceso: 'nvTsAcceso',
    verificar: 'nvTsReenvio',
    olvido: 'nvTsOlvido',
    restablecer: 'nvTsReenvioClave'
  };

  var correoAlta = '';     // a quién se le mandó el código de verificación
  var correoClave = '';    // a quién se le mandó el código de la contraseña
  var encima = false;      // la puerta tapa la aplicación (cambio desde Mi cuenta)
  var reenvios = [];

  function refrescarReenvios() {
    reenvios.forEach(function (refrescar) { refrescar(); });
  }

  /* ── Mensajes, en cristiano ─────────────────────────────────── */
  function traducir(msg) {
    var m = String(msg || '').toLowerCase();
    if (!m) return 'Algo salió mal. Inténtalo de nuevo.';
    if (m.indexOf('captcha') !== -1 && C.Turnstile && C.Turnstile.LOCAL_TEST_MODE) return 'La verificación local pasó, pero Supabase exige un CAPTCHA validado por el servidor. Para usar el Supabase remoto desde localhost, autoriza localhost en la clave real de Turnstile; la clave de prueba requiere un Supabase de desarrollo con su clave secreta de prueba.';
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
    boton.setAttribute('aria-busy', String(si));
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

  function configurarReenvio(id, errorId, destinatario, enviar, aviso) {
    var boton = $(id);
    var textoOriginal = boton.textContent;
    var control = C.AuthForm.createResendGate(30000);
    var reloj = null;
    function refrescar() {
      var estado = control.state(destinatario());
      boton.disabled = estado.busy || estado.remaining > 0;
      boton.setAttribute('aria-busy', String(estado.busy));
      boton.textContent = estado.busy ? 'Enviando…' : estado.remaining ? 'Reenviar en ' + estado.remaining + ' s' : textoOriginal;
      if (estado.remaining && !reloj) reloj = setInterval(refrescar, 1000);
      if (!estado.remaining && reloj) { clearInterval(reloj); reloj = null; }
    }
    reenvios.push(refrescar);
    return async function () {
      var correo = destinatario();
      var estado = control.state(correo);
      if (!correo || estado.busy || estado.remaining) return false;
      error(errorId, '');
      var pendiente = control.run(correo, function () { return enviar(correo); });
      refrescar();
      try {
        var enviado = await pendiente;
        if (enviado && C.toast) C.toast(aviso);
        return enviado;
      } catch (ex) {
        error(errorId, traducir(ex && ex.message));
        return false;
      } finally {
        refrescar();
      }
    };
  }

  /* ── Cambiar de paso ────────────────────────────────────────── */
  NV.verPuerta = function (paso) {
    var pasoAnterior = $('nvPuerta').dataset.pasoActivo;
    if ((paso === 'acceso' || paso === 'registro') && !accesoVerificado) {
      pasoTrasVerificacion = paso;
      paso = 'acceso';
    }
    var formularios = document.querySelectorAll('#nvPuerta [data-paso]');
    var existe = false;
    formularios.forEach(function (f) {
      var es = f.dataset.paso === paso;
      f.hidden = !es;
      if (es) {
        existe = true;
        if (pasoAnterior !== paso) {
          f.querySelectorAll('.nv-error').forEach(function (aviso) { aviso.hidden = true; aviso.textContent = ''; });
        }
      }
    });
    if (!existe) return NV.verPuerta('acceso');

    var puerta = $('nvPuerta');
    if (puerta) puerta.dataset.pasoActivo = paso;
    puerta.classList.toggle('es-cuenta-ayuda', !encima && ['verificar', 'olvido', 'restablecer'].indexOf(paso) !== -1);
    if (paso !== 'acceso' || accesoVerificado) puerta.classList.remove('es-verificacion');
    if (paso === 'acceso') {
      if (!accesoVerificado) prepararVerificacionAcceso(undefined, pasoTrasVerificacion);
      else {
        $('nvAccesoVerificacion').hidden = true;
        $('nvAccesoCredenciales').hidden = false;
        puerta.classList.add('es-acceso-limpio');
      }
    } else {
      if (paso === 'registro') puerta.classList.add('es-acceso-limpio');
      else puerta.classList.remove('es-acceso-limpio');
    }

    /* Desde Mi cuenta solo se cambia la contraseña: sin enlaces a
       entrar ni a crear cuenta, y con «Volver a mi cuenta». */
    $('nvPuertaVolver').hidden = !encima;
    document.querySelectorAll('#nvPuerta [data-solo-fuera]').forEach(function (el) { el.hidden = encima; });

    var mostrarTabs = !encima && accesoVerificado && (paso === 'registro' || paso === 'acceso');
    actualizarPestanas(paso, mostrarTabs);
    if (C.Turnstile && CAPTCHA[paso] && (paso !== 'acceso' || !accesoVerificado)) C.Turnstile.render(CAPTCHA[paso]);
    if (puerta) {
      puerta.scrollTop = 0;
      puerta.querySelector('.nv-auth-contenido').scrollTop = 0;
    }
    window.scrollTo(0, 0);
    refrescarReenvios();

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
  function conectarRegistro() {
    var form = $('nvRegistro');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if ($('nvRegistroBtn').disabled) return;
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
      telefono = C.AuthForm.normalizePhone(telefono);
      if (!telefono) {
        return error('nvRegistroError', 'Escribe un teléfono válido.');
      }
      if (!C.AuthForm.isStrongPassword(clave)) {
        return error('nvRegistroError', C.AuthForm.passwordMessage);
      }
      if (!form.terms.checked) {
        return error('nvRegistroError', 'Acepta los términos y condiciones para crear tu cuenta.');
      }

      var boton = $('nvRegistroBtn');
      ocupado(boton, true, 'Creando…');
      try {
        var token = await tokenAntiBot('acceso');
        if (!token) {
          NV.prepararVerificacionAcceso('Completa la verificación de seguridad para crear tu cuenta.', 'registro');
          return;
        }
        var res = await C.Auth.signUp({
          email: correo, password: clave, full_name: nombre, phone: telefono, captchaToken: token
        });
        quemarToken('acceso');
        if (res.error) throw res.error;
        accesoVerificado = false;
        NV.accesoVerificado = false;
        correoAlta = correo;
        $('nvVerificarCorreo').textContent = correo;
        form.reset();
        NV.verPuerta('verificar');
      } catch (ex) {
        if (/captcha/i.test((ex && ex.message) || '')) {
          if (C.Turnstile && C.Turnstile.LOCAL_TEST_MODE) {
            error('nvRegistroError', traducir(ex && ex.message));
          } else {
            quemarToken('acceso');
            NV.prepararVerificacionAcceso('La verificación venció. Completa el control otra vez para crear tu cuenta.', 'registro');
          }
        } else {
          error('nvRegistroError', traducir(ex && ex.message));
        }
      } finally {
        ocupado(boton, false);
      }
    });
  }

  /* ── Activar la cuenta ─────────────────────────────────────
     Ya no se escribe ningún código: el correo trae un botón «Activa tu
     cuenta» que lleva a Supabase, verifica y devuelve al cliente aquí
     con la sesión puesta (detectSessionInUrl la recoge sola). Esta
     pantalla solo espera, avisa de dónde mirar y permite reenviar.
     Los códigos de 6 dígitos siguen vivos SOLO para recuperar la
     contraseña. */
  /* Lo usa el acceso: si alguien intenta entrar con una cuenta que
     todavía no activó, se le trae aquí con su correo ya puesto y se le
     reenvía el botón sin que tenga que buscar nada. */
  NV.pendienteDeActivar = function (correo) {
    correoAlta = correo || '';
    var et = $('nvVerificarCorreo');
    if (et) et.textContent = correoAlta || 'tu correo';
    NV.verPuerta('verificar');
  };

  function conectarVerificar() {
    NV.reenviarActivacion = configurarReenvio('nvReenviarAlta', 'nvVerificarError', function () { return correoAlta; }, async function (correo) {
      var token = await tokenAntiBot('verificar');
      if (!token) throw new Error('Completa la verificación de seguridad para reenviar el correo.');
      var res;
      try { res = await C.Auth.resendVerification(correo, token); }
      finally { quemarToken('verificar'); }
      if (res && res.error) throw res.error;
    }, { type: 'success', title: 'Correo reenviado', message: 'Ábrelo y pulsa «Activa tu cuenta» (mira también en spam).' });
    $('nvReenviarAlta').addEventListener('click', async function (e) {
      e.preventDefault();
      if (!correoAlta) return NV.verPuerta('registro');
      await NV.reenviarActivacion();
    });
  }

  /* ── Pedir el código para cambiar la contraseña ────────────── */
  async function pedirCodigoClave(correo, paso) {
    var token = await tokenAntiBot(paso);
    if (!token) throw new Error('Completa la verificación de seguridad para continuar.');
    var res;
    try { res = await C.Auth.requestPasswordReset(correo, token); }
    finally { quemarToken(paso); }
    // Solo se oculta la inexistencia de la cuenta, nunca un fallo de envío.
    if (res && res.error) {
      if (res.error.code === 'user_not_found' || /^user not found\.?$/i.test(res.error.message || '')) return;
      throw res.error;
    }
  }

  function conectarOlvido() {
    var form = $('nvOlvido');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if ($('nvOlvidoBtn').disabled) return;
      error('nvOlvidoError', '');
      var correo = form.email.value.trim();
      if (!correo) return error('nvOlvidoError', 'Escribe tu correo.');
      if (!C.EmailValidator.isValidFormat(correo)) return error('nvOlvidoError', 'El correo no tiene un formato válido.');

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
      if ($('nvRestablecerBtn').disabled) return;
      error('nvRestablecerError', '');
      var codigo = (form.code.value || '').replace(/\D/g, '');
      var clave = form.password.value;
      if (codigo.length !== 6) return error('nvRestablecerError', 'El código tiene 6 dígitos.');
      if (!C.AuthForm.isStrongPassword(clave)) return error('nvRestablecerError', C.AuthForm.passwordMessage);
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

    var reenviarClave = configurarReenvio('nvReenviarClave', 'nvRestablecerError', function () { return correoClave; }, function (correo) {
      return pedirCodigoClave(correo, 'restablecer');
    }, { type: 'success', title: 'Solicitud enviada', message: 'Si el correo está registrado, recibirás un nuevo código. Revisa también spam.' });
    $('nvReenviarClave').addEventListener('click', async function (e) {
      e.preventDefault();
      if (!correoClave) return NV.verPuerta('olvido');
      await reenviarClave();
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

  /* ── Lo que pide la dirección al llegar ─────────────────────── */
  /* ?action=signup (landing, anuncios) abre «Crear cuenta»; los enlaces
     viejos de recuperación abren «Cambiar contraseña». Se limpia la
     dirección para que al recargar no vuelva a abrirse. */
  function pasoDeLaDireccion() {
    var p = new URLSearchParams(location.search);
    var h = location.hash || '';
    var paso = null;

    /* El botón «Activa tu cuenta» es de un solo uso. Si el antivirus del
       correo lo abre antes que el cliente, o si pasan las horas, Supabase
       devuelve aquí con un error en el hash. Sin esto la pantalla se
       quedaba muda y el cliente creía que la plataforma estaba rota. */
    if (h.indexOf('error_code=') !== -1 || h.indexOf('error=') !== -1) {
      var caducado = h.indexOf('otp_expired') !== -1 || h.indexOf('access_denied') !== -1;
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
      setTimeout(function () {
        error('nvAccesoError', caducado
          ? 'Ese enlace de activación ya se usó o caducó. Entra con tu correo y contraseña: si la cuenta sigue sin activar, te mandamos otro al momento.'
          : 'No se pudo completar la activación. Entra con tu correo y contraseña e inténtalo otra vez.');
      }, 0);
      return 'acceso';
    }
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

  var puertaIniciada = false;
  function iniciarPuerta() {
    if (puertaIniciada) return;
    puertaIniciada = true;
    NV.pasoInicial = pasoDeLaDireccion() || 'acceso';

    // Algunos teclados reducen solo la parte visible del navegador.
    var vista = window.visualViewport;
    if (vista) {
      var contenido = document.querySelector('#nvAuthShell .nv-auth-contenido');
      function ajustarAlturaVisible() {
        if (vista.scale !== 1 || vista.height >= document.documentElement.clientHeight) {
          document.body.style.removeProperty('--acceso-alto-visible');
          return;
        }
        document.body.style.setProperty('--acceso-alto-visible', vista.height + 'px');
        var campo = document.activeElement;
        if (campo && campo.matches('input') && contenido.contains(campo)) {
          var limite = contenido.getBoundingClientRect();
          var rect = campo.getBoundingClientRect();
          contenido.scrollTop += Math.max(0, rect.bottom - limite.bottom) + Math.min(0, rect.top - limite.top);
        }
      }
      vista.addEventListener('resize', ajustarAlturaVisible);
      ajustarAlturaVisible();
    }

    document.getElementById('nvPuerta').addEventListener('click', function (e) {
      var a = e.target.closest('[data-paso-ir]');
      if (!a) return;
      e.preventDefault();
      NV.verPuerta(a.dataset.pasoIr);
    });
    var tabs = $('nvPuertaTabs');
    if (tabs) {
      tabs.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        var actuales = Array.from(tabs.querySelectorAll('[role="tab"]'));
        var indice = actuales.indexOf(document.activeElement);
        if (indice < 0) return;
        e.preventDefault();
        var siguiente = actuales[(indice + (e.key === 'ArrowRight' ? 1 : actuales.length - 1)) % actuales.length];
        NV.verPuerta(siguiente.dataset.pasoIr);
        siguiente.focus();
      });
    }
    $('nvPuertaVolver').addEventListener('click', cerrarEncima);
    [['nvMostrarClave', 'nvAccesoClave'], ['nvMostrarClaveRegistro', 'nvRegistroClave']].forEach(function (par) {
      var boton = $(par[0]);
      var campo = $(par[1]);
      boton.addEventListener('click', function () {
        var visible = campo.type === 'password';
        campo.type = visible ? 'text' : 'password';
        boton.setAttribute('aria-pressed', String(visible));
        boton.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
      });
      campo.form.addEventListener('reset', function () {
        campo.type = 'password';
        boton.setAttribute('aria-pressed', 'false');
        boton.setAttribute('aria-label', 'Mostrar contraseña');
      });
    });
    var fvcDialogo = $('nvFvcDialogo');
    var fvcForm = $('nvFvcForm');
    var fvcPlaca = $('nvFvcPlaca');
    var fvcError = $('nvFvcError');
    var ultimoAbridorFvc = $('fvcOpen');
    function abrirFiltroCompleto(boton, placa) {
      ultimoAbridorFvc = boton;
      fvcError.hidden = true;
      fvcPlaca.removeAttribute('aria-invalid');
      fvcPlaca.value = placa || '';
      fvcDialogo.showModal();
      if (placa) fvcForm.querySelector('[type="submit"]').focus();
      else fvcPlaca.focus();
    }
    document.querySelectorAll('#nvPuerta [data-fvc-abrir]').forEach(function (boton) {
      boton.addEventListener('click', function () {
        abrirFiltroCompleto(boton);
      });
    });
    var portadaFiltro = $('nvPortadaFiltro');
    var portadaPlaca = $('nvPortadaPlaca');
    var portadaError = $('nvPortadaPlacaError');
    portadaPlaca.addEventListener('input', function () {
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      this.removeAttribute('aria-invalid');
      portadaError.hidden = true;
    });
    portadaFiltro.addEventListener('submit', function (e) {
      e.preventDefault();
      var placa = portadaPlaca.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!/^[A-Z0-9]{6}$/.test(placa)) {
        portadaError.textContent = 'Ingresa una placa válida de 6 letras o números.';
        portadaError.hidden = false;
        portadaPlaca.setAttribute('aria-invalid', 'true');
        portadaPlaca.focus();
        return;
      }
      portadaPlaca.value = placa;
      abrirFiltroCompleto($('fvcOpen'), placa);
    });
    fvcDialogo.querySelectorAll('[data-fvc-cerrar]').forEach(function (boton) {
      boton.addEventListener('click', function () { fvcDialogo.close(); });
    });
    fvcDialogo.addEventListener('click', function (e) {
      if (e.target === fvcDialogo) fvcDialogo.close();
    });
    fvcDialogo.addEventListener('close', function () {
      fvcForm.reset();
      fvcError.hidden = true;
      fvcPlaca.removeAttribute('aria-invalid');
      if (ultimoAbridorFvc && ultimoAbridorFvc.isConnected) ultimoAbridorFvc.focus();
    });
    var navegadoresDialogo = $('nvNavegadoresDialog');
    var ultimoAbridorNavegadores = null;
    document.querySelectorAll('#nvPuerta [data-navegadores-abrir]').forEach(function (boton) {
      boton.addEventListener('click', function () {
        ultimoAbridorNavegadores = boton;
        navegadoresDialogo.showModal();
        navegadoresDialogo.querySelector('[data-navegadores-cerrar]').focus();
      });
    });
    navegadoresDialogo.querySelectorAll('[data-navegadores-cerrar]').forEach(function (boton) {
      boton.addEventListener('click', function () { navegadoresDialogo.close(); });
    });
    navegadoresDialogo.addEventListener('click', function (e) {
      if (e.target === navegadoresDialogo) navegadoresDialogo.close();
    });
    navegadoresDialogo.addEventListener('close', function () {
      if (ultimoAbridorNavegadores && ultimoAbridorNavegadores.isConnected) ultimoAbridorNavegadores.focus();
    });
    fvcPlaca.addEventListener('input', function () {
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      fvcError.hidden = true;
      this.removeAttribute('aria-invalid');
    });
    fvcForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var placa = fvcPlaca.value.trim();
      if (!/^[A-Z0-9]{6}$/.test(placa)) {
        fvcError.textContent = 'Ingresa una placa válida de 6 letras o números.';
        fvcError.hidden = false;
        fvcPlaca.setAttribute('aria-invalid', 'true');
        fvcPlaca.focus();
        return;
      }
      window.location.assign(NV.whatsapp('Hola, quiero solicitar mi Filtro Vehicular Completo para la placa ' + placa + '.'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && encima && !fvcDialogo.open && !document.querySelector('.modal:not([hidden])')) cerrarEncima();
    });

    conectarRegistro();
    conectarVerificar();
    conectarOlvido();
    conectarRestablecer();
    soloDigitos();

    var reintentarAcceso = $('nvAccesoReintentar');
    if (reintentarAcceso && !reintentarAcceso.dataset.conectado) {
      reintentarAcceso.dataset.conectado = '1';
      reintentarAcceso.addEventListener('click', function () {
        reintentarAcceso.hidden = true;
        estadoVerificacion('Cargando la verificación de seguridad...');
        if (C.Turnstile) C.Turnstile.render('nvTsAcceso');
      });
    }

    /* Términos, cookies y recibo: los modales de siempre. Se conectan
       aquí porque la puerta ya los enlaza antes de entrar. */
    if (C.initOverlays) C.initOverlays();
  }
  document.addEventListener('fv:entry-ready', iniciarPuerta);
  document.addEventListener('DOMContentLoaded', iniciarPuerta);

  /* Estos módulos se descargan después de preparar los formularios. */
  document.addEventListener('DOMContentLoaded', function () {
    if (C.initWhatsappSupport) C.initWhatsappSupport();
    if (C.PaymentWatcher) C.PaymentWatcher.init();
  });
})();
