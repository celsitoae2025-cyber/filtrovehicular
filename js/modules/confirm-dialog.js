/* ============================================================
   CONFIRM DIALOG — diálogo de confirmación con estilo del sitio
   Reemplazo de window.confirm() que se ve feo.

   Uso:
     Consultia.confirm({
       title: '¿Cerrar sesión?',
       message: 'Tendrás que volver a iniciar sesión para continuar.',
       confirmText: 'Cerrar sesión',
       cancelText: 'Cancelar',
       danger: true
     }).then(function (ok) { if (ok) { ... } });
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  function ensureContainer() {
    var el = document.getElementById('confirmDialogRoot');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'confirmDialogRoot';
    document.body.appendChild(el);
    return el;
  }

  // Alias con API basada en callbacks — usado por el panel admin
  // (users.js, team.js, broadcasts.js). Internamente reusa Consultia.confirm.
  // Acepta: { title, message, confirmLabel, cancelLabel, confirmStyle:'danger', onConfirm, onCancel }
  Consultia.confirmDialog = function (opts) {
    opts = opts || {};
    Consultia.confirm({
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmLabel || opts.confirmText,
      cancelText: opts.cancelLabel || opts.cancelText,
      danger: opts.confirmStyle === 'danger' || !!opts.danger,
    }).then(function (ok) {
      if (ok) {
        if (typeof opts.onConfirm === 'function') opts.onConfirm();
      } else {
        if (typeof opts.onCancel === 'function') opts.onCancel();
      }
    });
  };

  Consultia.confirm = function (opts) {
    opts = opts || {};
    var title       = opts.title       || '¿Confirmas la acción?';
    var message     = opts.message     || '';
    var confirmText = opts.confirmText || 'Confirmar';
    var cancelText  = opts.cancelText  || 'Cancelar';
    var danger      = !!opts.danger;

    return new Promise(function (resolve) {
      var root = ensureContainer();
      root.innerHTML = [
        '<div class="cd-modal" role="dialog" aria-modal="true">',
        '  <div class="cd-overlay"></div>',
        '  <div class="cd-panel">',
        '    <button class="cd-close" type="button" aria-label="Cerrar">' + CLOSE_SVG + '</button>',
        '    <h3 class="cd-title">' + title + '</h3>',
        (message ? '<p class="cd-message">' + message + '</p>' : ''),
        '    <div class="cd-actions">',
        '      <button class="btn btn-outline cd-cancel" type="button">' + cancelText + '</button>',
        '      <button class="btn cd-confirm' + (danger ? ' cd-confirm-danger' : ' btn-primary') + '" type="button">' + confirmText + '</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.classList.add('confirm-dialog-open');

      function cleanup() {
        document.body.classList.remove('confirm-dialog-open');
        root.innerHTML = '';
        document.removeEventListener('keydown', onKey);
      }
      function onKey(e) {
        if (e.key === 'Escape') { cleanup(); resolve(false); }
        if (e.key === 'Enter' && panel && panel.contains(document.activeElement)) {
          cleanup(); resolve(true);
        }
      }
      document.addEventListener('keydown', onKey);

      var panel = root.querySelector('.cd-panel');
      root.querySelector('.cd-overlay').addEventListener('click', function () { cleanup(); resolve(false); });
      root.querySelector('.cd-close').addEventListener('click', function () { cleanup(); resolve(false); });
      root.querySelector('.cd-cancel').addEventListener('click', function () { cleanup(); resolve(false); });
      root.querySelector('.cd-confirm').addEventListener('click', function () { cleanup(); resolve(true); });

      // Focus al botón Confirmar
      setTimeout(function () {
        var btn = panel && panel.querySelector('.cd-confirm');
        if (btn) btn.focus();
      }, 50);
    });
  };
})();
