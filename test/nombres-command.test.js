const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function namesForm() {
  const elements = Object.fromEntries(['nvNmNombres', 'nvNmApPat', 'nvNmApMat', 'nvNmCampos', 'nvBuscador', 'filter-input', 'filter-consultar'].map(id => [id, {
    value: '', hidden: id === 'nvNmCampos', listeners: {}, focused: false,
    classList: { add() {}, remove() {} }, focus() { this.focused = true; },
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); },
    fire(name, event = {}) { for (const fn of this.listeners[name] || []) fn(event); },
  }]));
  const ready = [], requests = [], notices = [];
  const C = { NV: { $: id => elements[id] }, toast: notice => notices.push(notice), supabase: {
    supabaseUrl: 'https://supabase.example.test',
    auth: { getSession: async () => ({ data: { session: { access_token: 'unit-test-only' } } }) },
  } };
  const context = vm.createContext({
    window: { Consultia: C, matchMedia: () => ({ matches: true }) }, Consultia: C,
    document: { addEventListener(name, fn) { if (name === 'DOMContentLoaded') ready.push(fn); }, querySelector() { return null; } },
    console, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ parsed: { raw: 'Resultado de prueba' } }) }; },
  });
  for (const file of ['js/modules/consulta-runner.js', 'js/nueva/nombres.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  ready.forEach(fn => fn());
  return { C, elements, requests, notices };
}

for (const command of ['/nm', '/nmd']) {
  test(command + ' conserva los tres campos y envía nombres y apellidos compuestos al comando elegido', async () => {
    const { C, elements, requests } = namesForm();
    const consulta = { bot_id: 'laindata', comando: command + ' {valor}', tipo_dato: 'texto' };
    C.NV.actualizarModoNombre(consulta);
    assert.equal(elements.nvNmCampos.hidden, false);
    assert.equal(elements.nvNmNombres.focused, true);
    elements.nvNmNombres.value = ' Ana María ';
    elements.nvNmApPat.value = ' De la Cruz ';
    elements.nvNmApMat.value = ' Ramos ';
    elements.nvNmApMat.fire('input');
    const value = elements['filter-input'].value;
    assert.equal(value, 'Ana,María|De+la+Cruz|Ramos');
    await C.ConsultaRunner.ejecutarConsulta(consulta, value, { consultaId: 'unit-reservation' });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.command, command + ' Ana,María|De+la+Cruz|Ramos');
    assert.equal(requests[0].body.bot, 'laindata');
  });
}

test('/nmd frena una búsqueda incompleta antes de enviarla y permite ambos apellidos sin nombres', () => {
  const { C, elements, notices, requests } = namesForm();
  C.NV.actualizarModoNombre({ comando: '/nmd {valor}' });
  elements.nvNmApPat.value = 'De la Cruz';
  let stopped = false;
  const event = { preventDefault() {}, stopImmediatePropagation() { stopped = true; } };
  elements['filter-consultar'].fire('click', event);
  assert.equal(stopped, true);
  assert.equal(notices[0].title, 'Faltan datos');
  assert.equal(requests.length, 0);
  elements.nvNmApMat.value = 'Ramos';
  stopped = false;
  elements['filter-consultar'].fire('click', event);
  assert.equal(stopped, false);
  assert.equal(elements['filter-input'].value, '|De+la+Cruz|Ramos');
});
