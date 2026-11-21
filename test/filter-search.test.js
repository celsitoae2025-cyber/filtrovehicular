const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function search(options = {}) {
  let focused = null;
  const calls = { auth: 0, runner: 0, errors: [], notices: [] };
  const classes = () => {
    const values = new Set();
    return { add: (...names) => names.forEach(n => values.add(n)), remove: (...names) => names.forEach(n => values.delete(n)), contains: n => values.has(n), toggle(n, on) { const next = on === undefined ? !values.has(n) : on; next ? values.add(n) : values.delete(n); return next; } };
  };
  const element = () => ({
    hidden: false, value: '', innerHTML: '', textContent: '', disabled: false,
    classList: classes(), style: {}, dataset: {}, offsetWidth: 160, children: [], listeners: {},
    attributes: {}, setAttribute(n, v) { this.attributes[n] = v; }, removeAttribute(n) { delete this.attributes[n]; },
    addEventListener(n, fn) { (this.listeners[n] ||= []).push(fn); },
    click() { return this.disabled ? Promise.resolve() : Promise.all((this.listeners.click || []).map(fn => fn({ target: this }))); },
    focus() { focused = this; }, scrollIntoView() {}, contains() { return false; }, closest() { return null; },
    querySelectorAll() { return []; }, querySelector() { return null; },
    appendChild(child) { child.parentNode = this; this.children.push(child); },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); },
  });
  const ids = ['filterCombo', 'filterComboBtn', 'filterComboText', 'filterComboPanel', 'filter-desc', 'filter-input', 'filter-consultar', 'filter-empty-desc', 'filter-empty', 'filter-result-body', 'filterResultStatus', 'filter-result', 'filter-preview-data', 'nvDatoEtiqueta', 'nvNmCampos', 'nvNmNombres', 'nvNmApPat', 'nvNmApMat', 'nvCambiarConsulta', 'nvConsultaSeleccion'];
  const elements = Object.fromEntries(ids.map(id => [id, element()]));
  elements['filter-consultar'].innerHTML = '<span>Buscar</span>';
  elements.nvNmCampos.hidden = true;
  const header = element();
  header.querySelector = selector => header.children.find(c => '.' + c.className === selector) || null;
  const view = element();
  view.classList.add('nv-pantalla');
  view.querySelector = selector => selector === '.result-panel .result-header' ? header : null;
  const document = {
    getElementById: id => elements[id] || null,
    querySelector: selector => selector.includes('data-pantalla="consultar"') ? view : null,
    querySelectorAll: () => [], addEventListener() {}, createElement: element,
  };
  const response = { parsed: { raw: 'Resultado de ejemplo para una prueba local.', secciones: [], medios: [] }, costo_deducido: 0 };
  const C = {
    Auth: { getUser: async () => { calls.auth++; return options.auth ? options.auth() : { id: 'unit-test-only' }; } },
    ConsultaRunner: {
      loadCatalog: async () => options.catalog || [{ id: 'sample', categoria: 'filter', nombre: 'Consulta por placa', tipo_dato: 'placa', precio_venta: 5, comando: '/sample' }],
      ejecutarConsultaConCobro: async () => { calls.runner++; return options.run ? options.run(calls.runner, response) : response; },
    },
    toast: notice => calls.notices.push(notice),
  };
  const window = { Consultia: C, scrollTo() {} };
  const context = vm.createContext({ window, Consultia: C, document, navigator: {}, console: { error: (...args) => calls.errors.push(args), warn() {} }, setTimeout, clearTimeout, localStorage: { getItem() { return null; } }, Date });
  for (const file of ['render-helpers.js', 'filter.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/modules', file), 'utf8'), context);
  }
  C.initFilterCombo();
  await C.FilterView.whenReady();
  return { C, elements, calls, view, header, get focused() { return focused; } };
}

