const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

async function requestWithOldCache(asset, offline = false) {
  const url = 'https://filtrovehicularperu.com/' + asset;
  const old = new Response('old dark maintenance notice');
  const fresh = new Response('current readable maintenance notice');
  Object.defineProperty(fresh, 'type', { value: 'basic' });
  const handlers = {};
  const cache = { match: async () => old.clone(), put: async () => {} };
  const context = vm.createContext({
    self: { location: new URL('https://filtrovehicularperu.com/sw.js'), addEventListener: (name, handler) => { handlers[name] = handler; } },
    caches: { open: async () => cache, match: async () => old.clone() },
    fetch: async () => { if (offline) throw new Error('Offline fixture'); return fresh; },
    URL, Request, Response, setTimeout, clearTimeout, console,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8'), context);
  let delivered;
  handlers.fetch({ request: new Request(url), respondWith: response => { delivered = response; } });
  return (await delivered).text();
}

test('maintenance stylesheet supersedes an already cached dark notice', async () => {
  assert.equal(await requestWithOldCache('css/maintenance.css?v=20'), 'current readable maintenance notice');
});

test('maintenance script supersedes a cached earlier template', async () => {
  assert.equal(await requestWithOldCache('js/modules/maintenance.js?v=13'), 'current readable maintenance notice');
});

test('maintenance notice remains available offline when the network fails', async () => {
  assert.equal(await requestWithOldCache('css/maintenance.css?v=22', true), 'old dark maintenance notice');
});
