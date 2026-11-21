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
const field = (campo, valor) => ({ campo, valor });

test('un propietario conserva sus apellidos aunque el primer DNI llegue en medio del registro', () => {
  const H = helpers();
  const fields = [field('APELLIDO MATERNO', 'PRUEBA'), field('APELLIDO PATERNO', 'EJEMPLO'), field('DNI', '12345678'), field('ESTADO CIVIL', 'SOLTERO')];
  const records = H.splitIntoRecords(fields);
  assert.equal(records.length, 1);
  assert.equal(records[0].length, 4);
  const html = H.renderDataRows({ secciones: [{ titulo: 'Propietario', campos: fields }] });
  assert.ok(html.indexOf('12345678') < html.indexOf('EJEMPLO'));
  for (const value of ['PRUEBA', 'EJEMPLO', '12345678', 'SOLTERO']) assert.ok(html.includes(value));
  assert.doesNotMatch(html, /Registro 2 de/);
});

test('ordenar la ficha mantiene separados dos propietarios y conserva los valores de ambos', () => {
  const H = helpers();
  const fields = [field('DNI', '11111111'), field('APELLIDO PATERNO', 'UNO'), field('DNI', '22222222'), field('APELLIDO PATERNO', 'DOS')];
  const records = H.splitIntoRecords(fields);
  assert.equal(records.length, 2);
  assert.deepEqual(Array.from(records, record => record.find(row => row.campo === 'DNI').valor), ['11111111', '22222222']);
  const html = H.renderDataRows({ secciones: [{ titulo: 'Propietarios', campos: fields }] });
  for (const value of ['11111111', '22222222', 'UNO', 'DOS']) assert.ok(html.includes(value));
});

test('la ficha vehicular prioriza identificación y aclara abreviaturas sin alterar la respuesta', () => {
  const H = helpers();
  const fields = [field('ALTURA', '1.650'), field('AN MODE', '2020'), field('ANCHO', '1.800'), field('NO VIN', 'VIN-DE-PRUEBA-123'), field('MARCA', 'EJEMPLO'), field('MODELO', 'DEMO'), field('CO CATEG', 'M1'), field('NRO VERSION', 'VERSIÓN DE PRUEBA')];
  const original = JSON.stringify(fields);
  const html = H.renderDataRows({ titulo: 'Consulta vehicular', secciones: [{ titulo: 'Vehículo', campos: fields }] });
  assert.ok(html.indexOf('EJEMPLO') < html.indexOf('DEMO'));
  assert.ok(html.indexOf('DEMO') < html.indexOf('2020'));
  assert.ok(html.indexOf('2020') < html.indexOf('1.650'));
  for (const label of ['Año del modelo', 'Número de VIN', 'Categoría', 'Versión']) assert.ok(html.includes(label));
  for (const row of fields) assert.ok(html.includes(row.valor));
  assert.equal(JSON.stringify(fields), original);
});

test('los rótulos libres separan los grupos y el contenido se escapa', () => {
  const H = helpers();
  const fields = [{ valor: 'PROPIETARIOS (1)' }, field('APELLIDO MATERNO', 'PRUEBA'), field('DNI', '12345678'), { valor: 'VEHICULO' }, field('MODELO', '<img src=x>'), field('MARCA', 'EJEMPLO')];
  const html = H.renderDataRows({ secciones: [{ titulo: 'Foto del Vehículo - ABC123 -', campos: fields }] });
  assert.ok(html.includes('cr-grupo-titulo'));
  assert.ok(html.indexOf('Propietarios (1)') < html.indexOf('12345678'));
  assert.ok(html.indexOf('12345678') < html.indexOf('Vehículo'));
  assert.ok(html.indexOf('Vehículo') < html.indexOf('EJEMPLO'));
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.doesNotMatch(html, /<img src=x>/);
});
