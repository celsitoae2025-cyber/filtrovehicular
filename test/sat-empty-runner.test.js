const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function runner(payload, processing = false) {
  const calls = { requests: [], rpc: [], removedWaiting: 0, timers: new Set() };
  const Consultia = {
    supabase: {
      supabaseUrl: 'https://supabase.example.test',
      auth: { getSession: async () => ({ data: { session: { access_token: 'local-test-session' } } }) },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { credits_balance: 100, is_admin: false } }) }) }) }),
      rpc: async (name, args) => {
        calls.rpc.push({ name, args });
        return { data: name === 'consume_credits' ? 'consulta-local-sat' : 0, error: null };
      },
    },
    RenderHelpers: { esRespuestaEnProceso: () => processing },
  };
  const context = vm.createContext({
    Consultia, window: { Consultia }, AbortController, console,
    setTimeout(callback, delay) {
      const timer = setTimeout(() => { calls.timers.delete(timer); callback(); }, delay);
      calls.timers.add(timer);
      return timer;
    },
    clearTimeout(timer) { calls.timers.delete(timer); clearTimeout(timer); },
    document: { querySelector: () => null, body: { classList: { remove: () => { calls.removedWaiting++; } } } },
    fetch: async (url, options) => {
      calls.requests.push({ url, body: JSON.parse(options.body) });
      return { ok: true, json: async () => JSON.parse(JSON.stringify(payload)) };
    },
  });
  vm.runInContext(fs.readFileSync(require.resolve('../js/modules/consulta-runner.js'), 'utf8'), context);
  return { run: command => Consultia.ConsultaRunner.ejecutarConsultaConCobro('test-user', {
    comando: command, bot_id: 'recupsd', precio_venta: 4, tipo_dato: 'placa', categoria: 'filter',
  }, 'm5n535'), calls };
}

test('SAT sin papeletas termina en una petición y conserva la liquidación del servidor', async () => {
  const fixture = runner({ sin_resultados: true, credito_devuelto: true,
    parsed: { sin_papeletas: true, placa: 'M5N535', mensaje: 'No cuenta con papeletas', raw: 'No hay datos para la placa M5N535. No se pudo extraer información para M5N535.' },
  }, true);
  const result = await fixture.run('/sat {valor}');
  assert.equal(result.parsed.sin_papeletas, true);
  assert.equal(result.costo_deducido, 0);
  assert.equal(result.consulta_id, 'consulta-local-sat');
  assert.equal(result.credito_devuelto, true);
  assert.equal(fixture.calls.requests.length, 1);
  assert.equal(fixture.calls.rpc.filter(call => call.name === 'consume_credits').length, 1);
  assert.deepEqual(fixture.calls.rpc.map(call => call.name), ['liquidar_consultas_colgadas', 'consume_credits']);
  assert.ok(fixture.calls.removedWaiting > 0);
  assert.equal(fixture.calls.timers.size, 0, 'La respuesta final no deja una espera o timeout pendiente');
});

test('un resultado positivo SAT mantiene su comportamiento y el costo informado', async () => {
  const fixture = runner({ parsed: { secciones: [{ campos: [{ campo: 'PLACA', valor: 'M5N535' }] }], bloques: [{ numero: 1 }] } });
  const result = await fixture.run('/sat {valor}');
  assert.equal(result.costo_deducido, 4);
  assert.equal(result.parsed.bloques.length, 1);
  assert.equal(fixture.calls.requests.length, 1);
});

test('la excepción terminal de SAT no cambia respuestas vacías de otros comandos', async () => {
  const fixture = runner({ sin_resultados: true, parsed: { sin_papeletas: true, raw: 'No hay datos' } });
  await assert.rejects(fixture.run('/placa {valor}'), error => error.code === 'EMPTY_RESPONSE');
  assert.equal(fixture.calls.requests.length, 1);
});
