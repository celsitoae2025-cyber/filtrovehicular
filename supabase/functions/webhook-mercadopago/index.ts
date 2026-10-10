// ============================================================
// webhook-mercadopago — Edge Function
// Recibe notificaciones de Mercado Pago y activa los créditos
// en la cuenta del usuario automáticamente.
//
// MP llama acá con POST cuando el pago cambia de estado.
// Si el pago está aprobado, valida el monto y acredita.
//
// Variables de entorno requeridas:
//   MP_ACCESS_TOKEN              — token de producción de tu cuenta MP
//   MP_WEBHOOK_SECRET            — clave secreta del webhook (panel MP → Webhooks)
//   SUPABASE_URL                 — auto-inyectado
//   SUPABASE_SERVICE_ROLE_KEY    — auto-inyectado (tiene acceso total, bypass RLS)
//   TELEGRAM_BOT_TOKEN           — opcional, para notificarte al recibir un pago
//   TELEGRAM_CHAT_ID             — opcional, tu chat ID
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findPlan, planCreditsToGrant } from "../_shared/plans.ts";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || "";
const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET") || "";
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID") || "";

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function fechaLima(): string {
  return new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });
}

async function notifyTelegram(msg: string): Promise<void> {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.error("Telegram error:", e);
  }
}

