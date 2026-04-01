import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TG_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TG_CHAT  = Deno.env.get('TELEGRAM_CHAT_ID')   || '';
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')  || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

async function sendTelegram(message: string): Promise<void> {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text: message, parse_mode: 'HTML' })
    });
  } catch (e) { console.error('Telegram error:', e); }
}

async function sendPushToAll(title: string, body: string): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    const { data: subs } = await sb.from('push_subscriptions').select('endpoint, keys');
    if (!subs || subs.length === 0) return;

    const payload = JSON.stringify({ title, body });

    for (const sub of subs) {
      if (!sub.endpoint || !sub.keys) continue;
      try {
        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TTL': '86400',
          },
          body: payload
        });
        if (res.status === 410 || res.status === 404) {
          await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      } catch (e) { console.warn('Push send error:', e); }
    }
  } catch (e) { console.error('Push broadcast error:', e); }
}

function fechaLima(): string {
  return new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const payload = await req.json();
    const { type, table, record } = payload;

    if (type === 'DELETE' || (table && table !== 'solicitudes') || (type && type !== 'INSERT')) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const d = record?.datos || record || {};
    if (d.status === 'approved') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const placa = d.placa || record?.placa || 'Sin placa';
    const email = d.email || '';
    const nombre = d.nombre || '';
    const whatsapp = d.whatsapp || '';
    const servicio = d.servicio || '';
    const credits = d.credits || 0;

    let telegramMsg = '';
    let pushTitle = 'Nueva Solicitud';
    let pushBody = '';

    if (d.isRegistro) {
      pushTitle = 'Nuevo Registro';
      pushBody = `${nombre || email} se registró`;
      telegramMsg = `👤 <b>NUEVO REGISTRO</b>\n📋 ${nombre}\n📧 ${email}\n${whatsapp ? '📱 ' + whatsapp + '\n' : ''}\n🕐 ${fechaLima()}`;
    } else if (d.isActivacion) {
      pushTitle = 'Solicitud Activación';
      pushBody = `${email} solicita activar plataforma`;
      telegramMsg = `🚀 <b>ACTIVACIÓN</b>\n📧 ${email}\n${whatsapp ? '📱 ' + whatsapp + '\n' : ''}\n🕐 ${fechaLima()}`;
    } else if (d.isRecharge) {
      pushTitle = 'Solicitud Recarga';
      pushBody = `${email} +${credits} créditos`;
      telegramMsg = `💰 <b>RECARGA</b>\n💳 +${credits}\n📧 ${email}\n🕐 ${fechaLima()}`;
    } else if (d.isDashboard) {
      pushTitle = 'Solicitud Dashboard';
      pushBody = `${email} solicita dashboard`;
      telegramMsg = `🏢 <b>DASHBOARD</b>\n📧 ${email}\n🕐 ${fechaLima()}`;
    } else if (d.isIndividual) {
      pushTitle = servicio || 'Consulta Individual';
      pushBody = `Placa: ${placa} - ${email}`;
      telegramMsg = `📄 <b>CONSULTA</b>\n📁 ${servicio}\n🚗 ${placa}\n📧 ${email}\n🕐 ${fechaLima()}`;
    } else {
      pushTitle = 'Nueva Solicitud';
      pushBody = `Placa: ${placa} - ${email}`;
      telegramMsg = `📋 <b>SOLICITUD</b>\n📁 ${servicio || 'Filtro Vehicular'}\n🚗 ${placa}\n📧 ${email}\n🕐 ${fechaLima()}`;
    }

    await Promise.allSettled([
      telegramMsg ? sendTelegram(telegramMsg) : Promise.resolve(),
      sendPushToAll(pushTitle, pushBody)
    ]);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Edge Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
