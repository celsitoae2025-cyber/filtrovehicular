const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function account() {
  const documentEvents = {}, windowEvents = {};
  let focused = null;
  const element = () => {
    const classes = new Set();
    return { hidden: false, disabled: false, dataset: {}, textContent: '', attributes: {}, events: {},
      classList: { contains: n => classes.has(n), toggle: (n, on) => on ? classes.add(n) : classes.delete(n) },
      setAttribute(n, v) { this.attributes[n] = v; }, removeAttribute(n) { delete this.attributes[n]; },
      addEventListener(n, fn) { (this.events[n] ||= []).push(fn); },
      focus() { focused = this; }, contains(el) { return this === el; },
    };
  };
  const ids = Object.fromEntries(['nvAvatar','nvYoMenu','nvYoNombre','nvYoCorreo','nvAvatarGrande','nvYoAccionSaldo'].map(id => [id, element()]));
  const menuAvatar = element(), saldo = element(), units = element();
  const items = [element(), element(), element(), element()];
  const menu = ids.nvYoMenu;
  menu.hidden = true;
  menu.querySelectorAll = () => items;
  menu.contains = el => el === menu || items.includes(el);
  items.forEach(el => { el.closest = () => el.hidden ? el : menu.hidden ? menu : null; });
  const doc = {
    get activeElement() { return focused; },
    getElementById: id => ids[id] || null,
    querySelectorAll: selector => ({ '[data-avatar-iniciales]': [ids.nvAvatar, menuAvatar, ids.nvAvatarGrande], '[data-saldo]': [saldo], '[data-saldo-uni]': [units] })[selector] || [],
    addEventListener(n, fn) { (documentEvents[n] ||= []).push(fn); },
  };
  const window = { Consultia: {}, addEventListener(n, fn) { (windowEvents[n] ||= []).push(fn); } };
  const context = vm.createContext({ window, document: doc, console, location: new URL('https://example.test/app#consultar'), history: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/nueva/nucleo.js'), 'utf8'), context);
  const NV = window.Consultia.NV;
  NV.conectarMenuCuenta();
  const emit = (el, type, event = {}) => (el.events[type] || []).forEach(fn => fn({ preventDefault() {}, stopPropagation() {}, ...event }));
  return { NV, ids, items, menuAvatar, saldo, units, emit, documentEvents, windowEvents, get focused() { return focused; } };
}

test('la identidad se muestra completa y las iniciales coinciden en los tres avatares', () => {
  const s = account();
  s.NV.usuario = { email: 'juan.de.villar@correo.com' };
  s.NV.perfil = { full_name: 'Juan de Villar' };
  s.NV.pintarIdentidad();
  assert.equal(s.ids.nvYoNombre.textContent, 'Juan de Villar');
  assert.equal(s.ids.nvYoCorreo.textContent, 'juan.de.villar@correo.com');
  for (const el of [s.ids.nvAvatar, s.menuAvatar, s.ids.nvAvatarGrande]) assert.equal(el.textContent, 'JV');
  s.NV.perfil.full_name = 'María Rivera';
  s.NV.pintarIdentidad();
  assert.equal(s.ids.nvAvatar.textContent, 'MR');
  assert.match(s.ids.nvAvatar.attributes['aria-label'], /María Rivera/);
});

test('sin nombre de perfil usa los datos disponibles sin dejar la cabecera vacía', () => {
  const s = account();
  s.NV.usuario = { email: 'juan@correo.com', user_metadata: { name: 'Juan Díaz' } };
  s.NV.pintarIdentidad();
  assert.equal(s.ids.nvYoNombre.textContent, 'Juan Díaz');
  s.NV.usuario.user_metadata = {};
  s.NV.pintarIdentidad();
  assert.equal(s.ids.nvYoNombre.textContent, 'juan');
  s.NV.usuario = null;
  s.NV.pintarIdentidad();
  assert.equal(s.ids.nvYoNombre.textContent, 'Mi cuenta');
});

test('saldo ilimitado ofrece Ver pagos y un saldo por créditos ofrece Recargar', () => {
  const s = account();
  s.NV.perfil = { is_admin: true, credits_balance: 240 };
  s.NV.pintarSaldo();
  assert.equal(s.saldo.textContent, 'Ilimitado');
  assert.equal(s.units.hidden, true);
  assert.equal(s.ids.nvYoAccionSaldo.textContent, 'Ver pagos');
  s.NV.perfil.is_admin = false;
  s.NV.pintarSaldo();
  assert.equal(s.saldo.textContent, '240');
  assert.equal(s.units.hidden, false);
  assert.equal(s.ids.nvYoAccionSaldo.textContent, 'Recargar');
});

test('abre con teclado y las flechas omiten opciones ocultas', () => {
  const s = account();
  s.items[2].hidden = true;
  s.emit(s.ids.nvAvatar, 'keydown', { key: 'ArrowDown' });
  assert.equal(s.ids.nvYoMenu.hidden, false);
  assert.equal(s.ids.nvAvatar.attributes['aria-expanded'], 'true');
  assert.equal(s.focused, s.items[0]);
  s.emit(s.ids.nvYoMenu, 'keydown', { key: 'End' });
  assert.equal(s.focused, s.items[3]);
  s.emit(s.ids.nvYoMenu, 'keydown', { key: 'ArrowUp' });
  assert.equal(s.focused, s.items[1]);
  s.emit(s.ids.nvYoMenu, 'keydown', { key: 'Home' });
  assert.equal(s.focused, s.items[0]);
});

test('Escape cierra el menú y devuelve el foco al avatar', () => {
  const s = account();
  s.emit(s.ids.nvAvatar, 'click', { detail: 0 });
  assert.equal(s.focused, s.items[0]);
  s.documentEvents.keydown.forEach(fn => fn({ key: 'Escape' }));
  assert.equal(s.ids.nvYoMenu.hidden, true);
  assert.equal(s.ids.nvAvatar.attributes['aria-expanded'], 'false');
  assert.equal(s.focused, s.ids.nvAvatar);
});

test('cierra al salir con Tab, tocar fuera o elegir un destino', () => {
  const s = account();
  const open = () => s.emit(s.ids.nvAvatar, 'click', { detail: 1 });
  open();
  s.emit(s.ids.nvYoMenu, 'focusout', { relatedTarget: {} });
  assert.equal(s.ids.nvYoMenu.hidden, true);
  open();
  s.documentEvents.click.forEach(fn => fn({ target: {}, button: 1 }));
  assert.equal(s.ids.nvYoMenu.hidden, true);
  open();
  s.emit(s.ids.nvYoMenu, 'click', { target: { closest: () => s.items[1] } });
  assert.equal(s.ids.nvYoMenu.hidden, true);
  s.NV.conectarMenuCuenta();
  open();
  assert.equal(s.ids.nvYoMenu.hidden, false, 'la reconexión no duplica los eventos');
});
