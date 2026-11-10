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

  function labelTopic(value) {
    var label = normal(value);
    if (/papeleta|multa|infraccion|deuda/.test(label)) return 'deuda';
    if (/denuncia|antecedente/.test(label)) return 'denuncia';
    if (/\bsoat\b/.test(label)) return 'soat';
    if (/revision.*tecnica|rev tecnica/.test(label)) return 'revision';
    if (/tive|tarjeta.*propiedad|tarjeta unica/.test(label)) return 'tive';
    if (/propietario/.test(label)) return 'propietarios';
    return '';
  }

  function amount(value) {
    var model = Consultia.ReporteModelo;
    if (model && typeof model.aImporte === 'function') return model.aImporte(value);
    var raw = String(value || '').replace(/[^\d,.-]/g, '');
    if (!raw) return null;
    if (raw.indexOf(',') >= 0 && raw.indexOf('.') >= 0) {
      raw = raw.lastIndexOf(',') > raw.lastIndexOf('.')
        ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    } else if (raw.indexOf(',') >= 0) raw = raw.replace(',', '.');
    var parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function sectionFacts(section) {
    var rows = Array.isArray(section.filas) ? section.filas : [];
    var title = normal(section.titulo);
    var titleTopic = labelTopic(title);
    var rowTopics = rows.map(function (row) {
      return labelTopic(row.t === 'kv' ? row.a : row.t === 'row' ? (row.cells || []).join(' ') : row.a);
    });
    var topic = titleTopic || rowTopics.filter(Boolean)[0] || '';
    var text = normal(rows.map(function (row) {
      return row.t === 'kv' ? String(row.a || '') + ' ' + String(row.b || '')
        : row.t === 'row' ? (row.cells || []).join(' ') : String(row.a || '');
    }).join(' '));
    var recordsMatch = title.match(/(\d+)\s*(?:registro|papeleta|denuncia|infraccion)/);
    var records = recordsMatch ? Number(recordsMatch[1]) : null;
    if (topic === 'denuncia' && records == null) {
      if (/sin denuncias|no registra denuncias|ningun antecedente|sin antecedentes|sin registros/.test(text)) records = 0;
      else if (rows.length) records = 1;
    }
    var total = 0, hasAmount = false;
    rows.forEach(function (row) {
      if (row.t !== 'kv') return;
      var key = normal(row.a);
      if (!/deuda|monto|importe|total/.test(key)) return;
      var value = amount(row.b);
      if (value != null) { total += value; hasAmount = true; }
    });
    if (records == null && topic === 'deuda' && rows.length && !/no registra|sin papeleta|sin deuda|sin infraccion/.test(text)) {
      records = 1;
    }
    return { rows: rows, title: title, topic: topic, text: text, records: records, total: total, hasAmount: hasAmount };
  }

  function classifyValue(topic, value) {
    var text = normal(value);
    if (!text || /^(-|n a|sin dato|no disponible|no informado)$/.test(text)) return 'warn';
    if (/\balto\b|critico|grave/.test(text)) return 'issue';
    if (/\bmedio\b|moderado|sin determinar|parcial/.test(text)) return 'warn';
    if (/\bbajo\b/.test(text)) return 'ok';
    if (topic === 'denuncia' || topic === 'deuda') {
      if (/sin denuncias|no registra|ningun antecedente|sin antecedentes|sin registros|sin deuda|sin papeletas|sin infracciones/.test(text)) return 'ok';
      var numeric = topic === 'deuda' ? amount(value) : (/^\d+$/.test(text) ? Number(text) : null);
      if (numeric != null) return numeric > 0 ? 'issue' : 'ok';
      if (/pendiente|registra|denuncia|antecedente|hallazgo|papeleta|multa|infraccion/.test(text)) return 'issue';
      return 'warn';
    }
    if (/vencid|caduc|expir|no vigente|no registra|sin soat|sin revision|no tiene|no cuenta|no hay|no existe|no encontrado|inexistente|falta/.test(text)) return 'issue';
    if (/por vencer|proximo a vencer|observad|pendiente|en tramite/.test(text)) return 'warn';
    if (/vigente|activo|habil|valido|correcto|tramitado|registrado|emitido|\bok\b/.test(text)) return 'ok';
    if (topic === 'propietarios' && Number(text) > 0) return 'ok';
    return 'warn';
  }

  function markerFor(section, summaryItems) {
    var facts = sectionFacts(section);
    var titleTopic = labelTopic(facts.title);
    var indicators = summaryItems.filter(function (item) { return labelTopic(item.label) === facts.topic; });
    var indicatorValues = indicators.map(function (item) { return item.value; });

    if (facts.topic === 'deuda' || facts.topic === 'denuncia') {
      var noRecords = facts.topic === 'denuncia'
        ? /sin denuncias|no registra denuncias|ningun antecedente|sin antecedentes|sin registros/.test(facts.text)
        : /sin deuda|no registra deuda|sin papeletas|no registra papeletas|sin infracciones|sin multas/.test(facts.text);
      if (noRecords) return 'ok';
      if (facts.records > 0 || (facts.hasAmount && facts.total > 0)) return 'issue';
      if (facts.records === 0 || (facts.hasAmount && facts.total === 0)) return 'ok';
      if (facts.rows.length && facts.topic === 'deuda') return 'issue';
      if (indicatorValues.length) {
        var states = indicatorValues.map(function (value) { return classifyValue(facts.topic, value); });
        if (states.indexOf('issue') >= 0) return 'issue';
        if (states.every(function (state) { return state === 'ok'; })) return 'ok';
      }
      return 'warn';
    }

    if (facts.topic === 'soat' || facts.topic === 'revision') {
      // El estado de esta sección manda sobre los indicadores generales:
      // una tarjeta vencida no puede quedar verde por un resumen desfasado.
      var statusField = facts.rows.filter(function (row) {
        return row.t === 'kv' && /estado|vigencia|vencimiento|soat|revision|tecnica/.test(normal(row.a));
      }).map(function (row) { return row.b; });
      var detailState = statusField.map(function (value) { return classifyValue(facts.topic, value); });
      if (detailState.indexOf('issue') >= 0) return 'issue';
      if (detailState.indexOf('ok') >= 0) return 'ok';
      if (indicatorValues.length) return classifyValue(facts.topic, indicatorValues.join(' '));
      return titleTopic === facts.topic ? 'issue' : 'warn';
    }

    if (facts.topic === 'tive') {
      var cardEvidence = facts.title + ' ' + facts.text;
      if (/anulad|cancelad|no registra|no tiene|inexistente/.test(cardEvidence)) return 'issue';
      if (/pendiente|en tramite|por regularizar/.test(cardEvidence)) return 'warn';
      if (/tramitado|registrado|emitido|vigente/.test(cardEvidence)) return 'ok';
      if (facts.rows.length && /codigo de verificacion|numero de titulo|numero de partida|titular/.test(facts.text)) return 'ok';
      return 'warn';
    }
    if (facts.topic === 'propietarios') return facts.rows.length ? 'ok' : 'warn';
    return classifyValue('', facts.text);
  }

  function indicatorState(item) {
    var topic = labelTopic(item.label);
    if (topic) return classifyValue(topic, item.value);
    if (/nivel/.test(normal(item.label))) return classifyValue('', item.value);
    return classifyValue('', item.value);
  }

  function visualState(state) { return state === 'issue' ? 'issue' : 'ok'; }

  function collectPageIndicators(secciones, indicadores) {
    var facts = secciones.map(sectionFacts);
    var tickets = facts.filter(function (item) { return item.topic === 'deuda' && /papeleta|multa|infraccion/.test(item.title); });
    var ticketRecords = tickets.reduce(function (sum, item) { return sum + (item.records == null ? (item.rows.length ? 1 : 0) : item.records); }, 0);
    var ticketAmount = tickets.reduce(function (sum, item) { return sum + item.total; }, 0);
    var hasTicketAmount = tickets.some(function (item) { return item.hasAmount; });
    var unknownTickets = tickets.some(function (item) { return item.records == null && !item.hasAmount; });
    var hasTicketSections = tickets.length > 0;
    var denunciaSections = facts.filter(function (item) { return item.topic === 'denuncia'; });
    var hasDenunciaSections = denunciaSections.length > 0;
    var denunciaRecords = denunciaSections.reduce(function (sum, item) { return sum + (item.records == null ? 0 : item.records); }, 0);
    var out = indicadores.filter(function (item) {
      var label = normal(item.label);
      return !(hasTicketSections && /papeleta|multa|infraccion/.test(label)) &&
        !(hasDenunciaSections && /denuncia|antecedente/.test(label));
    });
    if (hasTicketSections) {
      var ticketText = unknownTickets ? 'Sin dato' : ticketRecords + (ticketRecords === 1 ? ' registro' : ' registros');
      if (hasTicketAmount) ticketText += ' · S/ ' + ticketAmount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      out.unshift({ label: 'Papeletas', value: ticketText, status: unknownTickets ? 'warn' : ticketRecords > 0 || ticketAmount > 0 ? 'issue' : 'ok' });
    }
    if (hasDenunciaSections) {
      var unknownDenuncias = denunciaSections.some(function (item) { return item.records == null; });
      out.push({ label: 'Denuncias', value: unknownDenuncias ? 'Sin dato' : denunciaRecords + (denunciaRecords === 1 ? ' registro' : ' registros'), status: unknownDenuncias ? 'warn' : denunciaRecords > 0 ? 'issue' : 'ok' });
    }
    facts.forEach(function (item) {
      if (item.topic !== 'tive') return;
      if (out.some(function (card) { return /tive|tarjeta.*propiedad|tarjeta unica/.test(normal(card.label)); })) return;
      out.push({ label: 'Tarjeta de propiedad electrónica', value: item.title.match(/tramitad|emitid|registrad|vigente/) ? 'TRAMITADO' : 'Ver detalle', status: markerFor({ titulo: item.title, filas: item.rows }, out) });
    });
    return out;
  }

  function rowsForDisplay(section, rows) {
    if (labelTopic(section.titulo) !== 'tive') return rows;
    var omittingTitular = false;
    return rows.filter(function (row) {
      var raw = row.t === 'kv' ? String(row.a || '') + ' ' + String(row.b || '')
        : row.t === 'row' ? (row.cells || []).join(' ') : String(row.a || '');
      var text = normal(raw);
      if (/titular.*tive|titular.*vehiculo|propietario/.test(text)) {
        omittingTitular = true;
        return false;
      }
      if (/\bdni\b|documento nacional de identidad/.test(text)) return false;
      if (omittingTitular) {
        if (row.t === 'kv' && /codigo de verificacion|numero de titulo|numero de partida|fecha de consulta/.test(normal(row.a))) {
          omittingTitular = false;
          return true;
        }
        return false;
      }
      return true;
    });
  }

  function render(secciones, placa) {
    if (!Array.isArray(secciones) || !secciones.length) return '';
    var resumen = secciones.resumen || {};
    var html = '<div class="rep-pdf-datos"><header class="rep-pdf-datos-head">' +
      '<p class="rep-pdf-eyebrow">Contenido extraído del documento</p>' +
      '<h3>DETALLE DEL REPORTE</h3>' +
      (placa ? '<p class="rep-pdf-placa">Placa consultada <strong>' + esc(placa) + '</strong></p>' : '') +
      '</header>';

    var indicadores = Array.isArray(resumen.indEtiquetas) && Array.isArray(resumen.indValores)
      ? resumen.indEtiquetas.map(function (label, i) {
        return { label: label, value: resumen.indValores[i] };
      }).filter(function (x) { return x.label || x.value; }) : [];
    indicadores = collectPageIndicators(secciones, indicadores);
    if (resumen.score || resumen.nivel || indicadores.length) {
      html += '<section class="rep-pdf-resumen" aria-label="Resumen del documento">';
      if (resumen.score) html += '<div class="rep-pdf-indicador rep-pdf-indicador--' + visualState(indicatorState({ label: 'Puntaje', value: resumen.nivel || resumen.score })) + '"><span>Puntaje del documento</span><strong>' + esc(resumen.score) + '</strong></div>';
      if (resumen.nivel) html += '<div class="rep-pdf-indicador rep-pdf-indicador--' + visualState(indicatorState({ label: 'Nivel', value: resumen.nivel })) + '"><span>Nivel indicado en el documento</span><strong>' + esc(resumen.nivel) + '</strong></div>';
      indicadores.forEach(function (item) {
        var state = item.status || indicatorState(item);
        state = visualState(state);
        html += '<div class="rep-pdf-indicador rep-pdf-indicador--' + state + '"><span>' + esc(item.label) + '</span><strong>' + esc(item.value) + '</strong></div>';
      });
      html += '</section>';
    }

    secciones.forEach(function (section) {
      var filas = Array.isArray(section.filas) ? section.filas : [];
      if (!section.titulo && !filas.length) return;
      var marker = markerFor(section, indicadores);
      var visibleMarker = marker === 'issue' ? 'issue' : 'ok';
      filas = rowsForDisplay(section, filas);
      html += '<section class="rep-pdf-seccion rep-pdf-seccion--' + visibleMarker + '"><h4>' + esc(section.titulo || 'Información adicional') + '</h4>';
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

  Consultia.MetaplaView = { render: render, escapeHtml: esc, _markerFor: markerFor, _sectionFacts: sectionFacts };
  if (typeof module !== 'undefined' && module.exports) module.exports = Consultia.MetaplaView;
})(typeof window !== 'undefined' ? window : globalThis);
