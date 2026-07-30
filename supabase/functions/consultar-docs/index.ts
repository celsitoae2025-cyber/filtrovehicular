// ============================================================
// consultar-docs — Edge Function
// Proxy a docs.json.pe (api.json.pe) para las 3 consultas gratis:
// Placa, SOAT, Licencia de Conducir.
//
// Flujo:
//   1. Recibe del frontend { type, value } con el tipo de consulta
//      y el dato (placa o DNI).
//   2. Valida usuario autenticado.
//   3. Valida tope de consultas gratis (máx 2 por usuario).
//   4. Llama a api.json.pe con el token DOCSJSON_TOKEN.
//   5. Si responde OK: incrementa free_queries_used del usuario.
//   6. Devuelve la respuesta al frontend.
//
// Variables de entorno:
//   DOCSJSON_TOKEN            — token Bearer de api.json.pe
//   SUPABASE_URL              — auto
//   SUPABASE_SERVICE_ROLE_KEY — auto
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOCSJSON_TOKEN = Deno.env.get("DOCSJSON_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const ENDPOINTS: Record<string, { url: string; field: "placa" | "dni" }> = {
  placa:    { url: "https://api.json.pe/api/placa",    field: "placa" },
  soat:     { url: "https://api.json.pe/api/soat",     field: "placa" },
  licencia: { url: "https://api.json.pe/api/licencia", field: "dni"   }
};

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Método no permitido" });

  if (!DOCSJSON_TOKEN) return jsonResponse(500, { error: "DOCSJSON_TOKEN no configurado" });

  // Verificar sesión del usuario — el JWT viene en el header de Supabase
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse(401, { error: "Sesión requerida" });

  const sbUrl = Deno.env.get("SUPABASE_URL") || "";
  const sbAnon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const userClient = createClient(sbUrl, sbAnon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData || !userData.user) {
    return jsonResponse(401, { error: "Sesión inválida" });
  }
  const userId = userData.user.id;

  // Leer body del request
  let body: { type?: string; value?: string } = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const type = (body.type || "").toLowerCase();
  const value = (body.value || "").trim();

  if (!ENDPOINTS[type]) {
    return jsonResponse(400, { error: "Tipo de consulta no soportado" });
  }
  if (!value) {
    return jsonResponse(400, { error: "Valor requerido (placa o DNI)" });
  }

  // Validar y consumir consulta gratis usando el RPC
  // (falla si ya usó 2 — ese es el tope)
  const svc = getServiceClient();
  if (!svc) return jsonResponse(500, { error: "Supabase no disponible" });

  // Primero consultar la API — si falla no consumimos la consulta gratis
  const endpoint = ENDPOINTS[type];
  const payload: Record<string, string> = {};
  payload[endpoint.field] = value;

  let apiRes: Response;
  try {
    apiRes = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DOCSJSON_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("[consultar-docs] fetch error:", err);
    return jsonResponse(502, { error: "No se pudo conectar con el servicio de consulta" });
  }

  const apiText = await apiRes.text();
  let apiJson: { success?: boolean; message?: string; data?: unknown } = {};
  try { apiJson = JSON.parse(apiText); } catch {
    return jsonResponse(502, { error: "Respuesta inválida del servicio", detail: apiText.slice(0, 200) });
  }

  if (!apiRes.ok || apiJson.success === false) {
    const msg = apiJson.message || `Error ${apiRes.status} del servicio`;
    return jsonResponse(apiRes.status || 502, { error: msg });
  }

  // Consulta OK → consumir 1 de las 2 gratis (falla si ya llegó al tope)
  const { data: newCount, error: rpcErr } = await svc.rpc("increment_free_queries", {
    target_user_id: userId
  });

  if (rpcErr) {
    const msg = rpcErr.message || "";
    if (msg.includes("Límite")) {
      // Devolvemos 200 con la bandera para que el frontend lo maneje como
      // caso de negocio (toast informativo), no como error HTTP.
      return jsonResponse(200, {
        error: "Ya usaste tus 2 consultas gratis. Compra créditos para continuar.",
        limit_reached: true
      });
    }
    console.error("[consultar-docs] rpc error:", rpcErr);
    return jsonResponse(500, { error: "Error contando consultas gratis" });
  }

  return jsonResponse(200, {
    data: apiJson.data,
    free_queries_used: newCount,
    free_queries_remaining: Math.max(0, 2 - (newCount || 0))
  });
});
