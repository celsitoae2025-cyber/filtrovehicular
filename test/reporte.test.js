/* ============================================================
   El modelo y el veredicto del Reporte Vehicular

   Estas pruebas existen por una razón concreta: de aquí sale lo que el
   documento AFIRMA. Mientras solo reimprimíamos el PDF del proveedor, un
   error nuestro era un error de maquetación. Desde que escribimos «se
   puede transferir» o «debe S/ 22 000», un error nuestro es una decisión
   de compra mal tomada.

   Se prueban con secciones inventadas a mano y no con una respuesta real
   del bot, a propósito: la respuesta real todavía no la hemos visto, y
   estas reglas tienen que valer igual cuando llegue. Lo que sí hace
   falta comprobar contra una respuesta de verdad es la TABLA DE
   ETIQUETAS del modelo — qué nombre le da el proveedor a cada campo—, y
   para eso está `noMapeado`.

   Correr con:  npm test
============================================================ */

const test = require('node:test');
const assert = require('node:assert');

const Modelo = require('../js/modules/reporte-modelo.js');
const Veredicto = require('../js/modules/reporte-veredicto.js');

// Un "hoy" fijo: si dependiera del reloj, las pruebas de vencimientos
// empezarían a fallar solas dentro de unos meses.
const HOY = new Date(2026, 7, 25);   // 25/08/2026

function kv(a, b) { return { t: 'kv', a: a, b: b }; }
function row() { return { t: 'row', cells: [].slice.call(arguments) }; }

function seccion(titulo, filas) {
  return { titulo: titulo, filas: filas || [], imgs: [] };
}

// ── Normalizadores ──────────────────────────────────────────────────
test('los importes se leen en los dos formatos y no se inventan ceros', () => {
  assert.strictEqual(Modelo.aImporte('S/ 22,000.50'), 22000.5);
  assert.strictEqual(Modelo.aImporte('22.000,50'), 22000.5);
  assert.strictEqual(Modelo.aImporte('22,000'), 22000, 'tres cifras detrás son millares');
  assert.strictEqual(Modelo.aImporte('S/. 1 250'), 1250, 'el punto del símbolo no es decimal');
  assert.strictEqual(Modelo.aImporte('sin deuda'), null, 'sin dígitos no hay importe');
  assert.strictEqual(Modelo.aImporte('0'), 0, 'cero es un dato, no la ausencia de dato');
});

test('las fechas imposibles no se dan por buenas', () => {
  assert.strictEqual(Modelo.aFecha('14/08/2026').iso, '2026-08-14');
  assert.strictEqual(Modelo.aFecha('2026-08-14').iso, '2026-08-14');
  assert.strictEqual(Modelo.aFecha('31/02/2026'), null, 'febrero no tiene 31');
  assert.strictEqual(Modelo.aFecha('—'), null);
});

// ── Modelo ──────────────────────────────────────────────────────────
test('lo que no se entiende se guarda, no se tira', () => {
  const m = Modelo.desdeSecciones([
    seccion('I DATOS DEL VEHICULO', [
      kv('MARCA', 'SUZUKI'),
      kv('CAMPO RARISIMO DEL PROVEEDOR', 'algo'),
    ]),
  ], 'BAF144');

  assert.strictEqual(m.vehiculo.marca, 'SUZUKI');
  assert.strictEqual(m.noMapeado.length, 1);
  assert.strictEqual(m.noMapeado[0].campo, 'CAMPO RARISIMO DEL PROVEEDOR');
});

test('una sección que no respondió no es una sección limpia', () => {
  const m = Modelo.desdeSecciones([
    seccion('II PAPELETAS ATU', []),                                  // no respondió
    seccion('III PAPELETAS SUTRAN', [kv('RESULTADO', 'NO REGISTRA')]), // respondió: nada
  ], 'BAF144');

  const atu = m.cobertura.find(c => /ATU/.test(c.fuente));
  const sutran = m.cobertura.find(c => /SUTRAN/.test(c.fuente));
  assert.strictEqual(atu.estado, 'sin respuesta');
  assert.strictEqual(sutran.estado, 'sin registros');
  assert.strictEqual(m.deudas.length, 0, 'ninguna de las dos aporta deuda');
});

test('la deuda se suma por entidad y sale ordenada de mayor a menor', () => {
  const m = Modelo.desdeSecciones([
    seccion('IV DEUDAS ATU', [
      row('P-001', '12/03/2025', 'S/ 1,200.00'),
      row('P-002', '04/07/2025', 'S/ 800.00'),
    ]),
    seccion('V SAT LIMA', [row('M-77', '01/01/2026', 'S/ 20,000.00')]),
  ], 'BAF144');

  const d = Veredicto.deuda(m);
  assert.strictEqual(d.total, 22000);
  assert.strictEqual(d.partes[0].entidad, 'SAT Lima', 'primero la más grande');
  assert.strictEqual(d.partes[1].registros, 2);
  assert.ok(d.completa, 'todas las fuentes respondieron');
});

