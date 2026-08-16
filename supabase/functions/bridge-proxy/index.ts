// ============================================================
// bridge-proxy — Edge Function
// Proxy seguro entre el frontend y el bridge de Telegram.
//
// El frontend NUNCA debe conocer la API key del bridge. En lugar
// de llamar al bridge directamente, llama a esta edge function:
//   - Valida la sesión Supabase (JWT del usuario en Authorization).
//   - Verifica que el usuario exista y esté activo.
//   - VERIFICA QUE LA CONSULTA ESTÉ PAGADA (ver abajo).
//   - Reenvía la petición al bridge con la API key inyectada en el server.
//   - Liquida el cobro según lo que respondió el bot.
//
// ------------------------------------------------------------
// POR QUÉ SE EXIGE consulta_id  (fix de seguridad 2026-08-15)
//
// Antes esta función solo comprobaba que hubiera sesión activa. Como el
// frontend cobraba DESPUÉS de recibir los datos, cualquier usuario
// registrado podía llamar aquí por su cuenta —con curl o desde la consola
// del navegador— y consultar gratis sin límite.
//
// Ahora el orden es: el frontend cobra primero (consume_credits), recibe
// un consulta_id, y lo manda aquí. Esta función reclama esa reserva contra
// la base de datos antes de tocar el bridge. Sin una reserva válida, sin
// usar, del propio usuario y reciente, no hay consulta.
//
// La regla de negocio "si no hay resultados no se cobra" se mantiene, pero
// ahora la decide el SERVIDOR al ver la respuesta del bot, no el cliente.
// ------------------------------------------------------------
//
// Endpoints expuestos:
//   POST /functions/v1/bridge-proxy/query     { consulta_id, ... }
//   POST /functions/v1/bridge-proxy/callback  { consulta_id, ... }
//
// Variables de entorno requeridas (Supabase → Edge Functions → Secrets):
//   FV_BRIDGE_URL           — URL del bridge
//   FV_BRIDGE_API_KEY       — la API key del bridge (server-side only)
//   SUPABASE_URL            — auto-inyectado
//   SUPABASE_ANON_KEY       — auto-inyectado
//   SUPABASE_SERVICE_ROLE_KEY — auto-inyectado
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { esRespuestaVacia } from "../_shared/empty-response.ts";

