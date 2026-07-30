/* ============================================================
   LOW BALANCE ALERT — muestra una alerta cuando el saldo del
   usuario cae por debajo de un umbral mínimo.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var THRESHOLD = 3; // créditos mínimos antes de alertar
  var ALERT_KEY = 'fv-low-balance-dismissed';
  var DISMISS_TTL = 1000 * 60 * 60 * 4; // no volver a mostrar en 4 horas

  function isDismissed() {
    var ts = parseInt(localStorage.getItem(ALERT_KEY) || '0', 10);
    return (Date.now() - ts) < DISMISS_TTL;
  }

  function dismiss() {
    localStorage.setItem(ALERT_KEY, String(Date.now()));
    var el = document.getElementById('lowBalanceAlert');
    if (el) el.hidden = true;
  }

  function show(balance) {
    var existing = document.getElementById('lowBalanceAlert');
    if (existing) { existing.hidden = false; return; }

    var el = document.createElement('div');
    el.id = 'lowBalanceAlert';
    el.className = 'low-balance-alert';
    el.innerHTML =
      '<div class="lba-content">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '<span>Te quedan <strong>' + balance + ' crédito' + (balance === 1 ? '' : 's') + '</strong>. Recarga para seguir consultando.</span>' +
        '<button class="lba-action" data-nav="saldo">Recargar</button>' +
        '<button class="lba-close" aria-label="Cerrar">&times;</button>' +
      '</div>';

    // Insertar después del topbar
    var topbar = document.querySelector('.topbar');
    if (topbar && topbar.parentNode) {
      topbar.parentNode.insertBefore(el, topbar.nextSibling);
    } else {
      document.body.appendChild(el);
    }

    el.querySelector('.lba-close').addEventListener('click', dismiss);
    el.querySelector('.lba-action').addEventListener('click', function () {
      dismiss();
      var navBtn = document.querySelector('[data-nav="saldo"]');
      if (navBtn) navBtn.click();
      else window.location.hash = '#saldo';
    });
  }

  Consultia.checkLowBalance = async function () {
    if (isDismissed()) return;
    try {
      var sb = Consultia.supabase;
      var user = await Consultia.Auth.getUser();
      if (!sb || !user) return;
      var res = await sb.from('profiles').select('credits_balance').eq('id', user.id).single();
      if (res.data) {
        var balance = parseInt(res.data.credits_balance, 10) || 0;
        if (balance <= THRESHOLD && balance >= 0) {
          show(balance);
        }
      }
    } catch (_) {}
  };
})();
