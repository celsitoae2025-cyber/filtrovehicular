import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TG_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TG_CHAT = Deno.env.get('TELEGRAM_CHAT_ID') || '';

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { nombre, email, whatsapp, tipo } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tipoLabel = tipo === 'google' ? 'Google' : 'Correo';

    await notifyTelegram(
      `🆕 <b>NUEVO REGISTRO</b>\n` +
      `👤 ${nombre || 'Sin nombre'}\n` +
      `📧 ${email}\n` +
      `📱 ${whatsapp || 'No proporcionó'}\n` +
      `🔑 Registro con: ${tipoLabel}\n` +
      `🪙 5 créditos de bienvenida\n` +
      `🕐 ${fechaLima()}`
    );

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
