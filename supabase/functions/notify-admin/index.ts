// Supabase Edge Function: notify-admin
// Envía: 1) Web Push nativo (VAPID) al celular, 2) Mensaje a Telegram

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendNotification, setVapidDetails } from 'npm:web-push@3.6.7';

// Variables de entorno
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '8582237665:AAEKxiJcwCcdF3-FhDC7ngwkLflGq-_kwx8';
const TELEGRAM_CHAT_ID   = Deno.env.get('TELEGRAM_CHAT_ID')   || '7556866897';
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Claves VAPID para Web Push nativo
const VAPID_PUBLIC_KEY  = 'BNHCC4Ay_g3Xdd4R8Uy0JQtSEU0GjbKAGhImObZQjorigY720bSVYqgAtgjTbE9BrspYbUOTJocXfQremW9ujF8';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'gY720bSVYqgAtgjTbE9BrspYbUOTJocXfQremW9ujF8';
const VAPID_SUBJECT     = 'mailto:admin@filtrovehicularperu.com';

// ── Web Push usando librería web-push de npm ────────────────────────────────

setVapidDetails(
  'mailto:admin@filtrovehicularperu.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Obtener suscripciones Web Push desde Supabase
async function getWebPushSubs(): Promise<any[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_push_tokens?select=subscription`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
    );
    const rows = await res.json();
    if (!Array.isArray(rows)) { console.log('Respuesta subs:', JSON.stringify(rows)); return []; }
    return rows.filter((r: any) => r.subscription?.endpoint);
  } catch (e) {
    console.error('Error obteniendo suscripciones:', e);
    return [];
  }
}

async function sendPushNotification(title: string, body: string): Promise<void> {
  const subs = await getWebPushSubs();
  if (subs.length === 0) {
    console.log('No hay suscripciones Web Push registradas');
    return;
  }
  console.log(`Enviando Web Push a ${subs.length} dispositivo(s)...`);
  const payload = JSON.stringify({
    title, body,
    icon: 'https://filtrovehicularperu.com/assets/media/logopwa.png',
    badge: 'https://filtrovehicularperu.com/logopestañaweb.png',
    vibrate: [400, 150, 400, 150, 400, 150, 400, 150, 400, 150, 400],
    requireInteraction: true,
    renotify: true,
    tag: 'admin-push',
    data: { url: 'https://filtrovehicularperu.com/admin.html#requests' }
  });
  for (const s of subs) {
    try {
      await sendNotification(s.subscription, payload);
      console.log(`✅ Push enviado → ${s.subscription.endpoint.slice(-20)}`);
    } catch (e: any) {
      console.error(`❌ Error push: ${e.message}`);
    }
  }
}

// Telegram
async function sendTelegram(message: string): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' })
    });
    const r = await res.json();
    console.log('Telegram:', r.ok ? '✅' : '❌');
  } catch (e) {
    console.error('Error Telegram:', e);
  }
}

// Handler principal
serve(async (req: Request) => {
  // Verificar método
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log('Payload recibido:', JSON.stringify(payload).slice(0, 200));

    const { type, table, record, old_record } = payload;

    // Ignorar DELETE
    if (type === 'DELETE') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let telegramMsg = '';
    let pushTitle = '';
    let pushBody = '';

    // Los datos reales están en record.datos (JSON) para la tabla solicitudes
    const d = record?.datos || record || {};

    // =============================================
    // EVENTO: Nuevo usuario registrado
    // =============================================
    if (table === 'solicitudes' && (d.isRegistro === true || String(record?.placa || '').startsWith('REGISTRO_')) && type === 'INSERT') {
      const nombre = d.nombre || 'Sin nombre';
      const email = d.email || record?.email || 'Sin email';
      const whatsapp = d.whatsapp || 'Sin número';

      pushTitle = '👤 Nuevo Usuario Registrado';
      pushBody = `${nombre} - ${email}`;
      telegramMsg = `👤 <b>NUEVO REGISTRO</b>\n\n` +
        `📋 Nombre: <b>${nombre}</b>\n` +
        `📧 Email: <b>${email}</b>\n` +
        `📱 WhatsApp: <b>${whatsapp}</b>\n\n` +
        `🕐 ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`;
    }

    // =============================================
    // EVENTO: Nuevo comprobante de pago subido
    // =============================================
    else if (table === 'solicitudes' && (d.comprobante_url || record?.comprobante_url) && type === 'INSERT') {
      const placa = d.placa || record?.placa || 'Sin placa';
      const email = d.email || record?.email || 'Sin email';
      const tipo = d.tipo || record?.tipo || 'filtro';

      pushTitle = '💰 Nuevo Comprobante de Pago';
      pushBody = `Placa: ${placa}`;
      telegramMsg = `💰 <b>COMPROBANTE DE PAGO</b>\n\n` +
        `🚗 Placa: <b>${placa}</b>\n` +
        `📧 Email: <b>${email}</b>\n` +
        `📁 Tipo: <b>${tipo}</b>\n\n` +
        `🕐 ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`;
    }

    // =============================================
    // EVENTO: Nueva solicitud de Dashboard
    // =============================================
    else if (table === 'solicitudes' && d.isDashboard === true && type === 'INSERT') {
      const email = d.email || record?.email || 'Sin email';

      pushTitle = '🏢 Solicitud de Dashboard';
      pushBody = `Cliente: ${email}`;
      telegramMsg = `🏢 <b>SOLICITUD DE DASHBOARD</b>\n\n` +
        `📧 Email: <b>${email}</b>\n\n` +
        `🕐 ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`;
    }

    // =============================================
    // EVENTO: Nueva solicitud genérica
    // =============================================
    else if (table === 'solicitudes' && type === 'INSERT') {
      const placa = d.placa || record?.placa || 'Sin placa';
      const email = d.email || record?.email || 'Sin email';

      pushTitle = '📋 Nueva Solicitud';
      pushBody = `Placa: ${placa}`;
      telegramMsg = `📋 <b>NUEVA SOLICITUD</b>\n\n` +
        `🚗 Placa: <b>${placa}</b>\n` +
        `📧 Email: <b>${email}</b>\n\n` +
        `🕐 ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`;
    }

    // Si hay mensaje que enviar
    if (telegramMsg || pushTitle) {
      // Enviar en paralelo: Telegram + Push
      await Promise.all([
        telegramMsg ? sendTelegram(telegramMsg) : Promise.resolve(),
        pushTitle ? sendPushNotification(pushTitle, pushBody) : Promise.resolve()
      ]);
    }

    return new Response(JSON.stringify({ ok: true, table, type }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error en Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