// --- Verificación de firma HMAC de Mercado Pago ---
async function verifySignature(req: Request, dataId: string): Promise<boolean> {
  if (!MP_WEBHOOK_SECRET) {
    console.warn("MP_WEBHOOK_SECRET no configurado — firma no verificada");
    return true;
  }

  const xSignature = req.headers.get("x-signature") || "";
  const xRequestId = req.headers.get("x-request-id") || "";
  if (!xSignature) return false;

  const parts: Record<string, string> = {};
  for (const part of xSignature.split(",")) {
    const [k, ...v] = part.split("=");
    if (k && v.length) parts[k.trim()] = v.join("=").trim();
  }
  const ts = parts["ts"] || "";
  const v1 = parts["v1"] || "";
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(MP_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === v1;
}

serve(async (req: Request) => {
  // MP valida la URL con GET; responder 200.
  if (req.method === "GET") return new Response("OK", { status: 200 });
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  try {
    const body = await req.json();

    // Solo procesar notificaciones de tipo 'payment'
    if (body.type !== "payment") return new Response("OK", { status: 200 });

    const paymentId = body.data?.id;
    if (!paymentId) return new Response("OK", { status: 200 });

    // Verificar firma HMAC del webhook (defensa en profundidad).
    // Si falla, NO rechazamos: la verificación contra la API de MP con el
    // MP_ACCESS_TOKEN ya garantiza que el pago es real. Esto evita perder
    // pagos cuando el MP_WEBHOOK_SECRET está mal configurado o desincronizado.
    /* Se sigue adelante aunque la firma falle —la API de MP es la fuente
       de verdad y no se pueden perder cobros por un secreto
       desincronizado—, pero queda anotado para avisar MÁS ABAJO.

       El aviso NO se manda aquí: esta URL es pública y a estas alturas
       todavía no se sabe si el pago existe. Cualquiera con un POST vacío
       haría sonar el teléfono del dueño —de hecho pasó con un «MP #1» de
       prueba—. Se avisa solo cuando el pago resulta ser real y
       aprobado. */
    const signatureValid = await verifySignature(req, String(paymentId));
    if (!signatureValid) {
      console.warn(
        `Firma HMAC inválida para pago ${paymentId} — procediendo con verificación API de MP`,
      );
    }

    // Verificar el pago directamente con la API de MP (fuente de verdad).
    // Si alguien intenta llamar al webhook con un payment_id falso, MP API
    // devolverá error o status != approved, y el flujo se corta acá.
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!mpRes.ok) {
      console.error("MP verify failed:", mpRes.status);
      // An unknown ID is not a recoverable payment; transient/API errors are.
      if (mpRes.status === 400 || mpRes.status === 404) {
        return new Response("OK", { status: 200 });
      }
      return new Response("ERROR", { status: 500 });
    }

    const payment = await mpRes.json();
    if (payment.status !== "approved") return new Response("OK", { status: 200 });

    // Pago real y aprobado: ahora sí tiene sentido avisar de la firma.
    if (!signatureValid) {
      await notifyTelegram(
        `⚠️ <b>Firma de Mercado Pago inválida</b>\n` +
          `El pago se acredita igual (verificado contra la API), pero revisa que ` +
          `MP_WEBHOOK_SECRET coincida con el del panel de Mercado Pago.\n` +
          `🧾 Operación MP: ${paymentId}`,
      );
    }

    // Parsear la referencia externa que mandamos al crear la preferencia
    type Ref = {
      plan_id: string;
      user_id: string;
      user_email: string;
      credits: number;
      days: number;
      tier: string | null;
      type: string;
      price: number;
    };
    let ref: Ref;
    try {
      ref = JSON.parse(payment.external_reference);
    } catch {
      console.error("Invalid external_reference:", payment.external_reference);
      return new Response("OK", { status: 200 });
    }

    // Validar que el plan existe y que el monto pagado coincide
    const plan = findPlan(ref.plan_id);
    if (!plan) {
      console.error(`Plan desconocido: ${ref.plan_id}`);
      return new Response("OK", { status: 200 });
    }
    if (payment.transaction_amount < plan.price) {
      console.error(
        `Monto bajo para ${ref.plan_id}: esperado ${plan.price}, recibido ${payment.transaction_amount}`,
      );
      return new Response("OK", { status: 200 });
    }
    const planInfo = {
      price: plan.price,
      credits: plan.type === "recarga" ? planCreditsToGrant(plan) : 0,
      type: plan.type,
    };

    const sb = getSupabase();
    if (!sb) {
      console.error("Supabase no configurado");
      return new Response("ERROR", { status: 500 });
    }

    // One database transaction inserts the payment, grants the entitlement,
    // and writes the ledger row. A failure rolls all three back so MP can retry.
    const { data: applied, error: applyError } = await sb.rpc(
      "apply_mp_approved_payment",
      {
        p_payment_id: String(paymentId),
        p_user_id: ref.user_id,
        p_user_email: ref.user_email,
        p_plan_id: ref.plan_id,
        p_credits: planInfo.credits,
        p_amount: payment.transaction_amount,
        p_type: planInfo.type,
        p_tier: plan.tier,
        p_days: plan.type === "suscripcion" ? plan.days : 0,
        p_payer_email: payment.payer?.email || "",
        p_method: payment.payment_method_id || "",
        p_date_approved: payment.date_approved || "",
      },
    );

    if (applyError) {
      console.error("apply_mp_approved_payment error:", applyError);
      await notifyTelegram(
        `<b>PAGO SIN ACREDITAR - revisar</b>\n` +
          `Usuario: ${ref.user_email}\nPlan: ${ref.plan_id}\n` +
          `MP #${paymentId}\nError: ${applyError.message || applyError.code || "desconocido"}`,
      );
      return new Response("ERROR", { status: 500 });
    }

    if (applied !== true) {
      // Historical rows may have been inserted by the older non-atomic flow.
      // Never credit them automatically: the balance may already have changed.
      const { data: ledger, error: ledgerError } = await sb.from("transactions")
        .select("id")
        .eq("user_id", ref.user_id)
        .eq("payment_method", "mercadopago")
        .eq("reference", String(paymentId))
        .limit(1);
      if (ledgerError || !ledger?.length) {
        await notifyTelegram(
          `<b>PAGO EN REVISION - movimiento no encontrado</b>\n` +
            `Usuario: ${ref.user_email}\nMP #${paymentId}\n` +
            `Verifica el saldo antes de hacer una recarga manual.`,
        );
      }
      return new Response("OK", { status: 200 });
    }

    const { data: profile } = await sb.from("profiles")
      .select("full_name, phone, subscription_expires_at")
      .eq("id", ref.user_id)
      .maybeSingle();

    const isCredit = planInfo.type === "recarga";
    const expires = profile?.subscription_expires_at || "";
    const { error: notificationError } = await sb.from("notifications").insert({
      user_id: ref.user_id,
      type: isCredit ? "credits" : "system",
      title: isCredit
        ? `Recibiste ${planInfo.credits} creditos`
        : `Suscripcion activada por ${plan.type === "suscripcion" ? plan.days : 0} dias`,
      body: isCredit
        ? `Tu pago de S/ ${payment.transaction_amount} fue aprobado y se acreditaron ${planInfo.credits} creditos.`
        : `Tu pago de S/ ${payment.transaction_amount} fue aprobado. Tu plan vence el ${String(expires).slice(0, 10)}.`,
      meta: {
        payment_id: String(paymentId),
        plan_id: ref.plan_id,
        amount: payment.transaction_amount,
        credits: planInfo.credits,
        expires_at: expires,
        method: "mercadopago",
      },
    });
    if (notificationError) console.error("MP notification error:", notificationError);

    await notifyTelegram(
      `<b>${isCredit ? "RECARGA" : "SUSCRIPCION"} APROBADA - Mercado Pago</b>\n` +
        `Nombre: ${profile?.full_name || "Sin nombre"}\n` +
        `Correo: ${ref.user_email || "sin correo"}\n` +
        `Celular: ${profile?.phone || "sin celular"}\n` +
        `Plan: ${ref.plan_id}\nMonto: S/ ${payment.transaction_amount}\n` +
        (isCredit ? `Creditos: +${planInfo.credits}\n` : `Vence: ${String(expires).slice(0, 10)}\n`) +
        `MP #${paymentId}\n${fechaLima()}`,
    );

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("webhook error:", err);
    // An infrastructure failure must be retried by Mercado Pago.
    return new Response("ERROR", { status: 500 });
  }
});
