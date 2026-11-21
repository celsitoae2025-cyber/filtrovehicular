const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function helpers() {
  const window = { Consultia: {} };
  const context = vm.createContext({ window, Consultia: window.Consultia,
    document: { addEventListener() {} }, console, setTimeout, clearTimeout });
  for (const file of ['consulta-runner.js', 'render-helpers.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/modules', file), 'utf8'), context);
  }
  return window.Consultia.RenderHelpers;
}

function response(count = 10) {
  return {
    medios: Array.from({ length: count }, (_, index) => ({ tipo: 'photo', mimeType: 'image/png', base64: 'imagen' + (index + 1) })),
    bloques: Array.from({ length: count }, (_, index) => ({
      numero: index + 1,
      titulo: 'Papeleta ' + (index + 1),
      medioIndices: [index],
      secciones: [{ titulo: 'General', campos: [
        { campo: 'PLACA', valor: 'A7W118' },
        { campo: 'COD. PAGO', valor: 'codigo' + (index + 1) },
        { campo: 'ESTADO', valor: index % 2 ? 'Medida Cautelar' : 'Pendiente' },
        { campo: 'DEUDA', valor: 'S/. 22.00' },
        { campo: 'F. INFRACCION', valor: 'S/. 16/03/2026' },
      ] }],
    })),
  };
}

test('el aviso sin papeletas solo se aplica a SAT y escapa la placa consultada', () => {
  const H = helpers();
  const p = { sin_papeletas: true, placa: 'M5N535' };
  assert.equal(H.esSatSinPapeletas(p, '/sat {valor}'), true);
  assert.equal(H.esSatSinPapeletas(p, '/placa {valor}'), false);
  assert.equal(H.esSatSinPapeletas({ bloques: [{}] }, '/sat {valor}'), false);
  const html = H.htmlSatSinPapeletas(p, 'm5n535<img>');
  assert.match(html, /role="status"/);
  assert.match(html, /M5N535&lt;IMG&gt;/);
  assert.doesNotMatch(html, /<IMG>|Descargar|cr-loading/);
});

test('SAT conserva diez papeletas con su información e imagen en bloques independientes', () => {
  const payload = response();
  const original = JSON.stringify(payload);
  const html = helpers().renderDataWithMedia(payload, payload.medios);
  assert.match(html, /10 papeletas recibidas/);
  const blocks = [...html.matchAll(/<article class="cr-sat-bloque"[^>]*>([\s\S]*?)<\/article>/g)];
  assert.equal(blocks.length, 10);
  assert.equal((html.match(/<img /g) || []).length, 10);
  blocks.forEach((block, index) => {
    assert.match(block[1], new RegExp('codigo' + (index + 1) + '<'));
    assert.match(block[1], new RegExp('base64,imagen' + (index + 1) + '"'));
    assert.match(block[1], /A7W118/);
    assert.match(block[1], /S\/\. 22\.00/);
    assert.match(block[1], /16\/03\/2026/);
    assert.doesNotMatch(block[1], /S\/\. 16\/03\/2026/);
  });
  assert.equal(JSON.stringify(payload), original);
});

test('SAT no desplaza la imagen siguiente cuando una papeleta viene sin foto y conserva adjuntos sueltos', () => {
  const payload = response(3);
  payload.bloques[1].medioIndices = [];
  payload.bloques[2].medioIndices = [1];
  const html = helpers().renderDataWithMedia(payload, payload.medios);
  const blocks = [...html.matchAll(/<article class="cr-sat-bloque"[^>]*>([\s\S]*?)<\/article>/g)];
  assert.doesNotMatch(blocks[1][1], /<img /);
  assert.match(blocks[2][1], /base64,imagen2"/);
  assert.match(html, /Imágenes adicionales[\s\S]*base64,imagen3"/);
  assert.equal((html.match(/<img /g) || []).length, 3);
});

test('SAT conserva valores repetidos en diferentes papeletas y escapa los datos de la fuente', () => {
  const payload = response(2);
  payload.bloques[0].titulo = '<script>alert(1)</script>';
  payload.bloques[0].secciones[0].campos.push({ campo: 'OBSERVACIÓN', valor: '<img src=x onerror=alert(1)>' });
  const html = helpers().renderDataWithMedia(payload, payload.medios);
  assert.equal((html.match(/A7W118/g) || []).length, 2);
  assert.equal((html.match(/S\/\. 22\.00/g) || []).length, 2);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<script>|<img src=x/);
});

test('SAT identifica el total del proveedor sin confundirlo con el índice de la papeleta', () => {
  const payload = response(1);
  payload.bloques[0].secciones[0].campos.unshift({ campo: '', valor: 'Información de papeleta: 10' });
  const html = helpers().renderDataWithMedia(payload, payload.medios);
  assert.match(html, /Total de papeletas<\/span><span class="cr-v">10<\/span>/);
  assert.match(html, /class="cr-sat-titulo">Papeleta 1</);
});
