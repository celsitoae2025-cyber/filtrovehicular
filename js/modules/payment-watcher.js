/* ============================================================
   PAYMENT WATCHER — detecta pagos acreditados en tiempo real
   y actualiza la UI sin necesidad de recargar la página.

   Dos mecanismos complementarios:
   1. Supabase Realtime: escucha INSERTs en payments_mp del usuario.
   2. Polling fallback: cuando el usuario vuelve de pago-exitoso.html
      (?payment=success), sondea el saldo cada 3s hasta que suba.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var channel = null;
  var currentUserId = null;
  var pollTimer = null;
  var alreadyNotified = false;

  function refreshUI() {
    if (Consultia.Auth && Consultia.Auth.getProfile) {
      Consultia.Auth.getProfile(true).then(function (profile) {
        if (!profile) return;
        Consultia.Auth.getUser().then(function (user) {
          if (!user) return;
          if (Consultia.RightPanel) Consultia.RightPanel.update(user, profile);
          if (Consultia.AuthUI && Consultia.AuthUI.refresh) Consultia.AuthUI.refresh();
          var el = document.getElementById('lowBalanceAlert');
          if (el) el.hidden = true;
        });
      });
    }
  }

  function showReceipt(credits, amount, method, paymentId) {
    var rows = document.getElementById('receiptRows');
    if (!rows || !Consultia.openModal) return;
    var items = [];
    if (amount) items.push(['Monto pagado', 'S/ ' + amount]);
    items.push(['Créditos acreditados', '+' + credits]);
    if (method) items.push(['Método', method]);
    if (paymentId) items.push(['N.º de operación', paymentId]);
    items.push(['Fecha', new Date().toLocaleString('es-PE')]);
    rows.innerHTML = items.map(function (r) {
      return '<div class="receipt-row"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>';
    }).join('');
    Consultia.openModal('receipt');
  }

  function showCreditToast(credits, amount, method, paymentId) {
    if (alreadyNotified) return;
    alreadyNotified = true;
    showReceipt(credits, amount, method, paymentId);
  }

  // --- Mecanismo 1: Supabase Realtime ---
  function subscribe(userId) {
    if (channel || !userId) return;
    var sb = Consultia.supabase;
    if (!sb) return;
    currentUserId = userId;
    try {
      channel = sb.channel('payment-watcher-' + userId)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'payments_mp',
          filter: 'user_id=eq.' + userId
        }, function (payload) {
          var row = payload.new;
          if (!row || row.status !== 'approved') return;
          showCreditToast(row.credits, row.amount, row.mp_payment_method, row.payment_id);
          refreshUI();
          stopPolling();
        })
        .subscribe();
    } catch (e) {
      console.warn('[payment-watcher] realtime no disponible:', e);
    }
  }

  function unsubscribe() {
    if (channel) {
      try { Consultia.supabase.removeChannel(channel); } catch (_) {}
      channel = null;
      currentUserId = null;
    }
  }

  // --- Mecanismo 2: Polling post-pago ---
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function startPolling(userId, initialBalance) {
    if (pollTimer) return;
    var attempts = 0;
    var maxAttempts = 20;
    pollTimer = setInterval(function () {
      attempts++;
      if (attempts > maxAttempts) { stopPolling(); return; }
      var sb = Consultia.supabase;
      if (!sb) return;
      sb.from('profiles').select('credits_balance').eq('id', userId).maybeSingle()
        .then(function (res) {
          if (!res.data) return;
          var current = parseInt(res.data.credits_balance, 10) || 0;
          if (current > initialBalance) {
            var gained = current - initialBalance;
            showCreditToast(gained, '');
            refreshUI();
            stopPolling();
          }
        });
    }, 3000);
  }

  function checkPaymentReturn(userId) {
    var params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;

    // Limpiar el parámetro de la URL sin recargar
    var clean = window.location.pathname + window.location.hash;
    history.replaceState(null, '', clean);

    // Obtener saldo actual e iniciar polling
    var sb = Consultia.supabase;
    if (!sb) return;
    sb.from('profiles').select('credits_balance').eq('id', userId).maybeSingle()
      .then(function (res) {
        var balance = (res.data && parseInt(res.data.credits_balance, 10)) || 0;
        startPolling(userId, balance);
      });
  }

  function init() {
    if (!Consultia.Auth) return;
    Consultia.Auth.getUser().then(function (user) {
      if (!user) return;
      subscribe(user.id);
      checkPaymentReturn(user.id);
    });
    if (Consultia.Auth.onAuthChange) {
      Consultia.Auth.onAuthChange(function (event, session) {
        if (event === 'SIGNED_OUT') {
          unsubscribe();
          stopPolling();
          alreadyNotified = false;
        } else if (session && session.user) {
          if (session.user.id !== currentUserId) {
            unsubscribe();
            subscribe(session.user.id);
          }
        }
      });
    }
  }

  Consultia.PaymentWatcher = { init: init };
})();
