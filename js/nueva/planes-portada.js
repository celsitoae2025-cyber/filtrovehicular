/* Vista pública del catálogo, sin iniciar cobros antes de autenticar. */
(function () {
  'use strict';
  var C = window.Consultia;
  var NV = C.NV;
  var dialogo = document.getElementById('nvPlanesDialogo');
  var paquetes = C.CreditPackages;
  if (!dialogo || !paquetes || !paquetes.length) return;
  var abridor;
  var destinoElegido = false;
  var precioMinimo = Math.min.apply(null, paquetes.map(function (p) { return p.precio; }));
  document.getElementById('nvPortadaPrecio').textContent = NV.soles(precioMinimo);
  document.getElementById('nvPlanesOpciones').innerHTML = paquetes.map(function (p) {
    return '<article class="nv-planes-opcion"><h3>' + NV.numero(p.creditos) + ' créditos</h3>' +
      '<strong>' + NV.soles(p.precio) + '</strong><span>Pago por paquete</span></article>';
  }).join('');
  document.querySelectorAll('[data-planes-abrir]').forEach(function (boton) {
    boton.addEventListener('click', function () {
      abridor = boton;
      destinoElegido = false;
      dialogo.showModal();
    });
  });
  dialogo.querySelector('[data-planes-cerrar]').addEventListener('click', function () { dialogo.close(); });
  dialogo.addEventListener('click', function (e) {
    if (e.target === dialogo) {
      var rect = dialogo.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialogo.close();
    }
  });
  dialogo.addEventListener('close', function () {
    if (!destinoElegido && abridor && abridor.isConnected) abridor.focus();
  });
  dialogo.querySelectorAll('[data-planes-destino]').forEach(function (boton) {
    boton.addEventListener('click', function () {
      destinoElegido = true;
      dialogo.close();
      history.replaceState(null, '', location.pathname + location.search + '#pagos');
      NV.verPuerta(boton.dataset.planesDestino);
    });
  });
})();
