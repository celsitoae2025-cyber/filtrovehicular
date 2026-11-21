const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('la consulta envía su formato y solicita adjuntos sin duplicación por el proxy autenticado', async () => {
  const requests = [];
  const window = { Consultia: { supabase: {
    supabaseUrl: 'https://supabase.example.test',
    auth: { getSession: async () => ({ data: { session: { access_token: 'local-test-session' } } }) },
  } } };
  const context = vm.createContext({
    window, Consultia: window.Consultia, AbortController, setTimeout, clearTimeout, console,
    fetch: async (url, options) => {
      requests.push({ url, ...options, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ parsed: { raw: 'Resultado local' } }) };
    },
  });
  vm.runInContext(fs.readFileSync(require.resolve('../js/modules/consulta-runner.js'), 'utf8'), context);
  const consulta = { bot_id: 'test', comando: '/boin {valor}', respuesta_formato: { texto: true, pdf: true } };
  await window.Consultia.ConsultaRunner.ejecutarConsulta(consulta, 'ABC123', { consultaId: 'local-consulta' });
  await window.Consultia.ConsultaRunner.ejecutarCallback(consulta, 42, 'b3BjaW9u', { consultaId: 'local-consulta' });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.responseFormat.pdf, true);
  for (const request of requests) {
    assert.equal(request.body.compactResponse, true);
    assert.equal(request.body.consulta_id, 'local-consulta');
    assert.equal(request.headers.Authorization, 'Bearer local-test-session');
    assert.ok(request.url.startsWith('https://supabase.example.test/functions/v1/bridge-proxy/'));
  }
});
