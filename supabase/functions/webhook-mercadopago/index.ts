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
      return new Response("OK", { status: 200 });
    }

    const payment = await mpRes.json();
    if (payment.status !== "approved") return new Response("OK", { status: 200 });

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
      return new Response("OK", { status: 200 });
    }

    // Idempotencia atómica: INSERT con ON CONFLICT para evitar race condition.
    // Si payment_id ya existe (UNIQUE constraint), el INSERT no hace nada
    // y upsertedExisting será true.
    const { data: inserted, error: insertErr } = await sb
      .from("payments_mp")
      .upsert(
        {
          payment_id: String(paymentId),
          user_id: ref.user_id,
          user_email: ref.user_email,
          plan_id: ref.plan_id,
          credits: planInfo.credits,
          amount: payment.transaction_amount,
          status: payment.status,
          type: planInfo.type,
          mp_payer_email: payment.payer?.email || "",
          mp_payment_method: payment.payment_method_id || "",
          mp_date_approved: payment.date_approved || "",
        },
        { onConflict: "payment_id", ignoreDuplicates: true },
      )
      .select("id")
      .single();

    // Si no se insertó nada (duplicado), el pago ya fue procesado
    if (insertErr || !inserted) {
      return new Response("OK", { status: 200 });
    }

    // Si es recarga de créditos, sumar al saldo del usuario ATÓMICAMENTE
    if (planInfo.type === "recarga" && planInfo.credits > 0) {
      const { data: profile } = await sb
        .from("profiles")
        .select("full_name")
        .eq("id", ref.user_id)
        .maybeSingle();

      // Incremento atómico: usa RPC para evitar race condition read-then-write
      let { error: rpcErr } = await sb.rpc("increment_credits", {
        p_user_id: ref.user_id,
        p_amount: planInfo.credits,
      });
      if (rpcErr) {
        // Reintento único: los errores transitorios (red, pool) suelen pasar al segundo intento
        console.error("increment_credits RPC error (intento 1):", rpcErr);
        const retry = await sb.rpc("increment_credits", {
          p_user_id: ref.user_id,
          p_amount: planInfo.credits,
        });
        rpcErr = retry.error;
      }
      if (rpcErr) {
        console.error("increment_credits RPC error (reintento):", rpcErr);
        // Fallback: update directo NO atómico — bajo concurrencia puede perder
        // un incremento, por eso se alerta al admin para verificar el saldo.
        const { data: currentProfile } = await sb
          .from("profiles")
          .select("credits_balance")
          .eq("id", ref.user_id)
          .maybeSingle();
        await sb
          .from("profiles")
          .update({
            credits_balance: (currentProfile?.credits_balance || 0) + planInfo.credits,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ref.user_id);
        await notifyTelegram(
          `⚠️ <b>FALLBACK NO ATÓMICO USADO — verificar saldo</b>\n` +
            `El RPC increment_credits falló 2 veces; se acreditó con update directo.\n` +
            `👤 user_id: ${ref.user_id}\n` +
            `🪙 +${planInfo.credits} créditos\n` +
            `🆔 MP #${paymentId}\n` +
            `Revisa que el saldo del usuario sea correcto.`,
        );
      }

      // Registrar la transacción en el historial
      await sb.from("transactions").insert({
        user_id: ref.user_id,
        type: "purchase",
        amount: planInfo.credits,
        description: `Pago MP — ${ref.plan_id}`,
        plan_id: ref.plan_id,
        payment_method: "mercadopago",
        reference: String(paymentId),
      });

      // Notificación in-app para el cliente
      try {
        await sb.from("notifications").insert({
          user_id: ref.user_id,
          type: "credits",
          title: `¡Recibiste ${planInfo.credits} créditos!`,
          body:
            `Tu pago de S/ ${payment.transaction_amount} fue aprobado. ` +
            `Se acreditaron ${planInfo.credits} créditos a tu cuenta y ya puedes consultarlos.`,
          meta: {
            payment_id: String(paymentId),
            plan_id: ref.plan_id,
            amount: payment.transaction_amount,
            credits: planInfo.credits,
            method: "mercadopago",
          },
        });
      } catch (nerr) {
        console.error("notif credits insert error:", nerr);
      }

      await notifyTelegram(
        `✅ <b>PAGO APROBADO — Mercado Pago</b>\n` +
          `👤 ${profile?.full_name || ref.user_email}\n` +
          `💳 ${ref.plan_id}\n` +
          `💰 S/ ${payment.transaction_amount}\n` +
          `🪙 +${planInfo.credits} créditos\n` +
          `🆔 MP #${paymentId}\n` +
          `🕐 ${fechaLima()}`,
      );
    } else if (planInfo.type === "suscripcion") {
      const { data: profile } = await sb
        .from("profiles")
        .select("subscription_tier, subscription_expires_at, full_name")
        .eq("id", ref.user_id)
        .maybeSingle();

      const nowMs = Date.now();
      const dayMs = 86400 * 1000;
      let baseMs = nowMs;
      let started_at_iso = new Date(nowMs).toISOString();

      if (
        profile?.subscription_expires_at &&
        new Date(profile.subscription_expires_at).getTime() > nowMs &&
        profile.subscription_tier === ref.tier
      ) {
        baseMs = new Date(profile.subscription_expires_at).getTime();
        started_at_iso = "";
      }

      const expires_at = new Date(baseMs + ref.days * dayMs).toISOString();
      const updatePayload: Record<string, unknown> = {
        subscription_tier: ref.tier,
        subscription_plan_id: ref.plan_id,
        subscription_expires_at: expires_at,
        updated_at: new Date().toISOString(),
      };
      if (started_at_iso) updatePayload.subscription_started_at = started_at_iso;

      await sb.from("profiles").update(updatePayload).eq("id", ref.user_id);

      await sb.from("transactions").insert({
        user_id: ref.user_id,
        type: "subscription",
        amount: 0,
        description: `Suscripción ${ref.plan_id} (${ref.days} días) — vence ${expires_at.slice(0, 10)}`,
        plan_id: ref.plan_id,
        payment_method: "mercadopago",
        reference: String(paymentId),
      });

      try {
        await sb.from("notifications").insert({
          user_id: ref.user_id,
          type: "system",
          title: `¡Suscripción activada por ${ref.days} días!`,
          body:
            `Tu pago de S/ ${payment.transaction_amount} fue aprobado. ` +
            `Disfruta consultas según tu plan ${ref.tier} hasta el ${expires_at.slice(0, 10)}.`,
          meta: {
            payment_id: String(paymentId),
            plan_id: ref.plan_id,
            tier: ref.tier,
            days: ref.days,
            expires_at,
            method: "mercadopago",
          },
        });
      } catch (nerr) {
        console.error("notif sub insert error:", nerr);
      }

      await notifyTelegram(
        `✅ <b>SUSCRIPCIÓN APROBADA — Mercado Pago</b>\n` +
          `👤 ${profile?.full_name || ref.user_email}\n` +
          `📅 ${ref.days} días · ${ref.tier}\n` +
          `⏰ Vence: ${expires_at.slice(0, 10)}\n` +
          `💰 S/ ${payment.transaction_amount}\n` +
          `🆔 MP #${paymentId}\n` +
          `🕐 ${fechaLima()}`,
      );
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("webhook error:", err);
    // Siempre devolver 200 para que MP no reintente infinitamente
    return new Response("OK", { status: 200 });
  }
});
