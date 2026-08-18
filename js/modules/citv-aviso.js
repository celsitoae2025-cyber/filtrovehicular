/* ============================================================
   DUPLICADO CITV — el aviso del tiempo de emisión
   ------------------------------------------------------------
   Antes este acceso mandaba a WhatsApp de una. Ahora abre un aviso:
   el duplicado no sale al instante y el cliente tiene derecho a
   saberlo ANTES, no mientras espera sin entender por qué tarda.

   Dice también qué es un CITV. La sigla la usa todo el mundo en el
   rubro y casi nadie fuera de él: escribirla sin explicar deja
   afuera justo a quien viene a preguntar.

   Reusa el esqueleto del modal del Reporte Completo (.rep-modal):
   mismo cuadro, mismo fondo, mismo botón. Solo cambia el contenido.
============================================================ */

(function () {
  window.Consultia = window.Consultia || {};

  var CERRAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var RELOJ_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';

  function htmlAviso() {
    return '' +
      '<div class="citv-aviso">' +
        '<header class="citv-membrete">' +
          '<span class="citv-chip">Trámite en línea</span>' +
          '<h4 class="citv-titulo">Duplicado de CITV</h4>' +
          '<p class="citv-sigla">Certificado de Inspección Técnica Vehicular</p>' +
          '<div class="citv-linea"><span></span><span></span><span></span><span></span></div>' +
        '</header>' +

        '<div class="citv-cuerpo">' +
          '<div class="citv-tiempo">' +
            '<span class="citv-tiempo-ico">' + RELOJ_SVG + '</span>' +
            '<div>' +
              '<strong class="citv-tiempo-cifra">Hasta 30 minutos</strong>' +
              '<span class="citv-tiempo-txt">Es el máximo. Casi siempre llega antes.</span>' +
            '</div>' +
          '</div>' +

          '<p class="citv-texto">Tu duplicado se solicita al registro y se emite el mismo día. ' +
          'No hace falta que estés pendiente: apenas esté listo te llega.</p>' +

          '<ul class="citv-puntos">' +
            '<li>Es el mismo certificado, con la validez de siempre.</li>' +
            '<li>Sirve para el original perdido, deteriorado o ilegible.</li>' +
            '<li>Si algo impide emitirlo, te avisamos y no se te cobra.</li>' +
          '</ul>' +
        '</div>' +
      '</div>';
  }

  function abrir() {
    var previo = document.getElementById('citv-modal');
    if (previo) previo.remove();

    var root = document.createElement('div');
    root.id = 'citv-modal';
    root.className = 'rep-modal citv-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Duplicado de CITV');
    root.innerHTML =
      '<div class="rep-modal-fondo"></div>' +
      '<div class="rep-modal-caja">' +
        '<button class="rep-modal-cerrar" type="button" aria-label="Cerrar">' + CERRAR_SVG + '</button>' +
        htmlAviso() +
        '<div class="rep-modal-pie"><button class="rep-modal-ok" type="button">Entendido</button></div>' +
      '</div>';
    document.body.appendChild(root);
    document.body.classList.add('modal-open');
    // Un fotograma de margen para que el navegador vea el estado inicial y
    // el cuadro entre animado en vez de aparecer puesto.
    requestAnimationFrame(function () { root.classList.add('is-abierto'); });

    function cerrar() {
      document.removeEventListener('keydown', alPulsarTecla);
      document.body.classList.remove('modal-open');
      root.remove();
    }
    function alPulsarTecla(e) { if (e.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', alPulsarTecla);
    root.querySelector('.rep-modal-fondo').addEventListener('click', cerrar);
    root.querySelector('.rep-modal-cerrar').addEventListener('click', cerrar);
    root.querySelector('.rep-modal-ok').addEventListener('click', cerrar);
    setTimeout(function () {
      var b = root.querySelector('.rep-modal-ok');
      if (b) b.focus();
    }, 50);
  }

  Consultia.CitvAviso = { abrir: abrir };

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('navCitv');
    if (btn) btn.addEventListener('click', abrir);
  });
})();
