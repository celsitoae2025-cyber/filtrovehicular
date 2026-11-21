const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function helpers() {
  const window = { Consultia: {} };
  const context = vm.createContext({ window, Consultia: window.Consultia });
  for (const file of ['email-validator.js', 'auth-form-utils.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/shared', file), 'utf8'), context);
  }
  return window.Consultia;
}

test('correo con formato inválido se rechaza antes de autenticar o recuperar', () => {
  const { EmailValidator: email } = helpers();
  for (const value of ['', 'correo', 'a@b', 'a@@b.com', 'a b@example.com', null]) {
    assert.equal(email.isValidFormat(value), false, String(value));
  }
  assert.equal(email.isValidFormat(' revision+prueba@example.com '), true);
  assert.equal(email.validate('a@mailinator.com').ok, false);
  assert.equal(email.isValidFormat('a@mailinator.com'), true, 'una cuenta previa puede recuperar su acceso');
});

test('teléfono requiere dígitos y conserva el prefijo internacional al normalizar', () => {
  const { AuthForm: forms } = helpers();
  assert.equal(forms.normalizePhone(' 999 123-456 '), '999123456');
  assert.equal(forms.normalizePhone('+51 (999) 123-456'), '+51999123456');
  for (const value of ['------', '++++++', '12+345678', '12345', '1234567890123456', 'abc999999', '']) {
    assert.equal(forms.normalizePhone(value), '', value);
  }
});

test('la regla compartida rechaza contraseñas incompletas y permite una clave fuerte', () => {
  const { AuthForm: forms } = helpers();
  for (const value of ['abcdefgh', 'ABCDEFGH', '12345678', 'Abcdefgh', 'Abcdefg1', 'Ab1!']) {
    assert.equal(forms.isStrongPassword(value), false, value);
  }
  assert.equal(forms.isStrongPassword('Local-Only-123!'), true);
});

test('un reenvío pendiente bloquea solicitudes duplicadas y comienza la espera al terminar', async () => {
  const { AuthForm: forms } = helpers();
  let now = 1000, finish, calls = 0;
  const gate = forms.createResendGate(30000, () => now);
  const send = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const first = gate.run('a@example.com', send);
  assert.equal(await gate.run('a@example.com', send), false);
  assert.equal(await gate.run('b@example.com', send), false);
  assert.equal(calls, 1);
  now += 5000;
  finish();
  assert.equal(await first, true);
  assert.equal(gate.state('a@example.com').remaining, 30);
  assert.equal(await gate.run('a@example.com', send), false);
  now += 30000;
  assert.equal(await gate.run('a@example.com', async () => { calls++; }), true);
  assert.equal(calls, 2);
});

test('un fallo de envío libera el botón sin imponer espera ni impedir un reintento', async () => {
  const { AuthForm: forms } = helpers();
  const gate = forms.createResendGate(30000, () => 1000);
  await assert.rejects(gate.run('a@example.com', async () => { throw new Error('Failed to fetch'); }), /fetch/);
  assert.equal(gate.state('a@example.com').busy, false);
  assert.equal(gate.state('a@example.com').remaining, 0);
  assert.equal(await gate.run('a@example.com', async () => {}), true);
});

test('cambiar de destinatario no borra la espera del correo anterior', async () => {
  const { AuthForm: forms } = helpers();
  const gate = forms.createResendGate(30000, () => 1000);
  assert.equal(await gate.run('a@example.com', async () => {}), true);
  assert.equal(await gate.run('b@example.com', async () => {}), true);
  assert.equal(await gate.run('a@example.com', async () => {}), false);
  assert.equal(await gate.run(' A@EXAMPLE.COM ', async () => {}), false);
});
