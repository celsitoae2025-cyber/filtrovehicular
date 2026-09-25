/* ============================================================
   BÚSQUEDA POR NOMBRES (/nm)

   Unas pocas consultas (Reniec: recuperar el segundo apellido, etc.)
   no piden un solo dato sino tres: nombres, apellido paterno y
   apellido materno, y el bot los quiere separados por «|» — el mismo
   camino que ya usaba la plataforma vieja (category-view.js).

   NO hace falta llenar los tres: basta con dos cualquiera —nombre y un
   apellido, o los dos apellidos—. El campo de siempre (#filter-input)
   sigue siendo lo que el motor (filter.js) lee y valida; este módulo
   solo lo esconde, pone estos tres en su lugar, y mantiene su valor
   sincronizado con lo que el bot espera. El motor no se toca.
============================================================ */
(function () {
  'use strict';
  var C = window.Consultia = window.Consultia || {};
  var NV = C.NV;
  var $ = NV.$;

  var activo = false;

  function esDeNombre(consulta) {
    return !!(consulta && consulta.comando && consulta.comando.indexOf('/nm') === 0);
  }

  /* nombres|apPaterno|apMaterno, con los espacios internos de cada campo
     cambiados a «,» (nombres) o «+» (apellidos): así los separa el bot
     sin perder los espacios de un nombre compuesto. */
  function valorCombinado() {
    var nombres = ($('nvNmNombres').value || '').trim();
    var apPat = ($('nvNmApPat').value || '').trim();
    var apMat = ($('nvNmApMat').value || '').trim();
    var llenos = (nombres ? 1 : 0) + (apPat ? 1 : 0) + (apMat ? 1 : 0);
    return {
      llenos: llenos,
      valor: nombres.replace(/\s+/g, ',') + '|' + apPat.replace(/\s+/g, '+') + '|' + apMat.replace(/\s+/g, '+')
    };
  }

  /* Mantiene #filter-input al día en cada tecla: cuando el cliente pulse
     Consultar (lo lea quien lo lea, y en el orden que sea), el valor ya
     está listo. */
  function sincronizar() {
    if (!activo) return;
    $('filter-input').value = valorCombinado().valor;
  }

  function activar() {
    if (activo) return;
    activo = true;
    $('nvBuscador').classList.add('es-nm');
    $('nvNmCampos').hidden = false;
    $('nvNmNombres').value = '';
    $('nvNmApPat').value = '';
    $('nvNmApMat').value = '';
    sincronizar();
    if (window.matchMedia('(hover: hover)').matches) $('nvNmNombres').focus();
  }

  function desactivar() {
    if (!activo) return;
    activo = false;
    $('nvBuscador').classList.remove('es-nm');
    $('nvNmCampos').hidden = true;
  }

  /* Lo llama pantallas.js cada vez que se elige una consulta (tarjeta,
     categoría o Reporte completo no pasa por aquí: nunca es de nombre). */
  NV.actualizarModoNombre = function (consulta) {
    if (esDeNombre(consulta)) activar();
    else desactivar();
  };

  document.addEventListener('DOMContentLoaded', function () {
    ['nvNmNombres', 'nvNmApPat', 'nvNmApMat'].forEach(function (id) {
      var campo = $(id);
      campo.addEventListener('input', sincronizar);
      campo.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); $('filter-consultar').click(); }
      });
    });

    /* En fase de captura: se adelanta al propio filter.js (que también
       escucha este click) para frenar el envío si faltan datos, antes
       de que el motor llegue a cobrar nada. */
    $('filter-consultar').addEventListener('click', function (e) {
      if (!activo) return;
      var r = valorCombinado();
      $('filter-input').value = r.valor;
      if (r.llenos < 2) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (C.toast) C.toast({
          type: 'error', title: 'Faltan datos',
          message: 'Completa al menos dos: nombres y un apellido, o ambos apellidos.'
        });
        $('nvNmNombres').focus();
      }
    }, true);
  });
})();