// ── Veredicto ───────────────────────────────────────────────────────
test('una vigencia vencida impide circular, y se dice desde cuándo', () => {
  const m = Modelo.desdeSecciones([
    seccion('I RESUMEN', [
      kv('SOAT', 'VIGENTE'),
      kv('VIGENCIA SOAT', '25/02/2027'),
      kv('REVISION TECNICA', 'VENCIDO'),
      kv('VIGENCIA REVISION', '14/08/2026'),
    ]),
  ], 'BAF144');

  const c = Veredicto.circular(m, HOY);
  assert.strictEqual(c.estado, 'no');
  assert.strictEqual(c.resumen, 'Revisión técnica vencida hace 11 días');
});

test('manda la fecha y no la palabra del proveedor', () => {
  // Dice VIGENTE pero la fecha ya pasó: un «vigente» sin actualizar no
  // puede tapar una fecha vencida.
  const m = Modelo.desdeSecciones([
    seccion('I RESUMEN', [kv('SOAT', 'VIGENTE'), kv('VIGENCIA SOAT', '01/01/2026')]),
  ], 'BAF144');
  assert.strictEqual(Veredicto.vigencia(m.vigencias.soat, HOY).estado, 'vencido');
});

test('lo que vence pronto se avisa aunque todavía valga', () => {
  const m = Modelo.desdeSecciones([
    seccion('I RESUMEN', [kv('SOAT', 'VIGENTE'), kv('VIGENCIA SOAT', '10/09/2026')]),
  ], 'BAF144');
  const v = Veredicto.vigencia(m.vigencias.soat, HOY);
  assert.strictEqual(v.estado, 'por vencer');
  assert.strictEqual(v.dias, 16);
});

test('una orden de captura impide transferir; un siniestro solo avisa', () => {
  const bloqueado = Modelo.desdeSecciones([
    seccion('VI ORDENES DE CAPTURA', [row('OC-9', '2024', 'VIGENTE')]),
  ], 'BAF144');
  assert.strictEqual(Veredicto.transferir(bloqueado).estado, 'no');

  const avisado = Modelo.desdeSecciones([
    seccion('VII SINIESTRALIDAD', [row('S-1', '2023', 'CHOQUE')]),
  ], 'BAF144');
  const t = Veredicto.transferir(avisado);
  assert.strictEqual(t.estado, 'con reparos');
  assert.notStrictEqual(t.estado, 'si', 'un siniestro no deja el vehículo como limpio');
});

test('una fuente muda nunca deja el veredicto en «sí»', () => {
  const m = Modelo.desdeSecciones([
    seccion('VIII ORDENES DE CAPTURA', []),   // no respondió
  ], 'BAF144');
  const t = Veredicto.transferir(m);
  assert.strictEqual(t.estado, 'con reparos');
  assert.match(t.resumen, /no respondió/);
});

test('sin nada que reprochar, y con todo consultado, el veredicto sí es «sí»', () => {
  const m = Modelo.desdeSecciones([
    seccion('I RESUMEN', [
      kv('SOAT', 'VIGENTE'), kv('VIGENCIA SOAT', '25/02/2027'),
      kv('REVISION TECNICA', 'VIGENTE'), kv('VIGENCIA REVISION', '30/06/2027'),
    ]),
    seccion('II PAPELETAS ATU', [kv('RESULTADO', 'NO REGISTRA')]),
  ], 'BAF144');

  assert.strictEqual(Veredicto.circular(m, HOY).estado, 'si');
  assert.strictEqual(Veredicto.transferir(m).estado, 'si');
  assert.strictEqual(Veredicto.nivel(m, HOY).nivel, 'BAJO');
});

test('el caso de BAF144: deuda alta y revisión vencida dan riesgo ALTO', () => {
  const m = Modelo.desdeSecciones([
    seccion('I RESUMEN', [
      kv('PROPIETARIO', 'SAENZ PORTUGAL MANUEL ERNESTO GONZALO'),
      kv('DNI', '46221790'),
      kv('SOAT', 'VIGENTE'), kv('ASEGURADORA', 'INTERSEGURO'),
      kv('VIGENCIA SOAT', '25/02/2027'),
      kv('REVISION TECNICA', 'VENCIDO'), kv('VIGENCIA REVISION', '14/08/2026'),
    ]),
    seccion('II DEUDA ATU', [row('P-1', '2025', 'S/ 22,000.00')]),
    seccion('III DENUNCIAS PNP', [row('D-1', '2024', 'HURTO')]),
  ], 'BAF144');

  const r = Veredicto.nivel(m, HOY);
  assert.strictEqual(r.nivel, 'ALTO');
  assert.strictEqual(r.deuda.totalTexto, 'S/ 22,000.00');
  assert.strictEqual(m.titularidad.propietario, 'SAENZ PORTUGAL MANUEL ERNESTO GONZALO');
  assert.ok(r.motivos.some(x => /No puede circular/.test(x)));
});
