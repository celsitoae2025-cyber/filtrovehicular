/* ============================================================
   AUTH MODALS — login, registro, recuperar contraseña
   Se inyectan en el DOM al iniciar y se abren por API.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var EYE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var USER_SVG = '<svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  var MAIL_SVG = '<svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>';
  var PHONE_SVG = '<svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.4 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z"/></svg>';
  /* Retrato del formulario: el disco oscuro con la silueta que encabeza
     la columna de acceso. No es el mismo trazo que USER_SVG —ese va
     dentro de un campo, a 17px— así que va aparte y sin la clase de los
     iconos de campo. */
  var AVATAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-1.8a4.2 4.2 0 0 0-4.2-4.2H8.2A4.2 4.2 0 0 0 4 19.2V21"/><circle cx="12" cy="7.2" r="4.2"/></svg>';

  var LOCK_SVG = '<svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

  /* ============================================================
     Panel oscuro de la pantalla de acceso

     Es el mismo en login y en registro, así que se escribe una vez. Antes
     estaba duplicado literal en los dos modales y cualquier retoque había
     que hacerlo por partida doble.

     Lleva, de arriba abajo: de dónde sale la información, la marca, el
     saludo en grande y lo que se puede consultar.

     Las fuentes van en texto y no con sus logos: en assets/ no hay logos
     oficiales —lo que hay son iconos propios de cada servicio—, y meter
     imágenes ajenas aquí sumaría peso a la primera pantalla que ve nadie
     sin sesión. Sin franjas y sin sombras, como el resto del proyecto.
  ============================================================ */
  function brandSide(saludo) { return [
    '    <div class="auth-brand-side">',
    /* Fila de arriba: de dónde sale la información. Va donde la
       referencia pone su menú de navegación —esta pantalla no tiene
       menú— y así el panel no arranca vacío por arriba. */
    '      <div class="auth-brand-top">',
    '        <span class="auth-src-label">Información oficial de</span>',
    '        <div class="auth-src-row">',
    '          <span class="auth-src">Sunarp</span>',
    '          <span class="auth-src">SAT</span>',
    '          <span class="auth-src">MTC</span>',
    '          <span class="auth-src">APESEG</span>',
    '          <span class="auth-src">Sutran</span>',
    '          <span class="auth-src">ATU</span>',
    '          <span class="auth-src">Infracción por regiones</span>',
    '        </div>',
    '      </div>',
    '      <div class="auth-brand-content">',
    /* La marca queda de antetítulo y el saludo ("Bienvenido." / "Crea tu
       cuenta.") pasa a ser el titular grande, que es lo que manda en el
       panel. El <h2> del formulario sigue en su sitio y solo se esconde
       en escritorio (ver auth.css): en móvil este panel no se muestra, y
       sin el <h2> la pantalla se quedaría sin título. */
    '        <h3 class="auth-brand-title">Filtro Vehicular<span class="brand-plus-lg">+</span></h3>',
    '        <p class="auth-brand-greeting">' + saludo + '</p>',
    '        <p class="auth-brand-tagline">Consultas vehiculares oficiales al instante. Accede a:</p>',
    /* Las quince. Estuvieron recortadas a seis mientras el acceso era una
       tarjeta de 740×620, donde la lista larga no cabía. A pantalla
       completa y a dos columnas entran de sobra. */
    '        <ul class="auth-brand-list">',
    '          <li>Inscripción de la Placa</li>',
    '          <li>Papeletas Vigentes</li>',
    '          <li>ATU y SUTRAN</li>',
    '          <li>Papeletas con DNI</li>',
    '          <li>Vigencia del SOAT</li>',
    '          <li>Inspección Vehicular</li>',
    '          <li>Siniestralidad</li>',
    '          <li>Sistema GNV</li>',
    '          <li>Órdenes de Captura</li>',
    '          <li>Placas Duplicadas</li>',
    '          <li>Impuesto Vehicular</li>',
    '          <li>Historial Completo</li>',
    '          <li>Cambio de Características</li>',
    '          <li>Medidas Cautelares</li>',
    '          <li>Y mucho más</li>',
    '        </ul>',
    '      </div>',
    '      <div class="auth-brand-foot">© 2026 Filtro Vehicular+ Perú</div>',
    '    </div>'
  ].join(''); }

  var MODAL_HTML = [
    // ========== Registro (split) ==========
    '<div class="auth-modal" id="authModalSignup" hidden role="dialog" aria-modal="true">',
    '  <div class="auth-modal-overlay" data-auth-close></div>',
    '  <div class="auth-modal-panel auth-split">',
    '    <button class="auth-modal-close" type="button" aria-label="Cerrar" data-auth-close>' + CLOSE_SVG + '</button>',
    '    <div class="auth-form-side">',
    '      <div class="auth-form-wrap">',
    '      <div class="auth-form-mh"><span class="mh-brand">Plataforma Filtro Vehicular<span class="mh-plus">+</span></span></div>',
    /* El retrato va FUERA de la tarjeta, entre el encabezado de marca y
       ella. En móvil la tarjeta es un cuadro blanco con filete y el
       disco tiene que quedar encima, bajo la barra de colores, no
       dentro. En escritorio la tarjeta no se ve —es solo un contenedor—
       y el retrato sigue leyéndose pegado al formulario. */
    '      <div class="auth-avatar" aria-hidden="true">' + AVATAR_SVG + '</div>',
    '      <div class="auth-form-card">',
    '      <h2 class="auth-modal-title">Crea tu cuenta</h2>',
    '      <p class="auth-modal-sub">Regístrate gratis y recibe <strong>5 créditos</strong> para probar el servicio.</p>',
    '      <form class="auth-form" id="signupForm" novalidate>',
    '        <div class="auth-field">',
    '          <label>Nombre de usuario</label>',
    '          <div class="auth-input-wrap">' + USER_SVG + '<input class="auth-input has-icon" type="text" name="full_name" required autocomplete="username" placeholder="Ej: Carlos, PlacaCheck, etc."></div>',
    '        </div>',
    '        <div class="auth-field">',
    '          <label>Correo electrónico</label>',
    '          <div class="auth-input-wrap">' + MAIL_SVG + '<input class="auth-input has-icon" type="email" name="email" required autocomplete="email"></div>',
    '        </div>',
    '        <div class="auth-field">',
    '          <label>Teléfono</label>',
    '          <div class="auth-input-wrap">' + PHONE_SVG + '<input class="auth-input has-icon" type="tel" name="phone" required autocomplete="tel"></div>',
    '        </div>',
    '        <div class="auth-field">',
    '          <label>Contraseña</label>',
    '          <div class="auth-input-wrap auth-pass-wrap">' + LOCK_SVG,
    '            <input class="auth-input has-icon" type="password" name="password" required autocomplete="new-password" minlength="8">',
    '            <button type="button" class="auth-pass-toggle" aria-label="Mostrar/ocultar contraseña" tabindex="-1">' + EYE_SVG + '</button>',
    '          </div>',
    '          <span class="auth-hint">Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.</span>',
    '        </div>',
    '        <label class="auth-checkbox"><input type="checkbox" name="terms" required><span>Acepto los <a href="#" data-modal="terms">términos y condiciones</a></span></label>',
    '        <div class="auth-turnstile" id="tsSignup"></div>',
    '        <div class="auth-error" id="signupError" hidden></div>',
    '        <button type="submit" class="auth-submit">Crear cuenta</button>',
    '      </form>',
    '      <p class="auth-switch">¿Ya tienes cuenta? <button type="button" data-auth-switch="login">Inicia sesión</button></p>',
    '      </div>',
    '      <div class="auth-legal-foot"><a href="#" data-modal="terms">Términos y condiciones</a><span class="dot">·</span><a href="#" data-modal="cookies">Política de cookies</a></div>',
    '      </div>',
    '    </div>',
    brandSide('Crea tu cuenta.'),
    '  </div>',
    '</div>',

    // ========== Login (split) ==========
    '<div class="auth-modal" id="authModalLogin" hidden role="dialog" aria-modal="true">',
    '  <div class="auth-modal-overlay" data-auth-close></div>',
    '  <div class="auth-modal-panel auth-split">',
    '    <button class="auth-modal-close" type="button" aria-label="Cerrar" data-auth-close>' + CLOSE_SVG + '</button>',
    '    <div class="auth-form-side">',
    '      <div class="auth-form-wrap">',
    '      <div class="auth-form-mh"><span class="mh-brand">Plataforma Filtro Vehicular<span class="mh-plus">+</span></span></div>',
    /* El retrato va FUERA de la tarjeta, entre el encabezado de marca y
       ella. En móvil la tarjeta es un cuadro blanco con filete y el
       disco tiene que quedar encima, bajo la barra de colores, no
       dentro. En escritorio la tarjeta no se ve —es solo un contenedor—
       y el retrato sigue leyéndose pegado al formulario. */
    '      <div class="auth-avatar" aria-hidden="true">' + AVATAR_SVG + '</div>',
    '      <div class="auth-form-card">',
    '      <h2 class="auth-modal-title">Bienvenido</h2>',
    '      <p class="auth-modal-sub">Ingresa a tu cuenta para continuar con tus consultas.</p>',
    '      <form class="auth-form" id="loginForm" novalidate>',
    '        <div class="auth-field">',
    '          <label>Correo electrónico</label>',
    '          <div class="auth-input-wrap">' + MAIL_SVG + '<input class="auth-input has-icon" type="email" name="email" required autocomplete="email"></div>',
    '        </div>',
    '        <div class="auth-field">',
    '          <label>Contraseña</label>',
    '          <div class="auth-input-wrap auth-pass-wrap">' + LOCK_SVG,
    '            <input class="auth-input has-icon" type="password" name="password" required autocomplete="current-password">',
    '            <button type="button" class="auth-pass-toggle" aria-label="Mostrar/ocultar contraseña" tabindex="-1">' + EYE_SVG + '</button>',
    '          </div>',
    '        </div>',
    '        <div class="auth-row">',
    '          <label class="auth-checkbox"><input type="checkbox" name="remember"><span>Recordarme</span></label>',
    '          <button type="button" class="auth-forgot" data-auth-switch="forgot">¿Olvidaste tu contraseña?</button>',
    '        </div>',
    '        <div class="auth-turnstile" id="tsLogin"></div>',
    '        <div class="auth-error" id="loginError" hidden></div>',
    '        <button type="submit" class="auth-submit">Iniciar sesión</button>',
    '      </form>',
    '      <p class="auth-switch">¿No tienes cuenta? <button type="button" data-auth-switch="signup">Crear cuenta</button></p>',
    '      </div>',
    '      <div class="auth-legal-foot"><a href="#" data-modal="terms">Términos y condiciones</a><span class="dot">·</span><a href="#" data-modal="cookies">Política de cookies</a></div>',
    '      </div>',
    '    </div>',
    brandSide('Bienvenido.'),
    '  </div>',
    '</div>',

    // ========== Forgot password (2 vistas en el mismo modal) ==========
    // Vista A: pide email → dispara envío de código OTP de 6 dígitos.
    // Vista B (mismo modal, sin cerrar): inputs del código + nueva contraseña.
    // Ambas vistas se muestran/ocultan vía data-step. No usa URL ni link.
    '<div class="auth-modal" id="authModalForgot" hidden role="dialog" aria-modal="true">',
    '  <div class="auth-modal-overlay" data-auth-close></div>',
    '  <div class="auth-modal-panel">',
    '    <button class="auth-modal-close" type="button" aria-label="Cerrar" data-auth-close>' + CLOSE_SVG + '</button>',

    // ----- Vista A: pedir email -----
    '    <div data-forgot-step="email">',
    '      <h2 class="auth-modal-title">Recupera tu contraseña</h2>',
    '      <p class="auth-modal-sub">Ingresa tu correo y te enviaremos un código de 6 dígitos para crear una nueva contraseña.</p>',
    '      <form class="auth-form" id="forgotEmailForm" novalidate>',
    '        <div class="auth-field">',
    '          <label>Correo electrónico</label>',
    '          <div class="auth-input-wrap">' + MAIL_SVG + '<input class="auth-input has-icon" type="email" name="email" required autocomplete="email"></div>',
    '        </div>',
    '        <div class="auth-turnstile" id="tsForgot"></div>',
    '        <div class="auth-error" id="forgotEmailError" hidden></div>',
    '        <button type="submit" class="auth-submit">Enviar código</button>',
    '      </form>',
    '      <p class="auth-switch auth-switch-single"><button type="button" data-auth-switch="login">← Volver al login</button></p>',
    '    </div>',

    // ----- Vista B: código + nueva contraseña -----
    '    <div data-forgot-step="reset" hidden>',
    '      <h2 class="auth-modal-title">Restablece tu contraseña</h2>',
    '      <p class="auth-modal-sub">Te enviamos un código de 6 dígitos a <strong id="forgotEmailDisplay">tu correo</strong>. Ingrésalo y elige una nueva contraseña.</p>',
    '      <form class="auth-form" id="forgotResetForm" novalidate>',
    '        <div class="auth-field">',
    '          <label>Código de verificación</label>',
    '          <div class="otp-inputs" id="forgotOtpInputs">',
    '            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 1">',
    '            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 2">',
    '            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 3">',
    '            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 4">',
    '            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 5">',
    '            <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 6">',
    '          </div>',
    '        </div>',
    '        <div class="auth-field">',
    '          <label>Nueva contraseña</label>',
    '          <div class="auth-input-wrap auth-pass-wrap">' + LOCK_SVG,
    '            <input class="auth-input has-icon" type="password" name="password" required minlength="8" placeholder="Mínimo 8 caracteres">',
    '            <button type="button" class="auth-pass-toggle" aria-label="Mostrar/ocultar" tabindex="-1">' + EYE_SVG + '</button>',
    '          </div>',
    '        </div>',
    // Vacío hasta que el usuario toque "Reenviar código": ese reenvío
    // también pasa por el CAPTCHA, pero no tiene sentido enseñar el
    // widget de entrada en un paso donde casi nadie lo va a necesitar.
    '        <div class="auth-turnstile" id="tsForgotResend"></div>',
    '        <div class="auth-error" id="forgotResetError" hidden></div>',
    '        <button type="submit" class="auth-submit" id="forgotResetSubmit" disabled>Cambiar contraseña</button>',
    '      </form>',
    '      <p class="auth-switch auth-switch-single">',
    '        <button type="button" id="forgotChangeEmail">← Usar otro correo</button>',
    '        <span style="margin:0 10px;color:#cbd5e1;">·</span>',
    '        <button type="button" id="forgotResend">Reenviar código</button>',
    '      </p>',
    '    </div>',
    '  </div>',
    '</div>',

    // ========== OTP — Verificación de código ==========
    '<div class="auth-modal" id="authModalOtp" hidden role="dialog" aria-modal="true">',
    '  <div class="auth-modal-overlay" data-auth-close></div>',
    '  <div class="auth-modal-panel">',
    '    <button class="auth-modal-close" type="button" aria-label="Cerrar" data-auth-close>' + CLOSE_SVG + '</button>',
    '    <h2 class="auth-modal-title">Verifica tu correo</h2>',
    '    <p class="auth-modal-sub">Te enviamos un código de 6 dígitos a <strong id="otpEmailDisplay">tu correo</strong>. Ingrésalo aquí para activar tu cuenta.</p>',
    '    <form class="auth-form" id="otpForm" novalidate>',
    '      <div class="otp-inputs" id="otpInputs">',
    '        <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 1">',
    '        <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 2">',
    '        <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 3">',
    '        <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 4">',
    '        <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 5">',
    '        <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Dígito 6">',
    '      </div>',
    // Vacío hasta que toquen "Reenviar código". Supabase exige CAPTCHA
    // también en el reenvío, pero verificar el código NO lo necesita, así
    // que el widget solo aparece si hace falta.
    '      <div class="auth-turnstile" id="tsOtpResend"></div>',
    '      <div class="auth-error" id="otpError" hidden></div>',
    '      <button type="submit" class="auth-submit" id="otpSubmit" disabled>Verificar cuenta</button>',
    '    </form>',
    '    <p class="auth-switch otp-resend-wrap">',
    '      <span>¿No te llegó?</span>',
    '      <button type="button" id="otpResend">Reenviar código</button>',
    '    </p>',
    '  </div>',
    '</div>',

    // ========== Info modal (email pending / reset ok) ==========
    '<div class="auth-modal" id="authModalInfo" hidden role="dialog" aria-modal="true">',
    '  <div class="auth-modal-overlay" data-auth-close></div>',
    '  <div class="auth-modal-panel">',
    '    <button class="auth-modal-close" type="button" aria-label="Cerrar" data-auth-close>' + CLOSE_SVG + '</button>',
    '    <div class="auth-modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#8fc72e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg></div>',
    '    <h2 class="auth-modal-title" id="authInfoTitle">Revisa tu correo</h2>',
    '    <p class="auth-modal-sub" id="authInfoSub">Te enviamos un correo con el próximo paso.</p>',
    '    <button type="button" class="auth-submit" data-auth-close>Entendido</button>',
    '  </div>',
    '</div>',

    // ========== Términos y Condiciones ==========
    '<div class="auth-modal auth-modal-legal" id="authModalTerms" hidden role="dialog" aria-modal="true" style="z-index:10001;">',
    '  <div class="auth-modal-overlay" data-legal-close></div>',
    '  <div class="auth-modal-panel auth-legal-panel">',
    '    <button class="auth-modal-close" type="button" aria-label="Cerrar" data-legal-close>' + CLOSE_SVG + '</button>',
    '    <h2 class="auth-modal-title">Términos y condiciones</h2>',
    '    <p class="auth-modal-sub auth-legal-meta">Última actualización: abril 2026</p>',
    '    <div class="auth-legal-content">',
    '      <h3>1. Aceptación</h3>',
    '      <p>Al crear una cuenta en <strong>Filtro Vehicular+</strong> aceptas estos términos y nuestra política de cookies. Si no estás de acuerdo, no uses el servicio.</p>',
    '      <h3>2. Servicio</h3>',
    '      <p>Filtro Vehicular+ ofrece consultas vehiculares a fuentes públicas (Reniec, Sunarp, SUNAT, MTC y otras) bajo un sistema de créditos prepago. La información mostrada se obtiene de las entidades originales y se entrega tal como es recibida.</p>',
    '      <h3>3. Cuenta de usuario</h3>',
    '      <p>Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada en tu cuenta. Debes proporcionar datos verídicos al registrarte. Una sola persona = una sola cuenta.</p>',
    '      <h3>4. Créditos y pagos</h3>',
    '      <p>Los créditos se compran por adelantado mediante Mercado Pago u otros medios habilitados. Cada consulta descuenta el costo correspondiente al saldo. Los créditos no caducan, no son transferibles y no son canjeables por dinero.</p>',
    '      <p>Al registrarte recibes <strong>5 créditos de bienvenida</strong> que solo pueden usarse en la sección "Tipo de consulta" de la página de inicio. El resto del catálogo se desbloquea con tu primera recarga.</p>',
    '      <h3>5. Reembolsos</h3>',
    '      <p>Si una consulta falla por causas atribuibles al servicio, los créditos descontados se reintegran automáticamente. No se reembolsan créditos por consultas que devuelvan resultados vacíos por inexistencia del registro en la fuente oficial (eso es información válida).</p>',
    '      <h3>6. Uso permitido</h3>',
    '      <p>El servicio se usa con fines lícitos y personales o profesionales. Está prohibido: revender los datos, usar el servicio para acoso o fines ilegales, automatizar consultas con bots externos, y extraer datos de forma masiva sin autorización.</p>',
    '      <h3>7. Privacidad</h3>',
    '      <p>Tus datos personales (nombre, correo, celular) se almacenan de forma segura y no se comparten con terceros, salvo requerimiento legal. Cumplimos con la <strong>Ley N° 29733</strong> de Protección de Datos Personales del Perú.</p>',
    '      <h3>8. Limitación de responsabilidad</h3>',
    '      <p>Filtro Vehicular+ es un agregador de consultas. La exactitud de los datos depende de la fuente oficial. No nos hacemos responsables por decisiones tomadas en base a la información consultada.</p>',
    '      <h3>9. Modificaciones</h3>',
    '      <p>Podemos actualizar estos términos en cualquier momento. Te notificaremos los cambios importantes por correo o dentro de la plataforma.</p>',
    '      <h3>10. Contacto</h3>',
    '      <p>Para cualquier consulta o reclamo: WhatsApp <strong>+51 932 465 820</strong>.</p>',
    '    </div>',
    '    <button type="button" class="auth-submit" data-legal-close>Entendido</button>',
    '  </div>',
    '</div>',

    // ========== Confirmación de Términos (al marcar checkbox) ==========
    '<div class="auth-modal auth-modal-legal" id="authModalTermsConfirm" hidden role="dialog" aria-modal="true" style="z-index:10002;">',
    '  <div class="auth-modal-overlay" data-terms-cancel></div>',
    '  <div class="auth-modal-panel auth-confirm-panel">',
    '    <div class="auth-confirm-icon">',
    '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>',
    '        <polyline points="14 2 14 8 20 8"/>',
    '        <polyline points="9 15 11 17 15 13"/>',
    '      </svg>',
    '    </div>',
    '    <h2 class="auth-modal-title auth-confirm-title">Acepta para continuar</h2>',
    '    <p class="auth-confirm-text">',
    '      Al continuar confirmas que has leído y aceptas los <a href="#" data-modal="terms">términos y condiciones</a> y la <a href="#" data-modal="cookies">política de cookies</a> de Filtro Vehicular+.',
    '    </p>',
    '    <div class="auth-confirm-actions">',
    '      <button type="button" class="auth-confirm-cancel" data-terms-cancel>Cancelar</button>',
    '      <button type="button" class="auth-confirm-accept" data-terms-accept>Acepto</button>',
    '    </div>',
    '  </div>',
    '</div>',

    // ========== Política de Cookies ==========
    '<div class="auth-modal auth-modal-legal" id="authModalCookies" hidden role="dialog" aria-modal="true" style="z-index:10001;">',
    '  <div class="auth-modal-overlay" data-legal-close></div>',
    '  <div class="auth-modal-panel auth-legal-panel">',
    '    <button class="auth-modal-close" type="button" aria-label="Cerrar" data-legal-close>' + CLOSE_SVG + '</button>',
    '    <h2 class="auth-modal-title">Política de cookies</h2>',
    '    <p class="auth-modal-sub auth-legal-meta">Última actualización: abril 2026</p>',
    '    <div class="auth-legal-content">',
    '      <h3>¿Qué son las cookies?</h3>',
    '      <p>Las cookies son pequeños archivos que se guardan en tu dispositivo para recordar tus preferencias y mantener tu sesión activa.</p>',
    '      <h3>¿Qué cookies usamos?</h3>',
    '      <p><strong>Esenciales:</strong> mantienen tu sesión iniciada y guardan tus preferencias. Sin estas, el servicio no funciona.</p>',
    '      <p><strong>Funcionales:</strong> recuerdan tu última consulta y opciones para mejorar tu experiencia.</p>',
    '      <p>No usamos cookies de publicidad ni de seguimiento de terceros.</p>',
    '      <h3>Control</h3>',
    '      <p>Puedes borrar las cookies desde tu navegador en cualquier momento. Si las eliminas, perderás tu sesión y tendrás que volver a iniciar.</p>',
    '      <h3>Contacto</h3>',
    '      <p>Dudas: WhatsApp <strong>+51 932 465 820</strong>.</p>',
    '    </div>',
    '    <button type="button" class="auth-submit" data-legal-close>Entendido</button>',
    '  </div>',
    '</div>'
  ].join('');

  var container = null;

  function inject() {
    if (container) return;
    container = document.createElement('div');
    container.id = 'authModalsContainer';
    container.innerHTML = MODAL_HTML;
    document.body.appendChild(container);
  }

  // Qué widget de Turnstile le toca a cada modal. Se monta al abrir, no
  // al cargar la página: el token vence a los 5 minutos y así llega
  // fresco al momento de enviar el formulario.
  var TURNSTILE_POR_MODAL = {
    authModalSignup: 'tsSignup',
    authModalLogin:  'tsLogin',
    authModalForgot: 'tsForgot'
  };

  function openModal(id) {
    closeAll();
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    document.body.classList.add('auth-modal-open');

    var ts = TURNSTILE_POR_MODAL[id];
    if (ts && Consultia.Turnstile) Consultia.Turnstile.render(ts);

    setTimeout(function () {
      var focus = el.querySelector('input, button');
      if (focus) focus.focus();
    }, 50);
  }

  // Pide el token del widget y, si no hay forma de conseguirlo, devuelve
  // null. No bloqueamos el envío: si Supabase tiene el CAPTCHA encendido
  // contestará con un error que traduceError() explica en cristiano, y si
  // lo tiene apagado el registro sale igual.
  function tokenCaptcha(containerId) {
    if (!Consultia.Turnstile) return Promise.resolve(null);
    return Consultia.Turnstile.getToken(containerId);
  }

  function resetCaptcha(containerId) {
    if (Consultia.Turnstile) Consultia.Turnstile.reset(containerId);
  }

  function closeAll() {
    document.querySelectorAll('.auth-modal').forEach(function (m) { m.hidden = true; });
    document.body.classList.remove('auth-modal-open');
  }

  function setError(id, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.textContent = msg;
    el.hidden = false;
  }

  function setLoading(form, loading) {
    var btn = form.querySelector('.auth-submit');
    if (!btn) return;
    btn.disabled = loading;
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.textContent = loading ? 'Cargando…' : btn.dataset.originalText;
  }

  // Abre un modal legal (terms/cookies) ENCIMA del modal padre, sin cerrarlo.
  function openLegalModal(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
  }

  // Cierra solo modales legales, no afecta al modal de registro/login de fondo.
  function closeLegalModals() {
    document.querySelectorAll('.auth-modal-legal').forEach(function (m) { m.hidden = true; });
  }

  function bind() {
    // Cerrar modales (overlay, botón X, botón "Entendido")
    document.addEventListener('click', function (e) {

      // Cerrar SOLO modal legal (sin afectar al modal de registro detrás)
      var legalClose = e.target.closest('[data-legal-close]');
      if (legalClose) { closeLegalModals(); return; }

      // Abrir modal legal (terms / cookies) encima del modal actual
      var legalOpen = e.target.closest('[data-modal]');
      if (legalOpen) {
        e.preventDefault();
        var which = legalOpen.dataset.modal;
        if (which === 'terms')   openLegalModal('authModalTerms');
        if (which === 'cookies') openLegalModal('authModalCookies');
        return;
      }

      var close = e.target.closest('[data-auth-close]');
      if (close) {
        // Si estamos en modo "login obligatorio" (auth-gate sin sesión),
        // ignorar cualquier intento de cerrar el modal.
        if (document.body.classList.contains('auth-mandatory')) return;
        closeAll();
        return;
      }

      var switchTo = e.target.closest('[data-auth-switch]');
      if (switchTo) {
        var target = switchTo.dataset.authSwitch;
        if (target === 'login')   openModal('authModalLogin');
        if (target === 'signup')  openModal('authModalSignup');
        if (target === 'forgot')  openModal('authModalForgot');
      }

      // Show/hide password
      var toggle = e.target.closest('.auth-pass-toggle');
      if (toggle) {
        var input = toggle.parentElement.querySelector('input');
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
      }
    });

    // ESC cierra (primero los legales, después el resto)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var hasLegalOpen = !!document.querySelector('.auth-modal-legal:not([hidden])');
      if (hasLegalOpen) { closeLegalModals(); return; }
      // En modo "login obligatorio", ESC no cierra el modal.
      if (document.body.classList.contains('auth-mandatory')) return;
      closeAll();
    });

    // ====== Confirmación de términos al marcar checkbox ======
    var termsCheckbox = document.querySelector('#signupForm input[name="terms"]');
    if (termsCheckbox) {
      termsCheckbox.addEventListener('click', function (e) {
        // Solo cuando el usuario lo está marcando (no al desmarcar)
        if (termsCheckbox.checked) {
          // Evitamos que quede marcado hasta que confirme en el modal
          e.preventDefault();
          openLegalModal('authModalTermsConfirm');
        }
      });
    }

    // Acepto -> deja el checkbox marcado y cierra el modal
    document.addEventListener('click', function (e) {
      var accept = e.target.closest('[data-terms-accept]');
      if (accept) {
        if (termsCheckbox) termsCheckbox.checked = true;
        document.getElementById('authModalTermsConfirm').hidden = true;
      }
      var cancel = e.target.closest('[data-terms-cancel]');
      if (cancel) {
        if (termsCheckbox) termsCheckbox.checked = false;
        document.getElementById('authModalTermsConfirm').hidden = true;
      }
    });

    // ====== Registro ======
    var pendingSignupEmail = '';

    document.getElementById('signupForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var form = e.target;
      setError('signupError', '');
      var fd = new FormData(form);
      var email = fd.get('email').trim();

      // Validación previa: formato + dominios descartables conocidos.
      // El backend tiene la lista completa, esto es solo UX rápida.
      if (Consultia.EmailValidator) {
        var v = Consultia.EmailValidator.validate(email);
        if (!v.ok) {
          setError('signupError', v.error);
          return;
        }
      }

      var password = fd.get('password');
      var passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
      if (!passRegex.test(password)) {
        setError('signupError', 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.');
        return;
      }

      setLoading(form, true);
      var captchaToken = await tokenCaptcha('tsSignup');
      var res = await Consultia.Auth.signUp({
        email: email,
        password: password,
        full_name: fd.get('full_name').trim(),
        phone: fd.get('phone').trim(),
        captchaToken: captchaToken
      });
      setLoading(form, false);
      // El token es de un solo uso: se quema salga bien o mal.
      resetCaptcha('tsSignup');
      if (res.error) {
        setError('signupError', traduceError(res.error.message));
        return;
      }
      pendingSignupEmail = email;
      document.getElementById('otpEmailDisplay').textContent = email;
      clearOtpDigits();
      setError('otpError', '');
      closeAll();
      openModal('authModalOtp');
      setTimeout(function () {
        var first = document.querySelector('#otpInputs .otp-digit');
        if (first) first.focus();
      }, 100);
      form.reset();
    });

    // ====== OTP — verificación de código ======
    function getOtpInputs() { return document.querySelectorAll('#otpInputs .otp-digit'); }

    function clearOtpDigits() {
      getOtpInputs().forEach(function (inp) { inp.value = ''; });
      var btn = document.getElementById('otpSubmit');
      if (btn) btn.disabled = true;
    }

    function readOtpCode() {
      var digits = [];
      getOtpInputs().forEach(function (inp) { digits.push(inp.value || ''); });
      return digits.join('');
    }

    function checkOtpComplete() {
      var code = readOtpCode();
      var total = document.querySelectorAll('#otpInputs .otp-digit').length;
      var btn = document.getElementById('otpSubmit');
      if (btn) btn.disabled = code.length !== total;
      return code.length === total;
    }

    // Manejo de inputs (auto-tab next, backspace anterior, paste, solo dígitos)
    getOtpInputs().forEach(function (inp, idx) {
      inp.addEventListener('input', function (ev) {
        var v = inp.value.replace(/\D/g, ''); // solo dígitos
        if (v.length > 1) {
          // Pegado múltiples dígitos: distribuir
          var digits = v.split('');
          var all = getOtpInputs();
          for (var i = 0; i < digits.length && (idx + i) < all.length; i++) {
            all[idx + i].value = digits[i];
          }
          var nextIdx = Math.min(idx + digits.length, all.length - 1);
          all[nextIdx].focus();
        } else {
          inp.value = v;
          if (v && idx < getOtpInputs().length - 1) {
            getOtpInputs()[idx + 1].focus();
          }
        }
        checkOtpComplete();
        // Auto-submit con delay para permitir corrección
        if (checkOtpComplete()) {
          setTimeout(function () {
            if (checkOtpComplete()) document.getElementById('otpSubmit').click();
          }, 300);
        }
      });

      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Backspace' && !inp.value && idx > 0) {
          var prev = getOtpInputs()[idx - 1];
          prev.focus();
          prev.value = '';
          checkOtpComplete();
        }
        if (ev.key === 'ArrowLeft' && idx > 0) getOtpInputs()[idx - 1].focus();
        if (ev.key === 'ArrowRight' && idx < getOtpInputs().length - 1) getOtpInputs()[idx + 1].focus();
      });
    });

    document.getElementById('otpForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!checkOtpComplete()) return;
      var code = readOtpCode();
      var form = e.target;
      setError('otpError', '');
      setLoading(form, true);
      var res = await Consultia.Auth.verifyOtp(pendingSignupEmail, code);
      setLoading(form, false);
      if (res.error) {
        setError('otpError', traduceOtpError(res.error.message));
        clearOtpDigits();
        setTimeout(function () {
          var first = document.querySelector('#otpInputs .otp-digit');
          if (first) first.focus();
        }, 50);
        return;
      }
      closeAll();
      if (Consultia.toast) Consultia.toast({
        type: 'success',
        title: '¡Cuenta verificada!',
        message: 'Bienvenido a Filtro Vehicular+'
      });
    });

    document.getElementById('otpResend').addEventListener('click', async function () {
      if (!pendingSignupEmail) return;
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Enviando…';
      try {
        // El widget se monta recién ahora, con el modal ya a la vista.
        var captchaToken = await tokenCaptcha('tsOtpResend');
        var res = await Consultia.Auth.resendVerification(pendingSignupEmail, captchaToken);
        resetCaptcha('tsOtpResend');
        if (res.error) {
          setError('otpError', traduceOtpError(res.error.message));
          return;
        }
        if (Consultia.toast) Consultia.toast({
          type: 'success',
          title: 'Código reenviado',
          message: 'Revisa tu correo (incluye spam).'
        });
      } catch (err) {
        console.error('[auth] resend OTP error:', err);
        setError('otpError', 'No se pudo reenviar. Intenta en un minuto.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Reenviar código';
      }
    });

    function traduceOtpError(msg) {
      if (!msg) return 'Error desconocido.';
      var lower = msg.toLowerCase();
      // Va primero: el aviso de CAPTCHA de Supabase contiene "invalid" en
      // algunas variantes y si no acabaría disfrazado de "código incorrecto".
      if (lower.indexOf('captcha') !== -1) return 'No se pudo completar la verificación de seguridad. Recarga la página e inténtalo otra vez.';
      if (lower.indexOf('invalid') !== -1 || lower.indexOf('otp') !== -1) return 'El código es incorrecto o venció. Pide uno nuevo.';
      if (lower.indexOf('expired') !== -1) return 'El código venció. Pide uno nuevo.';
      if (lower.indexOf('rate limit') !== -1) return 'Demasiados intentos. Espera unos minutos.';
      return msg;
    }

    // ====== Login ======
    document.getElementById('loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var form = e.target;
      setError('loginError', '');
      setLoading(form, true);
      var fd = new FormData(form);
      var remember = !!fd.get('remember');
      var captchaToken = await tokenCaptcha('tsLogin');
      var res = await Consultia.Auth.signIn(fd.get('email').trim(), fd.get('password'), remember, captchaToken);
      setLoading(form, false);
      resetCaptcha('tsLogin');
      if (res.error) {
        setError('loginError', traduceError(res.error.message));
        return;
      }
      closeAll();
      form.reset();
      if (Consultia.toast) Consultia.toast({ type: 'success', title: '¡Bienvenido/a!', message: 'Sesión iniciada.' });
    });

    // ============================================================
    // FORGOT / RESET PASSWORD — un solo modal con 2 vistas
    // ============================================================
    // Vista A (forgotEmailForm): pide email → dispara verifyOtp con código
    //   numérico de 6 dígitos vía resetPasswordForEmail.
    // Vista B (forgotResetForm): el usuario ingresa el código que le llegó
    //   por email + su nueva contraseña → verifyOtp({type:'recovery',
    //   email, token}) crea sesión temporal → updateUser({password}).
    //
    // Por qué OTP en vez de magic-link: proveedores SMTP (Brevo) reescriben
    // los links para tracking y consumen el token al hacer pre-visita.
    // Un código numérico copy-paste es 100% inmune a eso.
    bindForgotFlow();
  }

  // Estado del flujo de recuperación (vive entre vistas A y B)
  var forgotState = { email: null };

  function showForgotStep(step) {
    var modal = document.getElementById('authModalForgot');
    if (!modal) return;
    var stepEmail = modal.querySelector('[data-forgot-step="email"]');
    var stepReset = modal.querySelector('[data-forgot-step="reset"]');
    if (!stepEmail || !stepReset) return;
    if (step === 'reset') {
      stepEmail.hidden = true;
      stepReset.hidden = false;
    } else {
      stepEmail.hidden = false;
      stepReset.hidden = true;
    }
  }

  function getForgotOtpCode() {
    var inputs = document.querySelectorAll('#forgotOtpInputs .otp-digit');
    var code = '';
    inputs.forEach(function (inp) { code += (inp.value || '').trim(); });
    return code;
  }

  function clearForgotOtpInputs() {
    var inputs = document.querySelectorAll('#forgotOtpInputs .otp-digit');
    inputs.forEach(function (inp) { inp.value = ''; });
    var btn = document.getElementById('forgotResetSubmit');
    if (btn) btn.disabled = true;
  }

  function resetForgotFlow() {
    forgotState.email = null;
    clearForgotOtpInputs();
    setError('forgotEmailError', '');
    setError('forgotResetError', '');
    var emailForm = document.getElementById('forgotEmailForm');
    var resetForm = document.getElementById('forgotResetForm');
    if (emailForm) emailForm.reset();
    if (resetForm) resetForm.reset();
    showForgotStep('email');
  }

  function bindForgotFlow() {
    // Inputs OTP (auto-avance, paste, habilita botón cuando hay 6 dígitos)
    bindOtpInputs('forgotOtpInputs', 'forgotResetSubmit');

    // ----- Vista A: enviar código al email -----
    var emailForm = document.getElementById('forgotEmailForm');
    if (emailForm) {
      emailForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        setError('forgotEmailError', '');
        var email = (emailForm.email.value || '').trim();
        if (!email) {
          setError('forgotEmailError', 'Ingresa tu correo.');
          return;
        }
        setLoading(emailForm, true);
        var captchaToken = await tokenCaptcha('tsForgot');
        var res = await Consultia.Auth.requestPasswordReset(email, captchaToken);
        setLoading(emailForm, false);
        resetCaptcha('tsForgot');
        if (res && res.error) {
          console.error('[auth] requestPasswordReset error:', res.error);
          var msg = (res.error.message || '').toLowerCase();
          if (msg.indexOf('rate') !== -1) {
            setError('forgotEmailError', 'Demasiados intentos. Espera unos minutos.');
            return;
          }
          // No reveler si el email existe (privacidad). Avanzamos a la
          // vista de código igual: si el correo no estaba registrado,
          // simplemente nunca llegará un código y el usuario lo verá.
        } else {
        }
        forgotState.email = email;
        var display = document.getElementById('forgotEmailDisplay');
        if (display) display.textContent = email;
        clearForgotOtpInputs();
        showForgotStep('reset');
        // Foco en el primer dígito para que pueda escribir directo
        setTimeout(function () {
          var first = document.querySelector('#forgotOtpInputs .otp-digit');
          if (first) first.focus();
        }, 100);
      });
    }

    // ----- Vista B: verificar código + cambiar contraseña -----
    var resetForm = document.getElementById('forgotResetForm');
    if (resetForm) {
      resetForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        setError('forgotResetError', '');
        var code = getForgotOtpCode();
        var newPassword = resetForm.password.value;

        if (!code || code.length !== 6) {
          setError('forgotResetError', 'Ingresa los 6 dígitos del código.');
          return;
        }
        if (!newPassword || newPassword.length < 8) {
          setError('forgotResetError', 'La contraseña debe tener al menos 8 caracteres.');
          return;
        }
        if (!forgotState.email) {
          setError('forgotResetError', 'Vuelve a iniciar el proceso de recuperación.');
          showForgotStep('email');
          return;
        }

        setLoading(resetForm, true);

        // 1) Verificar OTP — crea sesión temporal de recovery
        var verifyRes = await Consultia.Auth.verifyResetOtp(forgotState.email, code);
        if (verifyRes && verifyRes.error) {
          setLoading(resetForm, false);
          console.error('[auth] verifyOtp recovery error:', verifyRes.error);
          var vmsg = (verifyRes.error.message || '').toLowerCase();
          if (vmsg.indexOf('expired') !== -1) {
            setError('forgotResetError', 'El código expiró. Toca "Reenviar código".');
          } else if (vmsg.indexOf('invalid') !== -1 || vmsg.indexOf('not found') !== -1 || vmsg.indexOf('token') !== -1) {
            setError('forgotResetError', 'Código incorrecto. Revísalo y vuelve a intentar.');
          } else {
            setError('forgotResetError', traduceError(verifyRes.error.message));
          }
          return;
        }

        // 2) Actualizar contraseña con la sesión recién creada
        var updRes = await Consultia.Auth.updatePassword(newPassword);
        setLoading(resetForm, false);
        if (updRes && updRes.error) {
          console.error('[auth] updateUser error:', updRes.error);
          setError('forgotResetError', traduceError(updRes.error.message));
          return;
        }

        // Éxito: cerrar modal, limpiar estado, mostrar confirmación
        closeAll();
        resetForgotFlow();
        document.getElementById('authInfoTitle').textContent = 'Contraseña actualizada';
        document.getElementById('authInfoSub').textContent = 'Ya puedes iniciar sesión con tu nueva contraseña.';
        openModal('authModalInfo');
        if (Consultia.toast) {
          Consultia.toast({ type: 'success', title: 'Listo', message: 'Tu contraseña fue actualizada.' });
        }
      });
    }

    // ----- Botón "Usar otro correo" → vuelve a vista A -----
    var changeBtn = document.getElementById('forgotChangeEmail');
    if (changeBtn) {
      changeBtn.addEventListener('click', function () {
        forgotState.email = null;
        clearForgotOtpInputs();
        setError('forgotResetError', '');
        showForgotStep('email');
        setTimeout(function () {
          var emailInput = document.querySelector('#forgotEmailForm input[name="email"]');
          if (emailInput) emailInput.focus();
        }, 100);
      });
    }

    // ----- Botón "Reenviar código" -----
    var resendBtn = document.getElementById('forgotResend');
    if (resendBtn) {
      resendBtn.addEventListener('click', async function () {
        if (!forgotState.email) {
          showForgotStep('email');
          return;
        }
        resendBtn.disabled = true;
        var original = resendBtn.textContent;
        resendBtn.textContent = 'Enviando…';
        // El widget de este paso se monta recién ahora, con el modal ya
        // visible. Montarlo oculto no sirve: Turnstile necesita estar a
        // la vista para resolver el reto.
        var captchaToken = await tokenCaptcha('tsForgotResend');
        var rr = await Consultia.Auth.requestPasswordReset(forgotState.email, captchaToken);
        resetCaptcha('tsForgotResend');
        if (rr && rr.error) {
          console.error('[auth] resend error:', rr.error);
          setError('forgotResetError', 'No se pudo reenviar. Intenta en un minuto.');
        } else if (Consultia.toast) {
          Consultia.toast({ type: 'success', title: 'Código reenviado', message: 'Revisa tu correo.' });
        }
        setTimeout(function () {
          resendBtn.disabled = false;
          resendBtn.textContent = original;
        }, 30000);
      });
    }

    // Cuando el modal Forgot se abre desde cero (link "¿Olvidaste tu..."),
    // siempre arrancar en la vista A. Lo hacemos vía MutationObserver del
    // atributo hidden del modal.
    var modal = document.getElementById('authModalForgot');
    if (modal && typeof MutationObserver !== 'undefined') {
      new MutationObserver(function () {
        if (!modal.hidden && !forgotState.email) {
          showForgotStep('email');
        }
      }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
    }
  }

  // UX de los 6 inputs OTP: auto-avance al escribir, retroceso con backspace,
  // pegado de código completo, y habilita el botón cuando hay 6 dígitos.
  function bindOtpInputs(containerId, submitId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var inputs = container.querySelectorAll('.otp-digit');
    var submit = submitId ? document.getElementById(submitId) : null;

    function checkComplete() {
      var code = '';
      inputs.forEach(function (i) { code += (i.value || '').trim(); });
      if (submit) submit.disabled = code.length !== 6;
    }

    inputs.forEach(function (inp, idx) {
      inp.addEventListener('input', function () {
        inp.value = (inp.value || '').replace(/[^0-9]/g, '').slice(0, 1);
        if (inp.value && idx < inputs.length - 1) inputs[idx + 1].focus();
        checkComplete();
      });
      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Backspace' && !inp.value && idx > 0) {
          inputs[idx - 1].focus();
        }
      });
      inp.addEventListener('paste', function (ev) {
        ev.preventDefault();
        var data = (ev.clipboardData || window.clipboardData).getData('text') || '';
        var digits = data.replace(/[^0-9]/g, '').slice(0, 6);
        for (var i = 0; i < digits.length && i < inputs.length; i++) {
          inputs[i].value = digits[i];
        }
        var nextIdx = Math.min(digits.length, inputs.length - 1);
        inputs[nextIdx].focus();
        checkComplete();
      });
    });
  }

  // Traducción amigable de errores de Supabase
  function traduceError(msg) {
    if (!msg) return 'Error desconocido.';
    var lower = msg.toLowerCase();
    if (lower.indexOf('sending confirmation email') !== -1) return 'No pudimos enviar el correo de verificación. Intenta en unos minutos o escríbenos por WhatsApp.';
    if (lower.indexOf('sending recovery email') !== -1)     return 'No pudimos enviar el correo de recuperación. Intenta en unos minutos.';
    if (lower.indexOf('email rate limit') !== -1)           return 'Se enviaron demasiados correos. Espera unos minutos antes de reintentar.';
    if (lower.indexOf('invalid login') !== -1)        return 'Correo o contraseña incorrectos.';
    if (lower.indexOf('email not confirmed') !== -1)  return 'Tienes que verificar tu correo antes de entrar. Revisa tu bandeja.';
    if (lower.indexOf('user already registered') !== -1) return 'Este correo ya está registrado. Prueba iniciar sesión.';
    if (lower.indexOf('password should') !== -1)     return 'La contraseña debe tener al menos 8 caracteres.';
    if (lower.indexOf('rate limit') !== -1)          return 'Demasiados intentos. Espera unos minutos.';
    if (lower.indexOf('network') !== -1)             return 'Error de conexión. Revisa tu internet.';
    if (lower.indexOf('invalid email') !== -1)       return 'El correo no es válido.';
    if (lower.indexOf('signup is disabled') !== -1)  return 'Los registros están temporalmente desactivados.';
    // Turnstile: el token no llegó, venció o ya se había usado. Suele pasar
    // con un bloqueador de anuncios o si el formulario estuvo abierto más de
    // 5 minutos. Recargar es lo único que lo arregla desde el lado del usuario.
    if (lower.indexOf('captcha') !== -1)             return 'No se pudo completar la verificación de seguridad. Recarga la página e inténtalo otra vez; si usas un bloqueador de anuncios, desactívalo para este sitio.';
    return msg;
  }

  // Si el usuario llega desde un link viejo de recuperación (con ?recovery=1,
  // ?token_hash=..., o #type=recovery en la URL), ese flujo ya no aplica porque
  // ahora usamos OTP de 6 dígitos. Limpiamos la URL y le pedimos que solicite
  // un código nuevo.
  function checkRecoveryMode() {
    var params = new URLSearchParams(window.location.search);
    var hash = window.location.hash || '';
    var hasRecoveryUrl =
      params.get('recovery') === '1' ||
      params.get('token_hash') ||
      hash.indexOf('type=recovery') !== -1;

    if (!hasRecoveryUrl) return;

    // Limpiar la URL para que no se quede el parámetro
    if (window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    // Abrir el modal de "Olvidaste tu contraseña" para que pida un código
    setTimeout(function () {
      openModal('authModalForgot');
      if (Consultia.toast) {
        Consultia.toast({
          type: 'info',
          title: 'Solicita un código',
          message: 'El flujo de recuperación cambió. Pídelo de nuevo y te enviaremos un código de 6 dígitos.'
        });
      }
    }, 300);
  }

  Consultia.AuthModals = {
    openLogin:   function () { openModal('authModalLogin'); },
    openSignup:  function () { openModal('authModalSignup'); },
    openForgot:  function () { openModal('authModalForgot'); },
    closeAll:    closeAll
  };

  Consultia.initAuthModals = function () {
    inject();
    bind();
    checkRecoveryMode();
  };
})();
