const test = require('node:test');
const assert = require('node:assert/strict');
const { createCache } = require('../js/shared/recent-results.js');

function storage() {
  const rows = new Map();
  return {
    rows,
    async read(user) { return [...rows.values()].filter(row => row.user_id === user); },
    async write(row) { rows.set(row.key, row); },
    async remove(user) { for (const [key, row] of rows) if (row.user_id === user) rows.delete(key); }
  };
}
const consulta = { id: 'placa', nombre: 'Consulta Placa', categoria: 'filter', tipo_dato: 'placa' };
const response = id => ({ consulta_id: id, parsed: { secciones: [{ campos: [{ campo: 'Placa', valor: 'ABC123' }] }], medios: [] }, costo_deducido: 5 });

test('recent results reopen across cache instances without leaking another account', async () => {
  const adapter = storage();
  const first = createCache(adapter);
  await first.remember('a', consulta, 'ABC123', response('same-id'));
  await first.remember('b', consulta, 'XYZ456', response('same-id'));
  const reloaded = createCache(adapter);
  assert.equal((await reloaded.get('a', 'same-id')).input, 'ABC123');
  assert.equal((await reloaded.get('b', 'same-id')).input, 'XYZ456');
  assert.deepEqual(await reloaded.list('unknown'), []);
});

test('recent results retain four distinct latest responses and isolate mutable renderer data', async () => {
  const cache = createCache(storage());
  const original = response('one');
  await cache.remember('a', consulta, 'ABC123', original);
  original.parsed.secciones[0].campos[0].valor = 'changed';
  assert.equal((await cache.get('a', 'one')).response.parsed.secciones[0].campos[0].valor, 'ABC123');
  const opened = await cache.get('a', 'one');
  opened.response.parsed.secciones.length = 0;
  assert.equal((await cache.get('a', 'one')).response.parsed.secciones.length, 1);
  await cache.remember('a', consulta, 'DEF456', response('two'));
  await cache.remember('a', consulta, 'GHI789', response('three'));
  await cache.remember('a', consulta, 'JKL012', response('four'));
  assert.deepEqual((await cache.list('a')).map(item => item.id), ['four', 'three', 'two', 'one']);
  await cache.remember('a', consulta, 'MNO345', response('five'));
  assert.deepEqual((await cache.list('a')).map(item => item.id), ['five', 'four', 'three', 'two']);
  assert.equal(await cache.get('a', 'one'), null);
});

test('blocked local storage preserves the delivered result in memory', async () => {
  const fail = async () => { throw new Error('Quota or storage blocked'); };
  const cache = createCache({ read: fail, write: fail, remove: fail });
  await cache.remember('a', consulta, 'ABC123', response('one'));
  assert.equal((await cache.get('a', 'one')).input, 'ABC123');
  await cache.clear('a');
  assert.deepEqual(await cache.list('a'), []);
});

test('sign out discards a pending read and removes only the active account', async () => {
  const adapter = storage();
  const first = createCache(adapter);
  await first.remember('a', consulta, 'ABC123', response('one'));
  await first.remember('b', consulta, 'XYZ456', response('two'));
  let release;
  const cache = createCache({ ...adapter, read: () => new Promise(resolve => { release = resolve; }) });
  const pending = cache.list('a');
  await cache.clear('a');
  release([{ user_id: 'a', id: 'one', created_at: new Date().toISOString() }]);
  assert.deepEqual(await pending, []);
  assert.deepEqual(await createCache(adapter).list('a'), []);
  assert.equal((await createCache(adapter).list('b')).length, 1);
});

test('failed and incomplete responses do not displace useful results', async () => {
  let notifications = 0;
  const cache = createCache(storage(), () => { notifications++; });
  await cache.remember('a', consulta, 'ABC123', response('one'));
  await cache.remember('a', consulta, 'ABC123', { ...response('two'), sin_resultados: true });
  await cache.remember('a', consulta, 'ABC123', { parsed: {} });
  assert.equal((await cache.list('a')).length, 1);
  assert.equal(notifications, 1);
});
