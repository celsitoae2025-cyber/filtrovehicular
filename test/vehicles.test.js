const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlate, validPlate } = require('../js/shared/vehicles.js');

test('saved plates normalize spacing, hyphens and case for matching', () => {
  assert.equal(normalizePlate(' abC - 123 '), 'ABC123');
  assert.equal(normalizePlate('ABC123'), 'ABC123');
  assert.equal(validPlate(' abc-123 '), true);
});

test('saved plates reject markup and implausible lengths', () => {
  assert.equal(validPlate('<script>'), false);
  assert.equal(validPlate('AB1'), false);
  assert.equal(validPlate('ABCDEFGHI'), false);
});
