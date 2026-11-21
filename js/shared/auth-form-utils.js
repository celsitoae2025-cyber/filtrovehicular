(function () {
  'use strict';
  var C = window.Consultia = window.Consultia || {};
  var strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

  C.AuthForm = {
    passwordMessage: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.',
    isStrongPassword: function (value) {
      return typeof value === 'string' && strongPassword.test(value);
    },
    normalizePhone: function (value) {
      var raw = String(value || '').trim();
      if (!/^\+?[\d\s()-]+$/.test(raw)) return '';
      var normalized = raw.replace(/[\s()-]/g, '');
      return /^\+?\d{6,15}$/.test(normalized) ? normalized : '';
    },
    createResendGate: function (cooldownMs, clock) {
      var now = clock || Date.now;
      var busy = false;
      var deadlines = new Map();
      function recipientKey(recipient) { return String(recipient || '').trim().toLowerCase(); }
      function state(recipient) {
        return {
          busy: busy,
          remaining: Math.max(0, Math.ceil(((deadlines.get(recipientKey(recipient)) || 0) - now()) / 1000))
        };
      }
      return {
        state: state,
        run: async function (recipient, send) {
          var current = state(recipient);
          if (current.busy || current.remaining) return false;
          busy = true;
          try {
            await send();
            deadlines.set(recipientKey(recipient), now() + cooldownMs);
            return true;
          } finally {
            busy = false;
          }
        }
      };
    }
  };
})();
