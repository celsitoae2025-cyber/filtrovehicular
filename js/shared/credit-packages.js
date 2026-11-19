/* Catálogo visible compartido por portada y Pagos.
   Los importes de cobro los valida el servidor con el identificador del plan. */
(function () {
  'use strict';
  var C = window.Consultia = window.Consultia || {};
  C.CreditPackages = Object.freeze([
    Object.freeze({ id: 'cp-prof-1', creditos: 200, precio: 15 }),
    Object.freeze({ id: 'cp-prof-2', creditos: 420, precio: 25 }),
    Object.freeze({ id: 'cp-biz-1', creditos: 1800, precio: 90 }),
    Object.freeze({ id: 'cp-biz-2', creditos: 4000, precio: 150 })
  ]);
})();