test('SAT sin papeletas muestra un aviso terminal con placa y habilita otra consulta', async () => {
  const s = await search({
    catalog: [{ id: 'sat', categoria: 'filter', nombre: 'SAT Papeletas', tipo_dato: 'placa', precio_venta: 4, comando: '/sat {valor}' }],
    run: async () => ({ sin_resultados: true, costo_deducido: 0, parsed: {
      sin_papeletas: true, placa: 'M5N535', mensaje: 'No cuenta con papeletas',
      raw: 'No hay datos para la placa M5N535. No se pudo extraer información para M5N535. Por favor, asegúrese de que los datos sean correctos.',
      secciones: [], medios: [], bloques: [],
    } }),
  });
  s.elements['filter-input'].value = 'm5n535';
  await s.elements['filter-consultar'].click();
  const html = s.elements['filter-result-body'].innerHTML;
  assert.match(html, /No cuenta con papeletas/);
  assert.match(html, /Placa: <strong>M5N535<\/strong>/);
  assert.doesNotMatch(html, /Servicio en mantenimiento|consulta sigue en curso|Descargar|cr-loading/);
  assert.equal(s.calls.runner, 1);
  assert.equal(s.elements['filter-consultar'].disabled, false);
  assert.equal(s.elements['filter-input'].disabled, false);
  assert.equal(s.elements['filter-result-body'].hidden, false);
  assert.deepEqual(s.calls.errors, []);
});

test('la consulta seleccionada tiene etiqueta, campo y una acción Buscar conectada', async () => {
  const s = await search();
  assert.equal(s.elements.nvDatoEtiqueta.textContent, 'Placa del vehículo');
  s.elements['filter-input'].value = 'ABC123';
  await s.elements['filter-consultar'].click();
  assert.equal(s.calls.runner, 1);
  assert.deepEqual(s.calls.errors, []);
  assert.equal(s.view.classList.contains('tiene-resultado'), true);
  assert.equal(s.elements['filter-consultar'].disabled, false);
  assert.equal(s.elements['filter-input'].disabled, false);
});

test('un dato vacío no ejecuta la consulta y devuelve el foco al campo', async () => {
  const s = await search();
  await s.elements['filter-consultar'].click();
  assert.equal(s.calls.runner, 0);
  assert.equal(s.focused, s.elements['filter-input']);
});

test('Enter y clic repetidos durante la lectura de sesión solo envían una búsqueda', async () => {
  let resolveAuth;
  const pendingAuth = new Promise(resolve => { resolveAuth = resolve; });
  const s = await search({ auth: () => pendingAuth });
  s.elements['filter-input'].value = 'ABC123';
  const first = s.elements['filter-consultar'].click();
  await s.elements['filter-consultar'].click();
  s.elements['filter-input'].listeners.keydown[0]({ key: 'Enter', preventDefault() {} });
  assert.equal(s.calls.auth, 1);
  resolveAuth({ id: 'unit-test-only' });
  await first;
  assert.equal(s.calls.runner, 1);
});

test('Nueva consulta limpia el resultado y enfoca el campo para buscar otra placa', async () => {
  const s = await search();
  s.elements['filter-input'].value = 'ABC123';
  await s.elements['filter-consultar'].click();
  const restart = s.header.querySelector('.cr-nueva');
  assert.ok(restart);
  await restart.click();
  assert.equal(s.view.classList.contains('tiene-resultado'), false);
  assert.equal(s.elements['filter-input'].value, '');
  assert.equal(s.elements['filter-result'].hidden, true);
  assert.equal(s.focused, s.elements['filter-input']);
  s.elements['filter-input'].value = 'DEF456';
  await s.elements['filter-consultar'].click();
  assert.equal(s.calls.runner, 2);
});

test('un error de consulta libera Buscar y conserva el dato para reintentar', async () => {
  const s = await search({ run: (count, response) => { if (count === 1) throw new Error('Fallo de prueba'); return response; } });
  s.elements['filter-input'].value = 'ABC123';
  await s.elements['filter-consultar'].click();
  assert.equal(s.elements['filter-consultar'].disabled, false);
  assert.equal(s.elements.nvCambiarConsulta.disabled, false);
  assert.equal(s.elements['filter-input'].value, 'ABC123');
  await s.elements['filter-consultar'].click();
  assert.equal(s.calls.runner, 2);
  assert.equal(s.view.classList.contains('tiene-resultado'), true);
});

test('volver al catálogo elimina el modo resultado sin mover el foco al buscador', async () => {
  const s = await search();
  s.elements['filter-input'].value = 'ABC123';
  await s.elements['filter-consultar'].click();
  s.C.FilterView.resetResult();
  assert.equal(s.view.classList.contains('tiene-resultado'), false);
  assert.equal(s.elements['filter-result-body'].innerHTML, '');
  assert.equal(s.elements['filter-result'].hidden, true);
  assert.equal(s.focused, null);
});

