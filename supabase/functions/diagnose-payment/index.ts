// ============================================================
// diagnose-payment — herramienta de diagnóstico de pagos (SOLO ADMIN)
//
// AVISO (auditoría 2026-08-15): esta función se desplegó sin ninguna
// comprobación de autenticación y con la puerta de JWT desactivada. Estaba
// abierta a internet: con un POST y {"action":"list_recent"} cualquiera
// obtenía los últimos pagos con el correo de los clientes, y la función usa
// la service_role. Ahora exige sesión válida Y rol de administrador.
//
// IMPORTANTE al desplegar: NO usar --no-verify-jwt. Debe quedar con la
// verificación de JWT de la plataforma activada, además de la comprobación
// de admin que se hace aquí abajo.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findPlan, planCreditsToGrant } from "../_shared/plans.ts";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

/** Devuelve el id del usuario solo si hay sesión válida Y es administrador. */
async function requireAdmin(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user) return null;

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: prof, error: profErr } = await svc
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .single();
  if (profErr || !prof?.is_admin) return null;

  return data.user.id;
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  // Sin esto, la función queda expuesta a internet con permisos de servidor.
  const adminId = await requireAdmin(req);
  if (!adminId) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reqBody = await req.json();
  const { payment_id, action, search_user } = reqBody;
  const results: Record<string, unknown> = { action };

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --- LIST: lista los últimos pagos de la cuenta MP (busca por email) ---
  if (action === "list_recent") {
    const url = search_user
      ? `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=20&payer.email=${encodeURIComponent(search_user)}`
      : `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=20`;
    const mpRes = await fetch(url, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    results.mp_status_code = mpRes.status;
    if (!mpRes.ok) {
      results.mp_error = await mpRes.text();
      return jsonResp(results);
    }
    const data = await mpRes.json();
    results.total = data.paging?.total || 0;
    results.payments = (data.results || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      status: p.status,
      amount: p.transaction_amount,
      payer_email: (p.payer as Record<string, unknown>)?.email,
      date_created: p.date_created,
      date_approved: p.date_approved,
      external_reference_raw: p.external_reference,
      notification_url: p.notification_url,
      payment_method: p.payment_method_id,
    }));
    return jsonResp(results);
  }

  if (!payment_id) {
    return jsonResp({ error: "Falta payment_id o action=list_recent" }, 400);
  }

  results.payment_id = payment_id;

  // --- DIAGNOSE / PROCESS ---
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  results.mp_status_code = mpRes.status;
  if (!mpRes.ok) {
    results.mp_error = await mpRes.text();
    return jsonResp(results);
  }

  const payment = await mpRes.json();
  results.payment_status = payment.status;
  results.amount = payment.transaction_amount;
  results.payer_email = payment.payer?.email;
  results.date_approved = payment.date_approved;
  results.external_reference_raw = payment.external_reference;
  results.notification_url = payment.notification_url;

  let ref: Record<string, unknown> | null = null;
  try {
    ref = JSON.parse(payment.external_reference);
    results.external_reference = ref;
  } catch {
    results.parse_error = "No se pudo parsear external_reference";
  }

  if (ref?.plan_id) {
    const plan = findPlan(ref.plan_id as string);
    results.plan_found = !!plan;
    if (plan) {
      results.plan_details = { id: plan.id, price: plan.price, active: plan.active, type: plan.type };
      results.credits_to_grant = plan.type === "recarga" ? planCreditsToGrant(plan) : 0;
    }
  }

  const { data: existing } = await sb
    .from("payments_mp")
    .select("id, created_at")
    .eq("payment_id", String(payment_id))
    .maybeSingle();
  results.already_processed = !!existing;

  if (action === "process" && payment.status === "approved" && !existing && ref) {
    const planInfo = ref.plan_id ? findPlan(ref.plan_id as string) : null;
    const credits = planInfo?.type === "recarga" ? planCreditsToGrant(planInfo) : 0;

    const { error: insertErr } = await sb.from("payments_mp").insert({
      payment_id: String(payment_id),
      user_id: ref.user_id,
      user_email: ref.user_email,
      plan_id: ref.plan_id,
      credits,
      amount: payment.transaction_amount,
      status: payment.status,
      type: planInfo?.type || "recarga",
      mp_payer_email: payment.payer?.email || "",
      mp_payment_method: payment.payment_method_id || "",
      mp_date_approved: payment.date_approved || "",
    });
    results.insert_error = insertErr?.message || null;

    if (!insertErr && credits > 0) {
      const { error: rpcErr } = await sb.rpc("increment_credits", {
        p_user_id: ref.user_id,
        p_amount: credits,
      });
      results.credit_error = rpcErr?.message || null;
      results.credits_granted = !rpcErr ? credits : 0;
    }

    results.processed = !insertErr;
  }

  return jsonResp(results);
});

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
