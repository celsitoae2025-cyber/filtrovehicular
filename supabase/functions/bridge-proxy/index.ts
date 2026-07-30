// ============================================================
// bridge-proxy — Edge Function
// Proxy seguro entre el frontend y el bridge de Telegram.
//
// El frontend NUNCA debe conocer la API key del bridge. En lugar
// de llamar al bridge directamente, llama a esta edge function:
//   - Valida la sesión Supabase (JWT del usuario en Authorization).
//   - Verifica que el usuario exista y esté activo.
//   - Reenvía la petición al bridge con la API key inyectada en el server.
//
// Endpoints expuestos:
//   POST /functions/v1/bridge-proxy/query
//   POST /functions/v1/bridge-proxy/callback
//
// Variables de entorno requeridas (Supabase → Edge Functions → Secrets):
//   FV_BRIDGE_URL           — https://filtro-bridge-production-6a68.up.railway.app
//   FV_BRIDGE_API_KEY       — la API key del bridge (server-side only)
//   SUPABASE_URL            — auto-inyectado
//   SUPABASE_ANON_KEY       — auto-inyectado
//   SUPABASE_SERVICE_ROLE_KEY — auto-inyectado (para leer profiles bypass RLS)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Endpoints permitidos en el bridge — todo lo demás se rechaza.
const ALLOWED_ENDPOINTS = new Set(["query", "callback"]);

// Tamaño máximo del body que aceptamos (25 MB para reconocimiento facial).
const MAX_BODY_BYTES = 25 * 1024 * 1024;

function json(body: unknown, status = 200, req?: Request) {
  const headers = req ? getCorsHeaders(req) : getCorsHeaders(new Request("https://filtrovehicularperu.com"));
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
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
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await sb
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .single();
  if (error || !data) return false;
  // status válidos: 'active' o null/undefined (legacy).
  // Bloqueados: 'banned', 'suspended', etc.
  if (!data.status) return true;
  return data.status === "active";
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

  // Determinar endpoint a partir de la URL.
  // Path posibles:
  //   /functions/v1/bridge-proxy            → defecto = query
  //   /functions/v1/bridge-proxy/query
  //   /functions/v1/bridge-proxy/callback
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "";
  const endpoint = ALLOWED_ENDPOINTS.has(last) ? last : "query";

  // Auth: el frontend manda el JWT del usuario en Authorization.
  const auth = await authenticate(req);
  if (!auth) return json({ error: "No autenticado" }, 401, req);
  const active = await userIsActive(auth.userId);
  if (!active) return json({ error: "Cuenta no activa" }, 403, req);

  // Validar tamaño del body (defensa frente a abuso).
  // Siempre verificar el content-length (obligatorio en POST requests).
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength === 0) {
    return json({ error: "Content-Length requerido" }, 400, req);
  }
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "Body demasiado grande" }, 413, req);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON inválido" }, 400, req);
  }

  // Reenviar al bridge con la API key inyectada en server.
  const bridgeUrl = `${BRIDGE_URL.replace(/\/$/, "")}/${endpoint}`;
  let bridgeRes: Response;
  try {
    bridgeRes = await fetch(bridgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": BRIDGE_API_KEY,
        // Trazabilidad opcional: el bridge puede registrar quién consultó.
        "X-FV-User": auth.userId,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[bridge-proxy] fetch al bridge falló:", err);
    return json(
      { error: "El servidor de consultas no está disponible" },
      502,
      req,
    );
  }

  // Pasamos status y body tal cual del bridge para que el frontend
  // distinga entre 200, 401, 503, etc.
  const text = await bridgeRes.text();
  return new Response(text, {
    status: bridgeRes.status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type":
        bridgeRes.headers.get("Content-Type") || "application/json",
    },
  });
});
