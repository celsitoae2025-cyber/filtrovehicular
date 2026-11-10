/* Vista web de las secciones extraídas del PDF del Reporte Completo. */
(function (root) {
  'use strict';
  var Consultia = root.Consultia = root.Consultia || {};

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function normal(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function topicOf(section, rows) {
    var title = normal(section.titulo);
    var labels = rows.map(function (row) {
      if (row.t === 'kv') return normal(row.a);
      if (row.t === 'row') return normal((row.cells || []).join(' '));
      return '';
    }).join(' ');
    var source = title + ' ' + labels;
    if (/denuncia|antecedente/.test(source)) return 'denuncia';
    if (/\bsoat\b/.test(source)) return 'soat';
    if (/revision.*tecnica|rev tecnica/.test(source)) return 'revision';
    if (/deuda|papeleta|infraccion/.test(source)) return 'deuda';
    return '';
  }

  function markerFor(section, rows, summaryItems) {
    var topic = topicOf(section, rows);
    if (!topic) return '';
    var normalizedTitle = normal(section.titulo);
    var titleNamesTopic = topic === 'soat' ? /\bsoat\b/.test(normalizedTitle)
      : topic === 'revision' ? /revision.*tecnica|rev tecnica/.test(normalizedTitle)
      : false;
    var matches = summaryItems.filter(function (item) {
      var label = normal(item.label);
      return topic === 'denuncia' ? /denuncia|antecedente/.test(label)
        : topic === 'soat' ? /\bsoat\b/.test(label)
        : topic === 'revision' ? /revision.*tecnica|rev tecnica/.test(label)
        : /deuda|papeleta|infraccion/.test(label);
    });
    var sectionEvidence = rows.map(function (row) {
      if (row.t === 'kv') return String(row.a || '') + ' ' + String(row.b || '');
      if (row.t === 'row') return (row.cells || []).join(' ');
      return String(row.a || '');
    }).join(' ');
    var evidence = normal(matches.length ? matches.map(function (x) { return x.value; }).join(' ') : sectionEvidence);
    if (!evidence || /^(-|n a|sin dato|no disponible|no informado)$/.test(evidence)) {
      return titleNamesTopic && (topic === 'soat' || topic === 'revision') ? 'issue' : '';
    }

    if (topic === 'denuncia') {
      if (/sin denuncias|no registra|ningun antecedente|sin antecedentes|sin registros/.test(evidence)) return 'ok';
      var count = evidence.match(/\b\d+\b/);
      if (count) return Number(count[0]) > 0 ? 'issue' : 'ok';
      if (/registra|denuncia|antecedente|hallazgo/.test(evidence)) return 'issue';
      return '';
    }
    if (topic === 'deuda') {
      if (/sin deuda|no registra deuda|sin papeletas|sin infracciones/.test(evidence)) return 'ok';
      var amount = evidence.match(/(?:s\s*)?\b\d[\d,.]*/);
      if (amount) {
        var numeric = Number(amount[0].replace(/[^\d,.-]/g, '').replace(',', '.'));
        if (Number.isFinite(numeric)) return numeric > 0 ? 'issue' : 'ok';
      }
    }
    if (/vencid|caduc|expir|no vigente|no registra|sin soat|sin revision|no tiene|no cuenta|no hay|no existe|no encontrado|inexistente|falta/.test(evidence)) return 'issue';
    if (/vigente|activo|habil|valido|correcto|\bok\b/.test(evidence)) return 'ok';
    return '';
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
      var marker = markerFor(section, filas, indicadores);
      html += '<section class="rep-pdf-seccion' + (marker ? ' rep-pdf-seccion--' + marker : '') + '"><h4>' + esc(section.titulo || 'Información adicional') + '</h4>';
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

  Consultia.MetaplaView = { render: render, escapeHtml: esc, _markerFor: markerFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = Consultia.MetaplaView;
})(typeof window !== 'undefined' ? window : globalThis);