test('una respuesta tardía no reabre el resultado después de volver al catálogo', async () => {
  let resolveResponse;
  const pending = new Promise(resolve => { resolveResponse = resolve; });
  const s = await search({ run: () => pending });
  s.elements['filter-input'].value = 'ABC123';
  const submission = s.elements['filter-consultar'].click();
  await new Promise(setImmediate);
  assert.equal(s.calls.runner, 1);
  s.C.FilterView.resetResult();
  resolveResponse({ parsed: { raw: 'Resultado de prueba local.', secciones: [], medios: [] }, costo_deducido: 0 });
  await submission;
  assert.equal(s.elements['filter-result'].hidden, true);
  assert.equal(s.view.classList.contains('tiene-resultado'), false);
  assert.equal(s.elements['filter-consultar'].disabled, false);
});

test('Nueva consulta limpia los tres campos de nombres y enfoca el primero', async () => {
  const s = await search();
  s.elements['filter-input'].value = 'ABC123';
  await s.elements['filter-consultar'].click();
  s.elements.nvNmCampos.hidden = false;
  for (const id of ['nvNmNombres','nvNmApPat','nvNmApMat']) s.elements[id].value = 'Texto';
  await s.header.querySelector('.cr-nueva').click();
  for (const id of ['nvNmNombres','nvNmApPat','nvNmApMat']) assert.equal(s.elements[id].value, '');
  assert.equal(s.focused, s.elements.nvNmNombres);
});

test('un fallo al leer la sesión no deja bloqueadas búsquedas posteriores', async () => {
  let attempts = 0;
  const s = await search({ auth: () => { if (++attempts === 1) throw new Error('Sin conexión'); return { id: 'unit-test-only' }; } });
  s.elements['filter-input'].value = 'ABC123';
  await s.elements['filter-consultar'].click();
  assert.equal(s.calls.runner, 0);
  await s.elements['filter-consultar'].click();
  assert.equal(s.calls.runner, 1);
});

test('la espera muestra un estado accesible y se reemplaza al recibir el resultado', async () => {
  let deliver;
  const pending = new Promise(resolve => { deliver = resolve; });
  const s = await search({ run: () => pending });
  s.elements['filter-input'].value = 'ABC123';
  const running = s.elements['filter-consultar'].click();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.match(s.elements['filter-result-body'].innerHTML, /fv-query-loading/);
  assert.match(s.elements['filter-result-body'].innerHTML, /role="status"/);
  assert.equal(s.elements['filter-result'].hidden, false);
  assert.equal(s.elements['filter-consultar'].disabled, true);
  deliver({ parsed: { raw: 'PLACA ABC123, resultado de la prueba local.', secciones: [], medios: [] }, costo_deducido: 0 });
  await running;
  assert.doesNotMatch(s.elements['filter-result-body'].innerHTML, /fv-query-loading/);
  assert.equal(s.elements['filter-consultar'].disabled, false);
  assert.equal(s.elements['filter-input'].disabled, false);
});

test('Vehicular reúne las categorías, elimina duplicados y conserva variantes de texto y PDF', async () => {
  const item = (id, categoria, comando, pdf) => ({ id, categoria, comando, nombre: id, tipo_dato: 'placa', precio_venta: 5, respuesta_formato: { pdf } });
  const original = [
    item('placa-principal', 'filter', '/placa {valor}', false),
    item('placa-anterior', 'vehiculos', '/placa {valor}', false),
    item('soat-texto', 'filter', '/soat {valor}', false),
    item('soat-pdf', 'filter', '/soat {valor}', true),
    item('soat-pdf-anterior', 'vehiculos', '/soat {valor}', true),
    item('tive-principal', 'filter', '/tive {valor}', true),
    item('tive-anterior', 'vehiculos', '/tiv {valor}', true),
  ];
  const s = await search({ catalog: original });
  const catalog = s.C.FilterView.getCatalog();
  assert.deepEqual(Array.from(catalog, c => c.id), ['placa-principal', 'soat-pdf', 'soat-texto', 'tive-principal']);
  assert.ok(catalog.every(c => c.categoria === 'filter'));
  assert.equal(original[1].categoria, 'vehiculos');
  s.C.setFilterOption('tive-anterior');
  assert.equal(s.elements.filterComboText.textContent, 'tive-principal');
  s.C.setFilterOption('placa-anterior');
  assert.equal(s.elements.filterComboText.textContent, 'placa-principal');
});

