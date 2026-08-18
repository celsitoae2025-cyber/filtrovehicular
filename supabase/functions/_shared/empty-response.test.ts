// ============================================================
// Pruebas de la decisión que mueve el dinero
// ------------------------------------------------------------
// `esRespuestaVacia` decide si una consulta se cobra o se devuelve el
// crédito. Es la única función de la plataforma en la que equivocarse
// cuesta dinero en las dos direcciones: cobrar de más al cliente, o
// regalar consultas que sí se entregaron.
//
// Por eso las respuestas de los bots están aquí escritas tal como
// llegan, y cada una dice qué debe pasar. Correr con:
//
//   deno test supabase/functions/_shared/empty-response.test.ts
// ============================================================

import { assertEquals } from "jsr:@std/assert@1";
import { esRespuestaVacia } from "./empty-response.ts";

function resp(raw: string, extra: Record<string, unknown> = {}) {
  return { parsed: { titulo: "", secciones: [], medios: [], botones: [], raw, ...extra } };
}
function conCampos(raw: string, campos: Array<{ campo: string; valor: string }>) {
  return { parsed: { titulo: "", secciones: [{ titulo: "DATOS", campos }], medios: [], botones: [], raw } };
}

// ── NO se cobra: el acuse de recibo ─────────────────────────
Deno.test("acuse: estamos procesando", () => {
  assertEquals(esRespuestaVacia(resp(
    "⏳ ESTAMOS PROCESANDO TU SOLICITUD\n─────────────\nEn breve recibirás la información solicitada. Gracias por tu paciencia.",
  )), true);
});

Deno.test("acuse: bandera en_proceso del bridge", () => {
  assertEquals(esRespuestaVacia({ en_proceso: true, parsed: { raw: "cualquier cosa larga que el bot haya mandado aquí" } }), true);
});

Deno.test("acuse: un momento por favor", () => {
  assertEquals(esRespuestaVacia(resp(
    "Hola, un momento por favor. Estamos consultando en la fuente oficial y te respondemos enseguida.",
  )), true);
});

// ── NO se cobra: fallos técnicos y del proveedor ────────────
Deno.test("fallo: timeout del bot", () => {
  assertEquals(esRespuestaVacia(resp(
    "[✖️] Error: timeout al conectar con el servicio de consulta. Intenta nuevamente.",
  )), true);
});

Deno.test("fallo: conexión caída", () => {
  assertEquals(esRespuestaVacia(resp(
    "ECONNRESET - connection reset by peer. No se pudo completar la operación solicitada por el usuario.",
  )), true);
});

Deno.test("fallo: el proveedor sin créditos", () => {
  assertEquals(esRespuestaVacia(resp(
    "⚠️ Créditos insuficientes en tu plan. Recarga para seguir usando el servicio de consultas.",
  )), true);
});

Deno.test("fallo: proveedor en mantenimiento", () => {
  assertEquals(esRespuestaVacia(resp(
    "🔧 El servicio se encuentra en mantenimiento programado. Vuelve a intentarlo más tarde, disculpa las molestias.",
  )), true);
});

Deno.test("fallo: no se pudo extraer el documento", () => {
  assertEquals(esRespuestaVacia(resp(
    "No se pudo extraer la información del documento PDF entregado por la fuente oficial consultada.",
  )), true);
});

// ── NO se cobra: sin resultados ─────────────────────────────
Deno.test("sin datos: dni no encontrado", () => {
  assertEquals(esRespuestaVacia(resp(
    "[✖️] No se encontraron resultados para el DNI consultado en la base de datos de RENIEC.",
  )), true);
});

Deno.test("sin datos: respuesta vacía", () => {
  assertEquals(esRespuestaVacia(resp("")), true);
});

Deno.test("sin datos: objeto sin parsed", () => {
  assertEquals(esRespuestaVacia({}), true);
});

// ── SÍ se cobra: la consulta se entregó ─────────────────────
Deno.test("resultado: ficha con campos", () => {
  assertEquals(esRespuestaVacia(conCampos("[☑️] CONSULTA EXITOSA", [
    { campo: "NOMBRES", valor: "JUAN CARLOS" },
    { campo: "DNI", valor: "12345678" },
  ])), false);
});

Deno.test("resultado: un PDF sin texto", () => {
  assertEquals(esRespuestaVacia({
    parsed: { titulo: "", secciones: [], botones: [], raw: "", medios: [{ tipo: "pdf", filename: "boleta.pdf" }] },
  }), false);
});

Deno.test("resultado: listado con botones para elegir", () => {
  assertEquals(esRespuestaVacia({
    parsed: {
      titulo: "SUNARP PROPIEDADES", secciones: [], medios: [], raw: "Elige una partida",
      botones: [{ text: "02074045 - CUSCO", data: "x" }],
    },
  }), false);
});

// Los casos que más caro salen: un resultado bueno que MENCIONA una de
// las palabras de fallo dentro de sus datos. Se cobra igual — la consulta
// se entregó.
Deno.test("resultado: un campo dice «en mantenimiento»", () => {
  assertEquals(esRespuestaVacia(conCampos("[☑️] ESTADO DEL VEHICULO", [
    { campo: "PLACA", valor: "ABC-123" },
    { campo: "OBSERVACION", valor: "UNIDAD EN MANTENIMIENTO" },
  ])), false);
});

Deno.test("resultado: un campo habla de límite de crédito", () => {
  assertEquals(esRespuestaVacia(conCampos("[☑️] REPORTE FINANCIERO", [
    { campo: "ENTIDAD", valor: "BANCO X" },
    { campo: "LIMITE DIARIO", valor: "S/ 2,000" },
  ])), false);
});

Deno.test("resultado: ficha larga sin campos parseados", () => {
  assertEquals(esRespuestaVacia(resp(
    "PROPIETARIO: JUAN PEREZ LOPEZ | PLACA: X1B-234 | MARCA: TOYOTA | MODELO: YARIS | AÑO: 2018 | COLOR: BLANCO | MOTOR: 2NZ1234567",
  )), false);
});
