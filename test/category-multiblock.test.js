const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function categoryResponse(consulta, parsed) {
  const classes = () => {
    const values = new Set();
    return {
      add: (...names) => names.forEach(name => values.add(name)),
      remove: (...names) => names.forEach(name => values.delete(name)),
      toggle(name, force) {
        const next = force === undefined ? !values.has(name) : force;
        next ? values.add(name) : values.delete(name);
        return next;
      },
      contains: name => values.has(name),
    };
  };
  const element = () => ({
    value: '', innerHTML: '', textContent: '', hidden: false, disabled: false,
    style: {}, dataset: {}, classList: classes(), offsetWidth: 140, listeners: {},
    addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); },
    click() { return Promise.all((this.listeners.click || []).map(handler => handler({ stopPropagation() {} }))); },
    setAttribute() {}, removeAttribute() {}, focus() {}, closest() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
  });
  const prefix = 'familia';
  const ids = [prefix + 'Combo', prefix + 'ComboBtn', prefix + 'ComboText', prefix + 'ComboPanel',
    prefix + '-desc', prefix + '-credits', prefix + '-input', prefix + '-consultar',
    prefix + '-empty', prefix + '-result-body', prefix + 'ResultStatus'];
  const elements = Object.fromEntries(ids.map(id => [id, element()]));
  const document = {
    getElementById: id => elements[id] || null,
    querySelector: () => null,
    addEventListener() {},
  };
  const C = {
    Auth: { getUser: async () => ({ id: 'test-user' }) },
    ConsultaRunner: {
      loadCatalog: async () => [consulta],
      verificarSaldo: async () => true,
      ejecutarConsultaConCobro: async () => ({ parsed, costo_deducido: 0 }),
    },
  };
  const window = { Consultia: C, scrollTo() {} };
  const context = vm.createContext({ window, Consultia: C, document, console,
    setTimeout, clearTimeout, Date, navigator: {} });
  for (const file of ['render-helpers.js', 'category-view.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/modules', file), 'utf8'), context);
  }
  const view = C.createCategoryView({ prefix, categoria: 'familiares' });
  view.init();
  await new Promise(setImmediate);
  elements[prefix + '-input'].value = '11111111';
  await elements[prefix + '-consultar'].click();
  return elements[prefix + '-result-body'].innerHTML;
}

test('una tabla auxiliar parcial no tapa los cuatro bloques de una consulta familiar', async () => {
  const raw = [
    'DNI: 11111111 Edad: 50\nPRENOMBRES: ANA\nAPELLIDOS: UNO',
    'DNI: 22222222 Edad: 45\nPRENOMBRES: LUIS\nAPELLIDOS: DOS',
    'DNI: 33333333 Edad: 40\nPRENOMBRES: EVA\nAPELLIDOS: TRES',
    'DNI: 44444444 Edad: 35\nPRENOMBRES: LUZ\nAPELLIDOS: CUATRO',
  ].join('\n\n');
  const html = await categoryResponse(
    { id: 'ag', nombre: 'Árbol Genealógico', comando: '/ag {valor}', tipo_dato: 'dni', precio_venta: 5 },
    { raw, secciones: [{ titulo: 'Primer mensaje', campos: [{ campo: 'DNI', valor: '11111111' }] }],
      medios: [], tabla: { columnas: ['DNI'], filas: [{ dni: '11111111' }] } },
  );
  assert.match(html, /class="nm-results cr-arbol"/);
  assert.match(html, /4 resultados/);
  for (const dni of ['11111111', '22222222', '33333333', '44444444']) {
    assert.match(html, new RegExp('data-label="DNI">' + dni + '</td>'));
  }
});

test('cuatro bloques de texto libre conservan nombres y estados con el formato común', async () => {
  const raw = [
    'Nombre: PERSONA UNO\nEstado: VIGENTE',
    'Nombre: PERSONA DOS\nEstado: ACTIVO',
    'Nombre: PERSONA TRES\nEstado: INACTIVO',
    'Nombre: PERSONA CUATRO\nEstado: PENDIENTE',
  ].join('\n\n');
  const html = await categoryResponse(
    { id: 'multi', nombre: 'Consulta de texto', comando: '/multi {valor}', tipo_dato: 'dni', precio_venta: 5 },
    { raw, secciones: [], medios: [] },
  );
  for (const name of ['PERSONA UNO', 'PERSONA DOS', 'PERSONA TRES', 'PERSONA CUATRO']) {
    assert.match(html, new RegExp(name));
  }
  assert.match(html, /VIGENTE/);
  assert.match(html, /PENDIENTE/);
  assert.doesNotMatch(html, /font-family:\s*monospace/);
});
