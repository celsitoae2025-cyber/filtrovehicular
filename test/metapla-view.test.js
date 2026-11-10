const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../js/modules/metapla-view.js');

test('renderiza resumen, secciones, pares, tablas y texto del PDF', () => {
  const sections = [
    { titulo: 'I. IDENTIFICACIÓN', filas: [
      { t: 'kv', a: 'Marca', b: 'Toyota' },
      { t: 'row', cells: ['Fecha', 'Estado'] },
      { t: 'row', cells: ['2026', 'Vigente'] },
      { t: 'sub', a: '1.1 Observaciones' },
      { t: 'txt', a: 'Sin observaciones registradas.' },
    ] },
  ];
  sections.resumen = { score: '72', nivel: 'MEDIO', indEtiquetas: ['SOAT'], indValores: ['VIGENTE'] };
  const html = render(sections, 'ABC123');
  for (const content of ['ABC123', '72', 'MEDIO', 'I. IDENTIFICACIÓN', 'Toyota', 'Vigente', 'Sin observaciones']) {
    assert.ok(html.includes(content), `falta ${content}`);
  }
  assert.match(html, /<table class="rep-pdf-tabla">/);
});

test('escapa texto extraído del PDF antes de insertarlo como HTML', () => {
  const html = render([{ titulo: '<script>', filas: [{ t: 'txt', a: '<img src=x onerror=alert(1)>' }] }]);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('sin secciones no genera contenido vacío ni valores inventados', () => {
  assert.equal(render([], 'ABC123'), '');
  assert.equal(render(null, 'ABC123'), '');
});
