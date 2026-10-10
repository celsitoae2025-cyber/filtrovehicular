/* A receipt is shown only after the MP payment and its ledger row both exist. */
(function () {
  window.Consultia = window.Consultia || {};
  var C = window.Consultia;
  var channel = null;
  var currentUserId = null;
  var pollTimer = null;
  var initialized = false;
  var notified = {};

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function refreshUI() {
    if (C.NV && C.NV.refrescarSaldo) C.NV.refrescarSaldo();
    if (C.Auth && C.Auth.getProfile) {
      C.Auth.getProfile(true).then(function (profile) {
        if (!profile) return;
        C.Auth.getUser().then(function (user) {
          if (!user) return;
          if (C.RightPanel) C.RightPanel.update(user, profile);
          if (C.AuthUI && C.AuthUI.refresh) C.AuthUI.refresh();
        });
      });
    }
  }

  function showReceipt(row) {
    if (notified[row.payment_id]) return;
    notified[row.payment_id] = true;
    var container = document.getElementById('receiptRows');
    if (!container || !C.openModal) return;
    var entries = [
      ['Monto pagado', 'S/ ' + Number(row.amount).toFixed(2)],
      [row.type === 'suscripcion' ? 'Plan activado' : 'Créditos registrados',
        row.type === 'suscripcion' ? row.plan_id : '+' + row.credits],
      ['N.º de operación', row.payment_id]
    ];
    container.replaceChildren();
    entries.forEach(function (entry) {
      var div = document.createElement('div');
      div.className = 'receipt-row';
      var label = document.createElement('span');
      var value = document.createElement('span');
      label.textContent = entry[0];
      value.textContent = entry[1];
      div.append(label, value);
      container.appendChild(div);
    });
    C.openModal('receipt');
  }

  async function checkPayment(userId, paymentId) {
    var sb = C.supabase;
    if (!sb || !userId || !paymentId) return false;
    var payment = await sb.from('payments_mp')
      .select('payment_id, user_id, plan_id, credits, amount, status, type')
      .eq('user_id', userId).eq('payment_id', paymentId).maybeSingle();
    if (payment.error || !payment.data) return false;
    var ledger = await sb.from('transactions')
      .select('id, user_id, type, amount, amount_pen, payment_method, reference, plan_id')
      .eq('user_id', userId).eq('payment_method', 'mercadopago')
      .eq('reference', paymentId);
    if (ledger.error || C.MPReconciliation.assess(payment.data, ledger.data) !== 'movement_recorded') return false;
    showReceipt(payment.data);
    refreshUI();
    stopPolling();
    return true;
  }

  function startPolling(userId, paymentId) {
    if (!paymentId || pollTimer) return;
    var attempts = 0;
    pollTimer = setInterval(function () {
      attempts++;
      if (attempts > 20) { stopPolling(); return; }
      checkPayment(userId, paymentId);
    }, 3000);
    checkPayment(userId, paymentId);
  }

  function checkPaymentReturn(userId) {
    var params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;
    var paymentId = params.get('payment_id');
    history.replaceState(null, '', window.location.pathname + window.location.hash);
    if (/^\d+$/.test(paymentId || '')) startPolling(userId, paymentId);
  }

  function subscribe(userId) {
    if (channel || !userId || !C.supabase) return;
    currentUserId = userId;
    try {
      channel = C.supabase.channel('payment-watcher-' + userId)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'payments_mp',
          filter: 'user_id=eq.' + userId
        }, function (payload) {
          var row = payload.new;
          if (row && row.status === 'approved') checkPayment(userId, String(row.payment_id));
        }).subscribe();
    } catch (e) {
      console.warn('[payment-watcher] realtime unavailable:', e);
    }
  }

  function unsubscribe() {
    if (channel) {
      try { C.supabase.removeChannel(channel); } catch (_) {}
      channel = null;
    }
    currentUserId = null;
    stopPolling();
  }

  function init() {
    if (initialized || !C.Auth) return;
    initialized = true;
    C.Auth.getUser().then(function (user) {
      if (!user) return;
      subscribe(user.id);
      checkPaymentReturn(user.id);
    });
    if (C.Auth.onAuthChange) C.Auth.onAuthChange(function (event, session) {
      if (event === 'SIGNED_OUT') {
        unsubscribe();
        notified = {};
      } else if (session && session.user && session.user.id !== currentUserId) {
        unsubscribe();
        subscribe(session.user.id);
        checkPaymentReturn(session.user.id);
      }
    });
  }

  C.PaymentWatcher = { init: init };
})();
