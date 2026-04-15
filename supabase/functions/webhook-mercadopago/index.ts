import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') || '';
const TG_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TG_CHAT  = Deno.env.get('TELEGRAM_CHAT_ID')   || '';

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

function fechaLima(): string {
  return new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

async function notifyTelegram(msg: string): Promise<void> {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: 'HTML' }),
    });
  } catch (e) { console.error('TG error:', e); }
}

serve(async (req: Request) => {
  // MercadoPago verifica con GET, notifica con POST
  if (req.method === 'GET') return new Response('OK', { status: 200 });
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  try {
    const body = await req.json();

    // Solo procesar notificaciones de pago
    if (body.type !== 'payment') {
      return new Response('OK', { status: 200 });
    }

    const paymentId = body.data?.id;
    if (!paymentId) return new Response('OK', { status: 200 });

    // Verificar pago con la API de MercadoPago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!mpRes.ok) {
      console.error('MP verify failed:', mpRes.status);
      return new Response('OK', { status: 200 });
    }

    const payment = await mpRes.json();

    // Solo procesar pagos aprobados
    if (payment.status !== 'approved') {
      return new Response('OK', { status: 200 });
    }

    // Parsear referencia externa
    let ref: { email: string; credits: number; type: string; plan: string; placa?: string };
    try {
      ref = JSON.parse(payment.external_reference);
    } catch {
      console.error('Invalid external_reference:', payment.external_reference);
      return new Response('OK', { status: 200 });
    }

    if (!ref.email) return new Response('OK', { status: 200 });

    // Validar monto contra precio esperado del plan
    const PLAN_PRICES: Record<string, number> = {
      filtro: 45, acceso: 35, avanzado: 42, business: 84, profesional: 140, prueba: 5,
    };
    const expectedPrice = PLAN_PRICES[ref.plan];
    if (!expectedPrice || payment.transaction_amount < expectedPrice) {
      console.error(`Monto invalido: esperado ${expectedPrice}, recibido ${payment.transaction_amount}, plan ${ref.plan}`);
      return new Response('OK', { status: 200 });
    }

    const sb = getSupabase();
    if (!sb) {
      console.error('Supabase not configured');
      return new Response('OK', { status: 200 });
    }

    // Idempotencia: verificar si ya se proceso este pago
    const { data: existing } = await sb
      .from('pagos_mp')
      .select('id')
      .eq('payment_id', String(paymentId))
      .maybeSingle();

    if (existing) return new Response('OK', { status: 200 });

    // Registrar el pago
    await sb.from('pagos_mp').insert({
      payment_id: String(paymentId),
      email: ref.email,
      plan: ref.plan,
      credits: ref.credits,
      amount: payment.transaction_amount,
      status: payment.status,
      type: ref.type,
      mp_payer_email: payment.payer?.email || '',
      mp_payment_method: payment.payment_method_id || '',
      mp_date_approved: payment.date_approved || '',
    });

    // Obtener saldo actual del usuario
    const { data: saldo } = await sb
      .from('saldos')
      .select('creditos, plataforma_activa, dashboard_activo')
      .eq('email', ref.email)
      .maybeSingle();

    if (ref.type === 'recarga' && ref.credits > 0) {
      // Acreditar creditos + ACTIVAR PLATAFORMA (acceso ilimitado a Vehiculos
      // de por vida con cualquier plan; los creditos son solo para Consultas+).
      const currentCredits = saldo?.creditos || 0;
      if (saldo) {
        await sb.from('saldos')
          .update({
            creditos: currentCredits + ref.credits,
            plataforma_activa: true,
            dashboard_activo: true,
            updated_at: new Date().toISOString(),
          })
          .eq('email', ref.email);
      } else {
        await sb.from('saldos').insert({
          email: ref.email,
          creditos: ref.credits,
          plataforma_activa: true,
          dashboard_activo: true,
        });
      }

      await notifyTelegram(
        `✅ <b>PAGO APROBADO - MercadoPago</b>\n` +
        `💳 ${ref.plan.toUpperCase()}\n` +
        `💰 S/ ${payment.transaction_amount}\n` +
        `🪙 +${ref.credits} creditos\n` +
        `📧 ${ref.email}\n` +
        `🆔 MP #${paymentId}\n` +
        `🕐 ${fechaLima()}`
      );

    } else if (ref.type === 'activacion') {
      // Activar plataforma
      if (saldo) {
        await sb.from('saldos')
          .update({
            plataforma_activa: true,
            dashboard_activo: true,
            updated_at: new Date().toISOString(),
          })
          .eq('email', ref.email);
      } else {
        await sb.from('saldos').insert({
          email: ref.email,
          creditos: 0,
          plataforma_activa: true,
          dashboard_activo: true,
        });
      }

      await notifyTelegram(
        `✅ <b>ACTIVACION APROBADA - MercadoPago</b>\n` +
        `🚀 Acceso Plataforma Premium\n` +
        `💰 S/ ${payment.transaction_amount}\n` +
        `📧 ${ref.email}\n` +
        `🆔 MP #${paymentId}\n` +
        `🕐 ${fechaLima()}`
      );

    } else if (ref.type === 'filtro') {
      // Crear solicitud de filtro vehicular
      const placa = ref.placa || 'SIN_PLACA';
      await sb.from('solicitudes').upsert({
        placa: placa,
        datos: {
          placa: placa,
          email: ref.email,
          status: 'pending',
          timestamp: Date.now(),
          pagoCon: 'mercadopago',
          mpPaymentId: String(paymentId),
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'placa' });

      await notifyTelegram(
        `✅ <b>FILTRO VEHICULAR PAGADO - MercadoPago</b>\n` +
        `🚗 Placa: ${placa}\n` +
        `💰 S/ ${payment.transaction_amount}\n` +
        `📧 ${ref.email}\n` +
        `🆔 MP #${paymentId}\n` +
        `🕐 ${fechaLima()}`
      );

    } else if (ref.type === 'prueba') {
      await notifyTelegram(
        `🧪 <b>PAGO DE PRUEBA - MercadoPago</b>\n` +
        `💰 S/ ${payment.transaction_amount}\n` +
        `📧 ${ref.email}\n` +
        `🆔 MP #${paymentId}\n` +
        `🕐 ${fechaLima()}`
      );
    }

    return new Response('OK', { status: 200 });
  } catch (err: any) {
    console.error('Webhook error:', err);
    // Siempre devolver 200 para que MP no reintente
    return new Response('OK', { status: 200 });
  }
});
