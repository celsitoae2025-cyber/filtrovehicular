/* ============================================================
   MODULE: Validation — formatea y valida placa / DNI en tiempo real
   Se auto-aplica a cualquier input con data-validate="placa|dni|partida"
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  function formatPlaca(value) {
    var v = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
    return v;
  }

  function formatDni(value) {
    return (value || '').replace(/\D/g, '').slice(0, 8);
  }

  function formatPartida(value) {
    return (value || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 20);
  }

  var VALIDATORS = {
    placa: {
      format: formatPlaca,
      isValid: function (v) { return /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(v); },
      okMsg: 'Formato válido',
      errMsg: 'La placa debe tener 6 caracteres',
      hint: ''
    },
    dni: {
      format: formatDni,
      isValid: function (v) { return /^\d{8}$/.test(v); },
      okMsg: 'DNI válido',
      errMsg: 'El DNI debe tener 8 dígitos',
      hint: ''
    },
    partida: {
      format: formatPartida,
      isValid: function (v) { return v.length >= 5; },
      okMsg: 'Listo',
      errMsg: 'Ingrese un número de partida válido',
      hint: ''
    }
  };

  function ensureHint(input) {
    var hint = input.nextElementSibling;
    if (hint && hint.classList && hint.classList.contains('field-hint')) return hint;
    hint = document.createElement('div');
    hint.className = 'field-hint';
    input.parentNode.insertBefore(hint, input.nextSibling);
    return hint;
  }

  function setState(input, state, msg) {
    input.classList.remove('is-valid', 'is-invalid');
    var hint = ensureHint(input);
    hint.classList.remove('is-error', 'is-ok');
    if (state === 'ok') { input.classList.add('is-valid'); hint.classList.add('is-ok'); }
    else if (state === 'error') { input.classList.add('is-invalid'); hint.classList.add('is-error'); }
    hint.textContent = msg || '';
  }

  function attach(input, type) {
    var v = VALIDATORS[type];
    if (!v) return;
    ensureHint(input).textContent = v.hint;

    input.addEventListener('input', function () {
      var formatted = v.format(input.value);
      if (formatted !== input.value) input.value = formatted;
      if (!formatted) { setState(input, 'idle', v.hint); return; }
      setState(input, v.isValid(formatted) ? 'ok' : 'idle', v.isValid(formatted) ? v.okMsg : v.hint);
    });

    input.addEventListener('blur', function () {
      var val = input.value;
      if (!val) { setState(input, 'idle', v.hint); return; }
      setState(input, v.isValid(val) ? 'ok' : 'error', v.isValid(val) ? v.okMsg : v.errMsg);
    });
  }

  Consultia.setInputValidation = function (input, type) {
    if (!input) return;
    input.dataset.validate = type;
    attach(input, type);
  };

  Consultia.validateInput = function (input) {
    if (!input) return false;
    var type = input.dataset.validate;
    var v = VALIDATORS[type];
    if (!v) return true;
    var ok = v.isValid(input.value);
    setState(input, ok ? 'ok' : 'error', ok ? v.okMsg : v.errMsg);
    return ok;
  };

  Consultia.initValidation = function () {
    document.querySelectorAll('input[data-validate]').forEach(function (input) {
      attach(input, input.dataset.validate);
    });
  };
})();