test('una respuesta guardada abre el panel oculto sin consultar ni anunciar otro cobro', async () => {
  const s = await search();
  s.elements['filter-result'].hidden = true;
  s.elements['filter-result-body'].hidden = true;
  const saved = {
    input: 'ABC123', consulta: s.C.FilterView.getCatalog()[0],
    response: { costo_deducido: 5, parsed: { raw: 'PLACA ABC123, resultado guardado.', secciones: [], medios: [], botones: [{ texto: 'Callback anterior' }] } },
  };
  assert.equal(s.C.FilterView.showSavedResult(saved), true);
  assert.equal(s.elements['filter-result'].hidden, false);
  assert.equal(s.elements['filter-result-body'].hidden, false);
  assert.match(s.elements['filter-result-body'].innerHTML, /ABC123/);
  assert.doesNotMatch(s.elements['filter-result-body'].innerHTML, /Callback anterior/);
  assert.equal(s.calls.runner, 0);
  assert.equal(s.calls.notices.some(notice => notice.title === 'Cobro exitoso'), false);
  assert.equal(saved.response.costo_deducido, 5, 'el visor no cambia la respuesta conservada');
});

test('abrir una respuesta guardada respeta una consulta que todavía está en curso', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const s = await search({ run: () => pending });
  s.elements['filter-input'].value = 'ABC123';
  const running = s.elements['filter-consultar'].click();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(s.C.FilterView.showSavedResult({ input: 'XYZ456', consulta: s.C.FilterView.getCatalog()[0], response: { parsed: {} } }), false);
  assert.equal(s.elements['filter-input'].value, 'ABC123');
  finish({ costo_deducido: 0, parsed: { raw: 'Resultado de prueba local.', secciones: [], medios: [] } });
  await running;
  assert.equal(s.calls.runner, 1);
});

test('Consultar usa la ficha familiar para todos los bloques de /ag', async () => {
  const raw = [
    'DNI ➾ 11111111 Edad ➾ 50', 'PRENOMBRES ➾ ANA', 'APELLIDOS ➾ UNO',
    'DNI ➾ 22222222 Edad ➾ 30', 'PRENOMBRES ➾ LUIS', 'APELLIDOS ➾ DOS'
  ].join('\n');
  const catalog = [{ id: 'ag-test', categoria: 'familiares', nombre: 'Árbol Genealógico', tipo_dato: 'dni', precio_venta: 5, comando: '/ag {valor}' }];
  const s = await search({ catalog, run: () => ({ parsed: { raw, secciones: [{ titulo: 'Datos', campos: [{ campo: 'DNI', valor: '11111111 Edad 50' }] }], medios: [], tabla: { columnas: ['DNI'], filas: [{ dni: '11111111 Edad 50' }] } } }) });
  s.elements['filter-input'].value = '11111111';
  await s.elements['filter-consultar'].click();
  const html = s.elements['filter-result-body'].innerHTML;
  assert.match(html, /class="nm-results cr-arbol"/);
  assert.match(html, /2 resultados/);
  assert.match(html, /data-label="DNI">11111111<\/td><td data-label="Nombres">ANA<\/td><td data-label="Apellidos">UNO<\/td><td data-label="Edad">50<\/td>/);
  assert.match(html, /data-label="DNI">22222222<\/td><td data-label="Nombres">LUIS<\/td><td data-label="Apellidos">DOS<\/td><td data-label="Edad">30<\/td>/);
  assert.doesNotMatch(html, /11111111 Edad 50/);
});

