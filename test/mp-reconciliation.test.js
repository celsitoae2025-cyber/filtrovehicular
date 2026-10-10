const test = require('node:test');
const assert = require('node:assert/strict');
const { assess } = require('../js/shared/mp-reconciliation.js');

const payment = {
  payment_id: 'mp-123', user_id: 'user-1', status: 'approved',
  type: 'recarga', plan_id: 'cp-prof-1', credits: 200, amount: 15,
};
const movement = {
  reference: 'mp-123', user_id: 'user-1', payment_method: 'mercadopago',
  type: 'purchase', plan_id: 'cp-prof-1', amount: 200, amount_pen: 15,
};

test('a matching credit movement is recorded', () => {
  assert.equal(assess(payment, [movement]), 'movement_recorded');
});

test('missing and duplicate movements require review', () => {
  assert.equal(assess(payment, []), 'missing_movement');
  assert.equal(assess(payment, [movement, { ...movement }]), 'duplicate_movement');
});

test('a movement for another user or another amount cannot settle a payment', () => {
  assert.equal(assess(payment, [{ ...movement, user_id: 'user-2' }]), 'missing_movement');
  assert.equal(assess(payment, [{ ...movement, amount: 100 }]), 'different_movement');
  assert.equal(assess(payment, [{ ...movement, amount_pen: 20 }]), 'different_movement');
});

test('older movements without amount_pen and subscriptions are handled', () => {
  assert.equal(assess(payment, [{ ...movement, amount_pen: null }]), 'movement_recorded');
  assert.equal(assess({ ...payment, type: 'suscripcion' }, [
    { ...movement, type: 'subscription', amount: 0 },
  ]), 'movement_recorded');
});

test('unapproved and unexpected payment types never appear settled', () => {
  assert.equal(assess({ ...payment, status: 'pending' }, [movement]), 'not_approved');
  assert.equal(assess({ ...payment, type: 'unknown' }, [movement]), 'different_movement');
});
