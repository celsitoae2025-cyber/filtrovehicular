(function (root) {
  function normalizePlate(value) {
    return String(value || '').trim().toUpperCase().replace(/[\s-]/g, '');
  }

  function validPlate(value) {
    return /^[A-Z0-9]{5,8}$/.test(normalizePlate(value));
  }

  root.Consultia = root.Consultia || {};
  root.Consultia.Vehicles = { normalizePlate: normalizePlate, validPlate: validPlate };
  if (typeof module !== 'undefined' && module.exports) module.exports = { normalizePlate: normalizePlate, validPlate: validPlate };
})(typeof window !== 'undefined' ? window : globalThis);
