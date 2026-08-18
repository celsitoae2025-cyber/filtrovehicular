// ============================================================
// empty-response.ts — ¿la respuesta del bot trajo datos o no?
//
// Esta es la MISMA heurística que el frontend usaba en
// js/modules/consulta-runner.js (esRespuestaVacia). Se trajo al servidor
// porque de ella depende si se cobra o se devuelve el crédito, y esa
// decisión no puede vivir en el navegador: cualquiera la manipula desde
// la consola.
//
// El frontend conserva su copia SOLO para el mensaje que ve el usuario.
// La versión que manda es esta. Si se cambia una, cambiar la otra.
// ============================================================

// El acuse de recibo del proveedor: «estamos procesando tu solicitud».
// No es un resultado — es el bot diciendo que empezó a trabajar. Si esto
// se cuenta como respuesta buena, el cliente paga por un aviso y vuelve a
// pagar en cada reintento hasta que llegue el dato de verdad.
//
// La misma lista vive en el frontend (render-helpers.js, RE_EN_PROCESO)
// para el mensaje que ve el usuario. Si se cambia una, cambiar la otra.
const EN_PROCESO_PATTERNS: RegExp[] = [
  /estamos\s+procesando/i,
  /procesando\s+(tu|su)\s+(solicitud|consulta|pedido)/i,
  /solicitud\s+en\s+proceso/i,
  /un\s+momento\s+por\s+favor/i,
  /aguard[ae]\s+un\s+momento/i,
  /espera\s+un\s+momento/i,
  /en\s+breve\s+te\s+respond/i,
];

const NO_RESULT_PATTERNS: RegExp[] = [
  /no\s+se\s+(tuvo|obtuvo|han?)\s+(ning[uú]n|resultad)/i,
  /no\s+se\s+(encontr|hall|obtuv)/i,
  /no\s+se\s+encuentr/i,
  /sin\s+(resultad|informaci|registr|datos)/i,
  /ning[uú]n\s+resultad/i,
  /no\s+hay\s+(informaci|datos|resultad|registr)/i,
  /no\s+existe/i,
  /no\s+encontrad/i,
  /no\s+registrad/i,
  /no\s+tiene\s+informaci/i,
  /informaci[óo]n\s+no\s+disponible/i,
  /placa\s+no\s+(registrad|encontrad|existe)/i,
  /dni\s+no\s+(registrad|encontrad|existe)/i,
  /ruc\s+no\s+(registrad|encontrad|existe)/i,
  /datos\s+no\s+encontrad/i,
  /consulta\s+sin\s+resultad/i,
  /persona\s+no\s+registrad/i,
  /vehiculo\s+no\s+registrad/i,
  /no\s+cuenta\s+con/i,
];

const ERROR_PATTERNS: RegExp[] = [
  /error\s+en\s+la\s+consulta/i,
  /no\s+se\s+pudo\s+obtener/i,
  /no\s+se\s+pudo\s+(consultar|procesar|completar)/i,
  /cr[eé]ditos?\s+devuelt/i,
  /servicio\s+(no\s+disponible|temporalmente)/i,
  /intenta\s+(de\s+)?nuevo|reintenta(r|s)?\s+/i,
  /fallo\s+(en\s+la\s+)?consulta/i,
];

type Dict = Record<string, unknown>;

function asStr(v: unknown): string {
  return v == null ? "" : String(v);
}

function collectResponseText(p: Dict | null): string {
  const parts: string[] = [];
  if (!p) return "";
  if (p.titulo) parts.push(asStr(p.titulo));
  if (p.subtitulo) parts.push(asStr(p.subtitulo));
  if (p.mensaje) parts.push(asStr(p.mensaje));
  if (p.texto) parts.push(asStr(p.texto));
  if (Array.isArray(p.secciones)) {
    for (const s of p.secciones as Dict[]) {
      if (!s) continue;
      if (s.titulo) parts.push(asStr(s.titulo));
      if (s.nota) parts.push(asStr(s.nota));
      if (Array.isArray(s.campos)) {
        for (const c of s.campos as Dict[]) {
          if (!c) continue;
          if (c.campo) parts.push(asStr(c.campo));
          if (c.valor != null) parts.push(asStr(c.valor));
        }
      }
    }
  }
  return parts.join(" ");
}

function contieneFraseSinResultados(text: string): boolean {
  const s = (text || "").trim();
  if (!s) return false;
  // El bot marca sus respuestas negativas con "[✖️]" al inicio, frente a
  // "[☑️]" cuando sí hay datos. Ese marcador es más fiable que intentar
  // cubrir todas las frases posibles en español.
  if (/^\[?\s*✖/.test(s)) return true;
  if (ERROR_PATTERNS.some((re) => re.test(s))) return true;
  return NO_RESULT_PATTERNS.some((re) => re.test(s));
}

/**
 * true  → el bot no trajo datos ⇒ hay que devolver el crédito.
 * false → hubo resultado ⇒ la consulta se queda cobrada.
 *
 * Ante la duda devuelve false (cobrar): un fallo del parseo no debe
 * convertirse en consultas gratis.
 */
export function esRespuestaVacia(resp: unknown): boolean {
  if (!resp || typeof resp !== "object") return true;
  const r = resp as Dict;
  // El bridge lo dice cuando cerró la espera con el acuse en la mano y
  // nada más. No hay que adivinarlo por el texto.
  if (r.en_proceso === true) return true;
  const p = (r.parsed && typeof r.parsed === "object")
    ? (r.parsed as Dict)
    : null;

  const rawText = p && p.raw
    ? asStr(p.raw).trim()
    : (r.raw ? asStr(r.raw).trim() : "");

  if (!p) {
    if (!rawText) return true;
    if (contieneFraseSinResultados(rawText)) return true;
    return false;
  }

  const secciones = Array.isArray(p.secciones) ? (p.secciones as Dict[]) : [];
  const hasSecciones = secciones.some(
    (s) => s && Array.isArray(s.campos) && (s.campos as unknown[]).length > 0,
  );

  /* El acuse de recibo, antes que nada. Trae texto largo y a veces el logo
     del proveedor, así que pasaba por «tiene contenido» y se cobraba; con
     el reintento, otra vez, y otra. Mientras no traiga NI UN campo con
     datos, es un aviso: se devuelve el crédito y el cliente sigue
     esperando su consulta sin pagarla dos veces. */
  const textoAcuse = [
    rawText,
    asStr(p.titulo),
    asStr(p.mensaje),
  ].filter(Boolean).join(" ");
  if (!hasSecciones && EN_PROCESO_PATTERNS.some((re) => re.test(textoAcuse))) {
    return true;
  }
  const hasMedios = Array.isArray(p.medios) && (p.medios as unknown[]).length > 0;
  const hasBotones = Array.isArray(p.botones) && (p.botones as unknown[]).length > 0;
  const hasTitulo = !!p.titulo && asStr(p.titulo).trim().length > 0;
  const hasRawContent = rawText.length > 40;

  if (!(hasSecciones || hasMedios || hasBotones || hasTitulo || hasRawContent)) {
    return true;
  }

  const allText = collectResponseText(p);
  if (contieneFraseSinResultados(allText)) return true;
  if (rawText && contieneFraseSinResultados(rawText)) return true;

  return false;
}
