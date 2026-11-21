const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function navigation(start = 'consultar') {
  const listeners = {};
  const page = new URL(`https://example.test/app#${start}`);
  const elements = {};
  const element = (hidden = false) => ({
    hidden, value: '', textContent: '',
    classList: { toggle() {} }, setAttribute() {}, removeAttribute() {}, focus() {},
  });
  for (const id of ['nvInicio', 'nvTitulo', 'nvConsultaSeleccion', 'nvBuscador', 'nvSeleccionNombre', 'nvSeleccionCosto', 'filter-input', 'filter-result', 'nvExplorar']) {
    elements[id] = element(['nvInicio', 'nvConsultaSeleccion', 'nvBuscador', 'filter-result'].includes(id));
  }
  const routes = ['consultar', 'pagos', 'regiones'].map(name => ({ ...element(), dataset: { pantalla: name } }));
  const calls = { back: 0, go: 0 };
  const history = {
    state: null,
    pushState(state, _, url) { this.state = state; page.href = new URL(url, page).href; },
    replaceState(state, _, url) { this.state = state; page.href = new URL(url, page).href; },
    back() { calls.back++; }, go() { calls.go++; },
  };
  const document = {
    title: '', getElementById: id => elements[id],
    querySelectorAll: selector => selector === '.nv-pantalla' ? routes : [],
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
  };
  const window = { addEventListener() {}, scrollTo() {}, Consultia: {} };
  const context = vm.createContext({ window, document, history, location: page, console });
  for (const file of ['nucleo.js', 'pantallas.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/nueva', file), 'utf8'), context);
  }
  return { NV: window.Consultia.NV, elements, calls, page, history, routes, listeners };
}

test('seleccionar una consulta muestra el regreso aunque siga en #consultar', () => {
  const { NV, elements } = navigation();
  NV.actualizarInicio();
  assert.equal(elements.nvInicio.hidden, true);
  NV.mostrarBuscador({ nombre: 'Boleta informativa', precio_venta: 5 });
  assert.equal(elements.nvInicio.hidden, false);
});

test('volver al inicio cierra consulta y resultado sin navegar atrás fuera del catálogo', () => {
  const { NV, elements, history, calls, page } = navigation();
  NV.mostrarBuscador({ nombre: 'Boleta informativa', precio_venta: 5 });
  elements['filter-input'].value = 'ABC123';
  elements['filter-result'].hidden = false;
  NV.abrirCapa('resultado', () => { elements['filter-result'].hidden = true; });
  NV.volverAlInicio();
  assert.equal(page.hash, '#consultar');
  assert.equal(elements.nvExplorar.hidden, false);
  assert.equal(elements.nvConsultaSeleccion.hidden, true);
  assert.equal(elements['filter-result'].hidden, true);
  assert.equal(elements['filter-input'].value, '');
  assert.equal(elements.nvInicio.hidden, true);
  assert.equal(history.state, null);
  assert.deepEqual(calls, { back: 0, go: 0 });
  NV.mostrarBuscador({ nombre: 'Nueva consulta', precio_venta: 5 });
  assert.equal(history.state.nvCapa, 1, 'no quedan capas antiguas al elegir otra consulta');
});

test('desde otra sección el regreso lleva al catálogo y actualiza la pantalla visible', () => {
  const { NV, elements, routes, page } = navigation('pagos');
  NV.actualizarInicio();
  assert.equal(elements.nvInicio.hidden, false);
  NV.volverAlInicio();
  assert.equal(page.hash, '#consultar');
  assert.equal(routes.find(r => r.dataset.pantalla === 'consultar').hidden, false);
  assert.equal(routes.find(r => r.dataset.pantalla === 'pagos').hidden, true);
  assert.equal(elements.nvTitulo.textContent, 'Vehicular');
});

test('el encabezado muestra la categoría solo mientras se visualiza el catálogo', () => {
  const { NV, elements } = navigation();
  NV.nombreCategoriaActiva = () => 'Familia';
  NV.actualizarInicio();
  assert.equal(elements.nvTitulo.textContent, 'Familia');
  NV.mostrarBuscador({ nombre: 'Árbol Genealógico', precio_venta: 5 });
  assert.equal(elements.nvTitulo.textContent, 'Consultar');
  NV.volverAlCatalogo();
  assert.equal(elements.nvTitulo.textContent, 'Familia');
  NV.ir('pagos');
  NV.actualizarInicio();
  assert.equal(elements.nvTitulo.textContent, 'Pagos');
});

test('el acceso Consultar de la barra restablece el catálogo en la misma ruta', () => {
  const { NV, elements, listeners } = navigation();
  NV.mostrarBuscador({ nombre: 'Boleta informativa', precio_venta: 5 });
  let prevented = false;
  listeners.click[0]({ button: 0, target: { closest: () => ({}) }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(elements.nvExplorar.hidden, false);
  assert.equal(elements.nvConsultaSeleccion.hidden, true);
});

test('Ctrl + clic mantiene la navegación nativa del enlace', () => {
  const { NV, elements, listeners } = navigation();
  NV.mostrarBuscador({ nombre: 'Boleta informativa', precio_venta: 5 });
  listeners.click[0]({ button: 0, ctrlKey: true, preventDefault() { assert.fail('no debe interceptar Ctrl + clic'); } });
  assert.equal(elements.nvConsultaSeleccion.hidden, false);
});
