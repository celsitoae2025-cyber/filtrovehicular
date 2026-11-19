const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function preparar() {
  const llamados = [], descargas = [], avisos = [];
  const respuestas = [];
  function elemento() {
    return { hidden: false, disabled: false, textContent: '', children: [], listeners: {},
      addEventListener(tipo, fn) { this.listeners[tipo] = fn; },
      appendChild(el) { this.children.push(el); },
      remove() {},
      click() { if (this.listeners.click) return this.listeners.click(); descargas.push(this.download); }
    };
  }
  const open = elemento(), formatos = elemento(), status = elemento(), area = elemento();
  area.querySelector = s => s === '.nm-export-open' ? open : s === '.nm-export-status' ? status : formatos;
  area.querySelectorAll = () => [open, ...formatos.children];
  const body = elemento();
  const document = { createElement: elemento, addEventListener() {}, body };
  const C = { toast: a => avisos.push(a), ConsultaRunner: { ejecutarCallback: async (...args) => {
    llamados.push(args); return respuestas.shift();
  } } };
  const timers = [];
  const context = vm.createContext({ window: { Consultia: C }, Consultia: C, document,
    console, Blob, Uint8Array, atob, URL: { createObjectURL: () => 'blob:archivo', revokeObjectURL() {} },
    AbortController, setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {} });
  vm.runInContext(fs.readFileSync('js/modules/render-helpers.js', 'utf8'), context);
  return { H: C.RenderHelpers, open, formatos, status, area, llamados, respuestas, descargas, avisos, timers };
}

test('búsqueda por nombres conserva los registros y solo ofrece Descargar', () => {
  const { H } = preparar();
  const html = H.renderNmPersonas({ raw: 'N° DNI: 12345678\nNOMBRES: MARIA' }, [
    { text: '12345678', msgId: 1, data: 'a' }, { text: '⬇️ DESCARGAR', msgId: 1, data: 'b' },
    { text: 'SIGUIENTE', msgId: 1, data: 'c' }
  ], 'MARIA');
  assert.match(html, /Preparando opciones de descarga/);
  assert.match(html, /12345678/);
  assert.doesNotMatch(html, /SIGUIENTE|cr-btn-option|Descargar TXT/);
});

test('la página abre automáticamente el menú y descarga el formato elegido', async () => {
  const t = preparar();
  const raiz = { text: '⬇️ DESCARGAR', msgId: 1, data: 'menu' };
  t.respuestas.push({ parsed: { botones: [
    { text: '📩 DESCARGAR EN TXT', msgId: 2, data: 'txt' },
    { text: '📊 EXCEL', msgId: 2, data: 'excel' },
    { text: '📦 EXCEL', msgId: 2, data: 'zip' }
  ] } });
  t.H.wireNmButtons({ querySelector: () => t.area }, { botones: [raiz], consulta: () => ({ bot_id: 'bot' }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(t.llamados[0][2], 'menu');
  assert.equal(t.status.hidden, true);
  assert.deepEqual(t.formatos.children.map(b => b.textContent), ['Descargar en texto', 'Descargar en Excel']);
  t.respuestas.push({ parsed: { medios: [{ filename: 'resultado.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: 'YQ==' }] } });
  await t.formatos.children[1].click();
  assert.equal(t.llamados[1][2], 'excel');
  assert.deepEqual(t.descargas, ['resultado.xlsx']);
  t.respuestas.push({ parsed: { medios: [{ filename: 'resultado.txt', mimeType: 'text/plain', base64: 'YQ==' }] } });
  await t.formatos.children[0].click();
  assert.equal(t.llamados[2][2], 'txt');
  assert.deepEqual(t.descargas, ['resultado.xlsx', 'resultado.txt']);
  assert.deepEqual(t.avisos, []);
});

test('no anuncia una descarga si el proveedor no adjuntó el archivo', async () => {
  const t = preparar();
  t.H.wireNmButtons({ querySelector: () => t.area }, {
    botones: [{ text: 'DESCARGAR EN TXT', msgId: 1, data: 'txt' }], consulta: () => ({ bot_id: 'bot' })
  });
  t.respuestas.push({ parsed: { raw: 'Preparado', medios: [] } });
  await t.formatos.children[0].click();
  assert.deepEqual(t.descargas, []);
  assert.equal(t.avisos[0].title, 'No se pudo descargar');
});

test('permite reintentar si el menú automático falla', async () => {
  const t = preparar();
  t.respuestas.push({ parsed: { botones: [] } });
  t.H.wireNmButtons({ querySelector: () => t.area }, {
    botones: [{ text: 'DESCARGAR', msgId: 1, data: 'menu' }], consulta: () => ({ bot_id: 'bot' })
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(t.open.hidden, false);
  assert.match(t.status.textContent, /No se pudieron obtener/);
  t.respuestas.push({ parsed: { botones: [{ text: 'EXCEL', msgId: 2, data: 'excel' }] } });
  await t.open.click();
  assert.equal(t.open.hidden, true);
  assert.equal(t.formatos.children[0].textContent, 'Descargar en Excel');
});

test('una respuesta que nunca llega libera la espera y habilita Reintentar', async () => {
  const t = preparar();
  t.respuestas.push(new Promise(() => {}));
  t.H.wireNmButtons({ querySelector: () => t.area }, {
    botones: [{ text: 'DESCARGAR', msgId: 1, data: 'menu' }], consulta: () => ({ bot_id: 'bot' })
  });
  const limite = t.timers.find(timer => timer.ms === 45000);
  assert.ok(limite);
  limite.fn();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(t.open.hidden, false);
  assert.equal(t.open.disabled, false);
  assert.equal(t.llamados[0][3].signal.aborted, true);
  assert.match(t.status.textContent, /No se pudieron obtener/);
});