for (const command of ['/nm', '/nmd']) {
  test('Consultar conserva la tabla de personas y descarga para ' + command, async () => {
    const catalog = [{ id: 'names-test', categoria: 'reniec', nombre: 'Busqueda por Nombre', tipo_dato: 'texto', precio_venta: 5, bot_id: 'laindata', comando: command + ' {valor}' }];
    const parsed = { raw: 'N° DNI: 12345678\nNOMBRES: MARIA', secciones: [], medios: [], botones: [
      { text: 'DESCARGAR', msgId: 1, data: 'menu' },
    ] };
    const s = await search({ catalog, run: () => ({ parsed }) });
    s.elements['filter-input'].value = 'MARIA|EJEMPLO|';
    await s.elements['filter-consultar'].click();
    const html = s.elements['filter-result-body'].innerHTML;
    assert.match(html, /class="nm-results"/);
    assert.match(html, /12345678/);
    assert.match(html, /nm-export-status/);
    assert.doesNotMatch(html, /cr-btn-option/);
    assert.equal(s.calls.runner, 1);
    assert.equal(s.elements['filter-consultar'].disabled, false);
    assert.deepEqual(s.calls.errors, []);
  });
}

test('Consultar muestra los cuatro bloques familiares aunque la tabla auxiliar solo tenga el primero', async () => {
  const raw = [
    'ARBOL GENEALOGICO - DNI\nDNI: 11111111 Edad: 50\nPRENOMBRES: ANA\nRELACION: TITULAR',
    'Nº\tDNI\tPrenombres\tApellidos\tGénero\tRelación\n2\t22222222 Edad 45\tLUIS\tDOS\tMASCULINO\tPADRE',
    '3  33333333  42  EVA  TRES  FEMENINO  MADRE',
    '4\t44444444\tLUZ\tCUATRO\tFEMENINO\tHERMANA\t20'
  ].join('\n\n');
  const catalog = [{ id: 'ag-cuatro', categoria: 'familiares', nombre: 'Arbol genealogico', tipo_dato: 'dni', precio_venta: 5, comando: '/ag {valor}' }];
  const parsed = { raw, secciones: [{ titulo: 'Datos', campos: [{ campo: 'DNI', valor: '11111111' }] }], medios: [], tabla: { columnas: ['DNI'], filas: [{ dni: '11111111' }] } };
  const s = await search({ catalog, run: () => ({ parsed }) });
  s.elements['filter-input'].value = '11111111';
  await s.elements['filter-consultar'].click();
  const html = s.elements['filter-result-body'].innerHTML;
  assert.match(html, /4 resultados/);
  for (const dni of ['11111111', '22222222', '33333333', '44444444']) {
    assert.match(html, new RegExp('data-label="DNI">' + dni + '</td>'));
  }
  assert.match(html, /data-label="DNI">22222222<\/td><td data-label="Nombres">LUIS<\/td><td data-label="Apellidos">DOS<\/td><td data-label="Edad">45<\/td>/);
  assert.match(html, /data-label="DNI">44444444<\/td><td data-label="Nombres">LUZ<\/td><td data-label="Apellidos">CUATRO<\/td><td data-label="Edad">20<\/td>/);
});

test('Consultar conserva cuatro bloques de texto con estados diferentes', async () => {
  const raw = [
    'Nombre: PERSONA UNO\nEstado: VIGENTE',
    'Nombre: PERSONA DOS\nEstado: ACTIVO',
    'Nombre: PERSONA TRES\nEstado: INACTIVO',
    'Nombre: PERSONA CUATRO\nEstado: PENDIENTE',
  ].join('\n\n');
  const catalog = [{ id: 'multi-texto', categoria: 'familiares', nombre: 'Consulta de texto', tipo_dato: 'dni', precio_venta: 5, comando: '/multi {valor}' }];
  const secciones = [
    ['PERSONA UNO', 'VIGENTE'], ['PERSONA DOS', 'ACTIVO'],
    ['PERSONA TRES', 'INACTIVO'], ['PERSONA CUATRO', 'PENDIENTE'],
  ].map(([nombre, estado]) => ({ titulo: '', campos: [{ campo: 'Nombre', valor: nombre }, { campo: 'Estado', valor: estado }] }));
  const s = await search({ catalog, run: () => ({ parsed: { raw, secciones, medios: [] } }) });
  s.elements['filter-input'].value = '11111111';
  await s.elements['filter-consultar'].click();
  const html = s.elements['filter-result-body'].innerHTML;
  for (const name of ['PERSONA UNO', 'PERSONA DOS', 'PERSONA TRES', 'PERSONA CUATRO']) {
    assert.match(html, new RegExp(name));
  }
  assert.match(html, /PENDIENTE/);
});
