// ============================================================
// crear-preferencia — Edge Function
// Genera una preferencia de pago en Mercado Pago para un plan
// del catálogo de Filtro Vehicular+
//
// Recibe: { plan_id }   (user_id y email se extraen del JWT)
// Devuelve: { init_point, preference_id }
//
// Variables de entorno requeridas (Supabase → Edge Functions → Secrets):
//   MP_ACCESS_TOKEN     — token de producción de tu cuenta MP
//   SITE_URL            — https://filtrovehicularperu.com (o localhost:5500 para dev)
//   SUPABASE_URL        — auto-inyectado por Supabase
//   SUPABASE_ANON_KEY   — auto-inyectado por Supabase
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  findPlan,
  planCreditsToGrant,
  type AnyPlan,
} from "../_shared/plans.ts";

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const SITE_URL = Deno.env.get("SITE_URL") || "";
  const allowed = [SITE_URL];
  if (Deno.env.get("DEV_ORIGIN")) allowed.push(Deno.env.get("DEV_ORIGIN")!);

  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || "";
    const SITE_URL = Deno.env.get("SITE_URL") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!MP_ACCESS_TOKEN) {
      return json({ error: "MP_ACCESS_TOKEN no configurado en secrets" }, 500, corsHeaders);
    }
    if (!SITE_URL) {
      return json({ error: "SITE_URL no configurado en secrets" }, 500, corsHeaders);
    }

    // --- Autenticación: extraer usuario del JWT ---
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Token de autenticación requerido" }, 401, corsHeaders);
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) {
      return json({ error: "Sesión inválida o expirada" }, 401, corsHeaders);
    }

    const user_id = user.id;
    const user_email = user.email || "";

    // --- Validar plan ---
    const { plan_id } = await req.json();

    if (!plan_id) {
      return json({ error: "Falta plan_id" }, 400, corsHeaders);
    }

    const plan: AnyPlan | null = findPlan(plan_id);
    if (!plan) {
      return json({ error: `Plan ${plan_id} no existe` }, 400, corsHeaders);
    }
    // No permitir iniciar checkout de planes desactivados (ej. cp-test, planes
    // retirados). findPlan no filtra por `active` a propósito — el webhook debe
    // seguir acreditando pagos ya aprobados aunque el plan se desactive después.
    // Excepción: los administradores sí pueden comprar planes inactivos, para
    // probar el flujo de pago real (botón de prueba del panel admin).
    if (!plan.active) {
      const { data: prof } = await sb
        .from("profiles")
        .select("is_admin")
        .eq("id", user_id)
        .maybeSingle();
      if (!prof?.is_admin) {
        return json({ error: `Plan ${plan_id} no disponible` }, 400, corsHeaders);
      }
    }

    // external_reference: se devuelve en el webhook — no confiar en el cliente.
    const externalRef = JSON.stringify({
      plan_id,
      user_id,
      user_email,
      credits: plan.type === "recarga" ? planCreditsToGrant(plan) : 0,
      days: plan.type === "suscripcion" ? plan.days : 0,
      tier: "tier" in plan ? plan.tier : null,
      type: plan.type,
      price: plan.price,
    });

    const preference = {
      items: [
        {
          title: `Filtro Vehicular+ — ${plan.title}`,
          quantity: 1,
          unit_price: plan.price,
          currency_id: "PEN",
        },
      ],
      payer: { email: user_email },
      external_reference: externalRef,
      back_urls: {
        success: `${SITE_URL}/pago-exitoso.html`,
        failure: `${SITE_URL}/pago-pendiente.html?status=failure`,
        pending: `${SITE_URL}/pago-pendiente.html?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${SUPABASE_URL}/functions/v1/webhook-mercadopago`,
      statement_descriptor: "FILTRO VEHICULAR+",
      metadata: { plan_id, user_id },
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP error:", JSON.stringify(data));
      return json({ error: "Error al crear preferencia de pago", detail: data }, 500, corsHeaders);
    }

    return json({ init_point: data.init_point, preference_id: data.id }, 200, corsHeaders);
  } catch (err) {
    console.error("crear-preferencia error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500, corsHeaders);
  }
});

function json(body: unknown, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
