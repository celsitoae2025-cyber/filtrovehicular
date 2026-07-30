/* ============================================================
   MODULE: Toasts — notificaciones flotantes
   Uso: Consultia.toast({ type:'success'|'error'|'warning'|'info', title, message, duration })
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  function getContainer() {
    var c = document.getElementById('toastContainer');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toastContainer';
      c.className = 'toast-container';
      c.setAttribute('aria-live', 'polite');
      c.setAttribute('aria-atomic', 'true');
      document.body.appendChild(c);
    }
    return c;
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function dismiss(el) {
    if (!el || el.__leaving) return;
    el.__leaving = true;
    el.classList.add('toast-leaving');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
  }

  Consultia.toast = function (opts) {
    opts = opts || {};
    var type = opts.type || 'info';
    var title = opts.title || '';
    var message = opts.message || '';
    var duration = typeof opts.duration === 'number' ? opts.duration : 3800;

    var container = getContainer();
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.setAttribute('role', 'status');

    var bodyHTML = '';
    if (title) bodyHTML += '<strong>' + esc(title) + '</strong>';
    if (message) bodyHTML += '<span>' + esc(message) + '</span>';

    el.innerHTML =
      '<div class="toast-icon">' + (ICONS[type] || ICONS.info) + '</div>' +
      '<div class="toast-body">' + bodyHTML + '</div>' +
      '<button class="toast-close" type="button" aria-label="Cerrar">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>';

    el.querySelector('.toast-close').addEventListener('click', function () { dismiss(el); });
    container.appendChild(el);

    if (duration > 0) setTimeout(function () { dismiss(el); }, duration);
    return el;
  };
})();
