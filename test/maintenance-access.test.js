const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(initialRole) {
  const nodes = new Map();
  const classes = new Set();
  function element() {
    const children = new Map();
    return {
      style: {}, listeners: {}, hidden: false,
      setAttribute() {}, removeAttribute() {},
      addEventListener(event, handler) { this.listeners[event] = handler; },
      querySelector(selector) {
        if (!children.has(selector)) children.set(selector, element());
        return children.get(selector);
      },
      remove() { nodes.delete(this.id); },
    };
  }
  const door = element();
  door.hidden = !!initialRole;
  nodes.set('nvPuerta', door);
  let role = initialRole;
  let authListener;
  let delayedProfile;
  const auth = {
    getUser: async () => role ? { id: 'account' } : null,
    getProfile: async () => delayedProfile ? delayedProfile : { id: 'account', is_admin: role === 'admin' },
    onAuthChange: listener => { authListener = listener; },
  };
  const document = {
    readyState: 'complete',
    documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
    body: { appendChild(node) { nodes.set(node.id, node); } },
    createElement: element,
    getElementById(id) {
      if (nodes.has(id)) return nodes.get(id);
      if (nodes.has('maintenanceOverlay')) return nodes.get('maintenanceOverlay').querySelector('#' + id);
      return null;
    },
    querySelector: () => null,
    addEventListener() {},
  };
  const Consultia = {
    Auth: auth,
    supabase: { rpc: async () => ({ data: { enabled: true }, error: null }) },
  };
  const context = vm.createContext({
    Consultia, document, navigator: {}, console, setTimeout, clearInterval, setInterval: () => 1,
    window: { Consultia, addEventListener() {} },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/modules/maintenance.js'), 'utf8'), context);
  return {
    maintenance: Consultia.Maintenance,
    blocked: () => classes.has('mnt-locked'),
    async flush() { await new Promise(resolve => setTimeout(resolve, 5)); },
    noticeHtml() { return nodes.get('maintenanceOverlay')?.innerHTML || ''; },
    authEvent(event, nextRole) { role = nextRole; door.hidden = !!nextRole; authListener(event); },
    delayProfile(promise) { delayedProfile = promise; },
  };
}

test('administrator can use the app while maintenance remains enabled', async () => {
  const app = fixture('admin');
  await app.flush();
  assert.equal(app.blocked(), false);
  app.maintenance.applyState({ enabled: true });
  assert.equal(app.blocked(), false);
});

test('regular accounts remain blocked without an administrator shortcut', async () => {
  const app = fixture('member');
  await app.flush();
  assert.equal(app.blocked(), true);
  assert.doesNotMatch(app.noticeHtml(), /mntAccess|Acceso administrador/);
});

test('normal login automatically recognizes an administrator during maintenance', async () => {
  const app = fixture(null);
  await app.flush();
  assert.equal(app.blocked(), false);
  app.maintenance.applyState({ enabled: true });
  assert.equal(app.blocked(), false, 'maintenance polling must not cover the login form');
  app.authEvent('SIGNED_IN', 'admin');
  await app.flush();
  assert.equal(app.blocked(), false);
});

test('login with a regular account does not grant a maintenance exception', async () => {
  const app = fixture(null);
  await app.flush();
  app.authEvent('SIGNED_IN', 'member');
  await app.flush();
  assert.equal(app.blocked(), true);
});

test('signing out restores normal login and does not grant the next account admin access', async () => {
  const app = fixture('admin');
  await app.flush();
  app.authEvent('SIGNED_OUT', null);
  assert.equal(app.blocked(), false);
  app.authEvent('SIGNED_IN', 'member');
  await app.flush();
  assert.equal(app.blocked(), true);
});

test('a late administrator profile cannot reopen access after sign-out', async () => {
  const app = fixture('admin');
  await app.flush();
  let resolveProfile;
  app.delayProfile(new Promise(resolve => { resolveProfile = resolve; }));
  app.authEvent('USER_UPDATED', 'admin');
  await app.flush();
  app.authEvent('SIGNED_OUT', null);
  app.delayProfile(null);
  app.authEvent('SIGNED_IN', 'member');
  await app.flush();
  resolveProfile({ id: 'account', is_admin: true });
  await app.flush();
  assert.equal(app.blocked(), true);
});