// Orígenes permitidos — restringir CORS al dominio de producción y desarrollo.
const ALLOWED_ORIGINS = [
  "https://filtrovehicularperu.com",
  "https://www.filtrovehicularperu.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const BRIDGE_URL = Deno.env.get("FV_BRIDGE_URL") || "";
const BRIDGE_API_KEY = Deno.env.get("FV_BRIDGE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED_ENDPOINTS = new Set(["query", "callback"]);
const MAX_BODY_BYTES = 25 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mensajes legibles para los errores que devuelve bridge_claim_consulta.
const CLAIM_ERRORS: Record<string, string> = {
  CONSULTA_NO_ENCONTRADA: "La consulta no existe.",
  CONSULTA_AJENA: "Esa consulta no es tuya.",
  CONSULTA_YA_USADA: "Esa consulta ya se usó. Vuelve a solicitarla.",
  CONSULTA_CADUCADA: "La consulta caducó. Vuelve a solicitarla.",
};

function json(body: unknown, status = 200, req?: Request) {
  const headers = req
    ? getCorsHeaders(req)
    : getCorsHeaders(new Request("https://filtrovehicularperu.com"));
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function authenticate(req: Request): Promise<{ userId: string } | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return { userId: data.user.id };
}

async function userIsActive(userId: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  const sb = serviceClient();
  const { data, error } = await sb
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .single();
  if (error || !data) return false;
  if (!data.status) return true;
  return data.status === "active";
}

/** Llama al bridge con la API key inyectada en el servidor. */
async function callBridge(endpoint: string, body: unknown, userId: string) {
  const bridgeUrl = `${BRIDGE_URL.replace(/\/$/, "")}/${endpoint}`;
  return await fetch(bridgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": BRIDGE_API_KEY,
      "X-FV-User": userId,
    },
    body: JSON.stringify(body),
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, req);
  }
  if (!BRIDGE_URL || !BRIDGE_API_KEY) {
    return json({ error: "Bridge no configurado en el servidor" }, 500, req);
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    // Sin service role no se puede verificar el pago. Antes que cobrar mal
    // o regalar consultas, se rechaza.
    return json({ error: "Servidor mal configurado" }, 500, req);
  }

  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "";
  const endpoint = ALLOWED_ENDPOINTS.has(last) ? last : "query";

  const auth = await authenticate(req);
  if (!auth) return json({ error: "No autenticado" }, 401, req);
  const active = await userIsActive(auth.userId);
  if (!active) return json({ error: "Cuenta no activa" }, 403, req);

  const rawBody = await req.text();
  if (!rawBody) return json({ error: "Body vacío" }, 400, req);
  if (rawBody.length > MAX_BODY_BYTES) {
    return json({ error: "Body demasiado grande" }, 413, req);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return json({ error: "Body JSON inválido" }, 400, req);
  }

  // ---- Verificación de pago ----
  const consultaId = typeof body.consulta_id === "string" ? body.consulta_id : "";
  if (!consultaId || !UUID_RE.test(consultaId)) {
    return json(
      { error: "Falta consulta_id. Debes registrar la consulta antes de ejecutarla." },
      400,
      req,
    );
  }

  const sb = serviceClient();

  if (endpoint === "callback") {
    // El callback es la segunda fase de una consulta YA pagada y en curso
    // (el bot ofrece botones y el usuario elige). No se cobra ni se liquida
    // aquí: solo se comprueba que la consulta sea suya y esté viva.
    const { data: c, error: cErr } = await sb
      .from("consultas")
      .select("user_id, status")
      .eq("id", consultaId)
      .single();
    if (cErr || !c) return json({ error: "Consulta no encontrada" }, 404, req);
    if (c.user_id !== auth.userId) return json({ error: "No autorizado" }, 403, req);
    if (c.status !== "in_flight" && c.status !== "success") {
      return json({ error: "La consulta no está en curso" }, 409, req);
    }
  } else {
    // 'query': reclamar la reserva. Esto valida dueño, estado y antigüedad,
    // y la marca 'in_flight' de forma atómica para que no se reutilice.
    const { error: claimErr } = await sb.rpc("bridge_claim_consulta", {
      p_consulta_id: consultaId,
      p_user_id: auth.userId,
    });
    if (claimErr) {
      const code = (claimErr.message || "").match(
        /CONSULTA_[A-Z_]+/,
      )?.[0] || "";
      const msg = CLAIM_ERRORS[code] || "No se pudo validar el pago de la consulta.";
      console.warn(`[bridge-proxy] claim rechazado (${code || claimErr.message}) user=${auth.userId}`);
      return json({ error: msg }, 402, req);
    }
  }

  // ---- Reenviar al bridge ----
  let bridgeRes: Response;
  try {
    bridgeRes = await callBridge(endpoint, body, auth.userId);
  } catch (err) {
    console.error("[bridge-proxy] fetch al bridge falló:", err);
    if (endpoint === "query") {
      // El bridge no respondió: devolver el crédito.
      await sb.rpc("bridge_settle_consulta", {
        p_consulta_id: consultaId,
        p_ok: false,
        p_reason: "El servidor de consultas no respondió",
      });
    }
    return json(
      { error: "El servidor de consultas no está disponible", credito_devuelto: true },
      502,
      req,
    );
  }

  const text = await bridgeRes.text();

  // ---- Liquidar (solo en 'query') ----
  if (endpoint === "query") {
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* respuesta no-JSON */ }

    // Se cobra solo si el bridge respondió OK y el bot trajo datos.
    const huboDatos = bridgeRes.ok && parsed !== null && !esRespuestaVacia(parsed);

    const { error: settleErr } = await sb.rpc("bridge_settle_consulta", {
      p_consulta_id: consultaId,
      p_ok: huboDatos,
      p_reason: huboDatos ? null : "Sin resultados",
    });
    if (settleErr) {
      // No se pudo liquidar. Se registra fuerte: puede quedar un cobro sin
      // confirmar o un reembolso sin aplicar, y eso hay que revisarlo a mano.
      console.error(
        `[bridge-proxy] FALLO AL LIQUIDAR consulta=${consultaId} ok=${huboDatos}: ${settleErr.message}`,
      );
    }

    // El frontend necesita saber si se le devolvió el crédito para avisar al
    // usuario y refrescar el saldo.
    if (!huboDatos) {
      const payload = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
      return json(
        { ...payload, sin_resultados: true, credito_devuelto: true },
        bridgeRes.ok ? 200 : bridgeRes.status,
        req,
      );
    }
  }

  return new Response(text, {
    status: bridgeRes.status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type":
        bridgeRes.headers.get("Content-Type") || "application/json",
    },
  });
});
