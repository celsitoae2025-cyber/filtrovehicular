/* Vista web de las secciones extraídas del PDF del Reporte Completo. */
(function (root) {
  'use strict';
  var Consultia = root.Consultia = root.Consultia || {};

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function render(secciones, placa) {
    if (!Array.isArray(secciones) || !secciones.length) return '';
    var resumen = secciones.resumen || {};
    var html = '<div class="rep-pdf-datos"><header class="rep-pdf-datos-head">' +
      '<p class="rep-pdf-eyebrow">Contenido extraído del documento</p>' +
      '<h3>Detalle del reporte</h3>' +
      (placa ? '<p class="rep-pdf-placa">Placa consultada <strong>' + esc(placa) + '</strong></p>' : '') +
      '</header>';

    var indicadores = Array.isArray(resumen.indEtiquetas) && Array.isArray(resumen.indValores)
      ? resumen.indEtiquetas.map(function (label, i) {
        return { label: label, value: resumen.indValores[i] };
      }).filter(function (x) { return x.label || x.value; }) : [];
    if (resumen.score || resumen.nivel || indicadores.length) {
      html += '<section class="rep-pdf-resumen" aria-label="Resumen del documento">';
      if (resumen.score) html += '<div class="rep-pdf-indicador"><span>Puntaje del documento</span><strong>' + esc(resumen.score) + '</strong></div>';
      if (resumen.nivel) html += '<div class="rep-pdf-indicador"><span>Nivel indicado en el documento</span><strong>' + esc(resumen.nivel) + '</strong></div>';
      indicadores.forEach(function (item) {
        html += '<div class="rep-pdf-indicador"><span>' + esc(item.label) + '</span><strong>' + esc(item.value) + '</strong></div>';
      });
      html += '</section>';
    }

    secciones.forEach(function (section) {
      var filas = Array.isArray(section.filas) ? section.filas : [];
      if (!section.titulo && !filas.length) return;
      html += '<section class="rep-pdf-seccion"><h4>' + esc(section.titulo || 'Información adicional') + '</h4>';
      for (var i = 0; i < filas.length;) {
        var fila = filas[i] || {};
        if (fila.t === 'kv') {
          html += '<dl class="rep-pdf-kv"><div><dt>' + esc(fila.a) + '</dt><dd>' + esc(fila.b) + '</dd></div></dl>';
          i++;
        } else if (fila.t === 'row' && Array.isArray(fila.cells)) {
          var group = [], width = fila.cells.length;
          while (i < filas.length && filas[i] && filas[i].t === 'row' && Array.isArray(filas[i].cells) && filas[i].cells.length === width) {
            group.push(filas[i].cells); i++;
          }
          html += '<div class="rep-pdf-tabla-wrap"><table class="rep-pdf-tabla"><tbody>';
          group.forEach(function (cells) {
            html += '<tr>' + cells.map(function (cell) { return '<td>' + esc(cell) + '</td>'; }).join('') + '</tr>';
          });
          html += '</tbody></table></div>';
        } else if (fila.t === 'sub') {
          html += '<h5 class="rep-pdf-sub">' + esc(fila.a) + '</h5>'; i++;
        } else if (fila.t === 'txt') {
          html += '<p class="rep-pdf-texto">' + esc(fila.a) + '</p>'; i++;
        } else {
          // Tipos desconocidos se conservan en texto cuando tienen contenido.
          var contenido = fila.a || fila.b || '';
          if (contenido) html += '<p class="rep-pdf-texto">' + esc(contenido) + '</p>';
          i++;
        }
      }
      html += '</section>';
    });
    return html + '</div>';
  }

  Consultia.MetaplaView = { render: render, escapeHtml: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = Consultia.MetaplaView;
})(typeof window !== 'undefined' ? window : globalThis);
