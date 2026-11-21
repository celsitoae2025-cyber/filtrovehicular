const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function helpers() {
  const Consultia = { ConsultaRunner: { toTitleCase: value => value } };
  const context = vm.createContext({ window: { Consultia }, Consultia, document: { addEventListener() {} }, console, setTimeout, clearTimeout });
  for (const file of ['consulta-runner.js', 'render-helpers.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/modules', file), 'utf8'), context);
  }
  return Consultia.RenderHelpers;
}

test('tres mensajes familiares se presentan como tres filas con DNI y edad separados', () => {
  const H = helpers();
  const raw = [
    'ARBOL GENEALOGICO - DNI',
    'DNI ➾ 11111111 Edad ➾ 50',
    'PRENOMBRES ➾ ANA', 'APELLIDOS ➾ PRUEBA UNO', 'GENERO ➾ FEMENINO', 'RELACION ➾ MADRE',
    'DNI ➾ 22222222 Edad ➾ 30',
    'PRENOMBRES ➾ LUIS', 'APELLIDOS ➾ PRUEBA DOS', 'GENERO ➾ MASCULINO', 'RELACION ➾ HERMANO',
    'DNI ➾ 33333333 Edad ➾ 24',
    'PRENOMBRES ➾ EVA', 'APELLIDOS ➾ PRUEBA TRES', 'GENERO ➾ FEMENINO', 'RELACION ➾ HERMANA'
  ].join('\n');
  const parsed = { raw, tabla: { filas: [{ dni: '11111111 Edad 50' }] } };
  const rows = H.parseArbolGenealogico(parsed);
  assert.equal(rows.length, 3);
  assert.deepEqual(Array.from(rows, row => [row.dni, row.edad, row.nombres]), [
    ['11111111', '50', 'ANA'], ['22222222', '30', 'LUIS'], ['33333333', '24', 'EVA']
  ]);
  const html = H.renderArbolGenealogico(parsed, '11111111');
  assert.match(html, /class="nm-results cr-arbol"/);
  assert.match(html, /3 resultados/);
  assert.match(html, /data-label="DNI">11111111<\/td><td data-label="Nombres">ANA<\/td><td data-label="Apellidos">PRUEBA UNO<\/td><td data-label="Edad">50<\/td>/);
  assert.match(html, /cr-arbol-sin-verificacion/);
  assert.doesNotMatch(html, /<th>VERIFICACIÓN<\/th>/);
  assert.match(html, /cr-btn-arbol-pdf/);
});

test('conserva la columna de verificación cuando el proveedor la entrega', () => {
  const H = helpers();
  const html = H.renderArbolGenealogico({ raw: 'DNI ➾ 55555555 Edad ➾ 45\nPRENOMBRES ➾ ALBA\nVERIFICACION ➾ ALTO' }, '55555555');
  assert.match(html, /<th>VERIFICACIÓN<\/th>/);
  assert.match(html, /data-label="Verificación">ALTO<\/td>/);
});

test('tabla familiar enriquecida funciona si no hay texto legible', () => {
  const H = helpers();
  const rows = H.parseArbolGenealogico({ tabla: { filas: [
    { dni: '44444444 Edad 62', nombres: 'PERSONA', apellidos: 'DE PRUEBA', genero: 'F', tipo: 'PADRE' }
  ] } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].dni, '44444444');
  assert.equal(rows[0].edad, '62');
  assert.equal(rows[0].relacion, 'PADRE');
});

test('la tabla del primer bloque no oculta personas de bloques posteriores', () => {
  const H = helpers();
  const raw = [
    'DNI: 11111111 Edad: 50\nPRENOMBRES: ANA',
    '2\t22222222 Edad 45\tLUIS\tDOS\tMASCULINO\tPADRE',
    '3  33333333  42  EVA  TRES  FEMENINO  MADRE',
    '4\t44444444\tLUZ\tCUATRO\tFEMENINO\tHERMANA\t20'
  ].join('\n\n');
  const tabla = { filas: [
    { dni: '11111111', nombres: 'ANA' }, { dni: '22222222', nombres: 'LUIS' },
    { dni: '33333333', nombres: 'EVA' }, { dni: '55555555', nombres: 'OTRA' },
    { dni: '66666666', nombres: 'OTRO' }
  ] };
  const rows = H.parseArbolGenealogico({ raw, tabla });
  assert.deepEqual(Array.from(rows, row => row.dni), [
    '11111111', '22222222', '33333333', '55555555', '66666666', '44444444'
  ]);
  assert.equal(rows[3].nombres, 'OTRA');
  assert.equal(rows[5].edad, '20');
});
