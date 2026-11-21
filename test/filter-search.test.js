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
      loadCatalog: async () => [{ id: 'sample', categoria: 'filter', nombre: 'Consulta por placa', tipo_dato: 'placa', precio_venta: 5, comando: '/sample' }],
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
