// ============================================================
// Consultia.EmailValidator
// ------------------------------------------------------------
// Validaciones del lado del cliente (UX rápida) para detectar
// correos descartables antes de enviar el registro al backend.
//
// El backend (trigger handle_new_user) tiene la lista completa
// y autoritativa. Aquí solo bloqueamos los más obvios para dar
// feedback inmediato al usuario.
// ============================================================
(function () {
  window.Consultia = window.Consultia || {};

  // Lista corta de los dominios descartables más comunes.
  // (La DB tiene la lista completa y se actualiza desde admin.)
  var DISPOSABLE_DOMAINS = [
    'mailinator.com', 'mailinator.net', 'mailinator.org',
    'tempmail.com', 'temp-mail.org', 'temp-mail.io',
    '10minutemail.com', '10minutemail.net',
    'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
    'sharklasers.com', 'grr.la',
    'throwaway.email', 'throwawaymail.com',
    'yopmail.com', 'yopmail.net', 'yopmail.fr',
    'mohmal.com', 'getnada.com', 'nada.email',
    'dispostable.com', 'fakeinbox.com',
    'trashmail.com', 'trashmail.net',
    'mailcatch.com', 'inboxalias.com',
    'emailondeck.com', 'mintemail.com', 'moakt.com',
    'tmail.ws', 'tmpmail.org', 'tmpmail.net', 'tmpeml.com',
    'emlhub.com', 'emltmp.com',
    'mailtemp.info', 'mail-temp.com',
    'spambox.us', 'spamgourmet.com',
    'maildrop.cc', 'mytemp.email',
    'burnermail.io', '33mail.com'
  ];

  function getDomain(email) {
    if (!email) return '';
    var at = email.indexOf('@');
    return at > 0 ? email.slice(at + 1).toLowerCase().trim() : '';
  }

  Consultia.EmailValidator = {
    /**
     * Verifica si un email pertenece a un dominio descartable conocido.
     * @returns {boolean}
     */
    isDisposable: function (email) {
      var domain = getDomain(email);
      if (!domain) return false;
      return DISPOSABLE_DOMAINS.indexOf(domain) !== -1;
    },

    /**
     * Validación completa del email para registro.
     * @returns {{ ok: boolean, error?: string }}
     */
    validate: function (email) {
      if (!email || typeof email !== 'string') {
        return { ok: false, error: 'El correo es obligatorio.' };
      }
      var trimmed = email.trim();
      // Formato básico
      var emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(trimmed)) {
        return { ok: false, error: 'El correo no tiene un formato válido.' };
      }
      // Dominio descartable
      if (this.isDisposable(trimmed)) {
        return {
          ok: false,
          error: 'No aceptamos correos temporales. Usa tu correo personal.'
        };
      }
      return { ok: true };
    },

    /** Lista de dominios para uso externo (tests, debug). */
    DISPOSABLE_DOMAINS: DISPOSABLE_DOMAINS
  };
})();
