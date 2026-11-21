const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(initialRole = null) {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: id === 'adminApp', disabled: false, checked: true, value: 'fixture',
      dataset: {}, listeners: {}, textContent: '',
      addEventListener(name, listener) { this.listeners[name] = listener; },
      setAttribute() {}, removeAttribute() {},
    });
    return nodes.get(id);
  };
  let role = initialRole, nextRole = 'admin', failure = null, token = 'local-captcha';
  let listener, heldProfile;
  const calls = [];
  const auth = {
    getUser: async () => role ? { id: 'account', email: 'fixture@example.com' } : null,
    getProfile: async user => { assert.equal(user.id, 'account'); return heldProfile || { id: 'account', is_admin: role === 'admin' }; },
    signIn: async (...args) => { calls.push(args); if (failure) return { error: failure }; role = nextRole; return { error: null }; },
    signOut: async () => { role = null; if (listener) listener('SIGNED_OUT'); return { error: null }; },
    onAuthChange: callback => { listener = callback; },
  };
  const Consultia = { Auth: auth, Turnstile: { render() {}, getToken: async () => token, reset() {} } };
  let redirects = 0, initialized = 0;
  const context = vm.createContext({
    window: { Consultia, location: { replace() { redirects++; } } },
    document: { getElementById: get }, console, setTimeout, clearTimeout,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/admin/auth.js'), 'utf8'), context);
  const admin = Consultia.Admin;
  return {
    admin, get, calls,
    init: () => admin.initAuth(() => initialized++),
    submit: () => get('adminLoginForm').listeners.submit({ preventDefault() {} }),
    setRole(value) { nextRole = value; },
    fail(value) { failure = value; },
    captcha(value) { token = value; },
    hold(value) { heldProfile = value; },
    state: () => ({ initialized, redirects, login: !get('adminLogin').hidden, panel: !get('adminApp').hidden, authenticated: admin.isLoggedIn() }),
  };
}

test('administrator login stays on its own page without redirecting into maintenance', async () => {
  const app = fixture();
  await app.init();
  assert.deepEqual(app.state(), { initialized: 0, redirects: 0, login: true, panel: false, authenticated: false });
});

test('an existing administrator session automatically opens the panel', async () => {
  const app = fixture('admin');
  await app.init();
  assert.equal(app.state().panel, true);
  assert.equal(app.state().login, false);
});

test('signing in with an administrator account opens the panel and clears the password', async () => {
  const app = fixture();
  await app.init();
  await app.submit();
  assert.equal(app.state().authenticated, true);
  assert.equal(app.state().initialized, 1);
  assert.equal(app.get('adminLoginPassword').value, '');
  assert.equal(app.calls[0][2], true);
  assert.equal(app.calls[0][3], 'local-captcha');
});

test('a browser signed in with a regular account can switch to its administrator account', async () => {
  const app = fixture('member');
  await app.init();
  assert.equal(app.state().login, true);
  assert.equal(app.state().panel, false);
  await app.submit();
  assert.equal(app.state().panel, true);
});

test('regular account credentials never open the administrator panel', async () => {
  const app = fixture();
  app.setRole('member');
  await app.init();
  await app.submit();
  assert.equal(app.state().panel, false);
  assert.equal(app.state().initialized, 0);
  assert.equal(app.get('adminLoginError').hidden, false);
});

test('failed credentials restore the submit button and show an error', async () => {
  const app = fixture();
  app.fail(new Error('Invalid login credentials'));
  await app.init();
  await app.submit();
  assert.equal(app.state().panel, false);
  assert.equal(app.get('adminLoginSubmit').disabled, false);
  assert.match(app.get('adminLoginError').textContent, /contraseña/);
});

test('captcha is required before any sign-in request', async () => {
  const app = fixture();
  app.captcha(null);
  await app.init();
  await app.submit();
  assert.equal(app.calls.length, 0);
  assert.equal(app.get('adminLoginSubmit').disabled, false);
});

test('sign-out returns to the private login and reauthentication initializes the panel once', async () => {
  const app = fixture('admin');
  await app.init();
  await app.admin.logout();
  assert.equal(app.state().panel, false);
  assert.equal(app.state().login, true);
  await app.submit();
  assert.equal(app.state().panel, true);
  assert.equal(app.state().initialized, 1);
});

test('a delayed administrator profile cannot reopen the panel after sign-out', async () => {
  const app = fixture('admin');
  let finish;
  app.hold(new Promise(resolve => { finish = resolve; }));
  const initial = app.init();
  await new Promise(resolve => setTimeout(resolve, 5));
  await app.admin.logout();
  finish({ id: 'account', is_admin: true });
  await initial;
  assert.equal(app.state().panel, false);
  assert.equal(app.state().initialized, 0);
});
