/* Compara un pago aprobado con el movimiento contable del mismo MP ID.
   Un movimiento ausente o incoherente requiere revision humana: el saldo
   historico pudo haberse modificado aunque el movimiento haya fallado. */
(function (root) {
  function assess(payment, transactions) {
    if (!payment || payment.status !== 'approved') return 'not_approved';
    var matches = (transactions || []).filter(function (tx) {
      return tx.payment_method === 'mercadopago' &&
        String(tx.reference || '') === String(payment.payment_id) &&
        String(tx.user_id || '') === String(payment.user_id || '');
    });
    if (!matches.length) return 'missing_movement';
    if (matches.length > 1) return 'duplicate_movement';

    var tx = matches[0];
    if (payment.type !== 'recarga' && payment.type !== 'suscripcion') {
      return 'different_movement';
    }
    if (payment.type === 'recarga' &&
        (tx.type !== 'purchase' || Number(tx.amount) !== Number(payment.credits))) {
      return 'different_movement';
    }
    if (payment.type === 'suscripcion' && tx.type !== 'subscription') {
      return 'different_movement';
    }
    if (tx.plan_id && tx.plan_id !== payment.plan_id) return 'different_movement';
    if (tx.amount_pen != null &&
        Math.abs(Number(tx.amount_pen) - Number(payment.amount)) > 0.01) {
      return 'different_movement';
    }
    return 'movement_recorded';
  }

  root.Consultia = root.Consultia || {};
  root.Consultia.MPReconciliation = { assess: assess };
  if (typeof module !== 'undefined' && module.exports) module.exports = { assess: assess };
})(typeof window !== 'undefined' ? window : globalThis);
