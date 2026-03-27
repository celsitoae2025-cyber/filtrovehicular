// Supabase Edge Function: notify-admin
// Envía notificaciones a Telegram

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Variables de entorno
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '8582237665:AAEKxiJcwCcdF3-FhDC7ngwkLflGq-_kwx8';
const TELEGRAM_CHAT_ID   = Deno.env.get('TELEGRAM_CHAT_ID')   || '7556866897';

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

    // Los datos reales están en record.datos (JSON) para la tabla solicitudes
    const d = record?.datos || record || {};

    // =============================================
    // EVENTO: Nuevo usuario registrado
    // =============================================
    if (table === 'solicitudes' && (d.isRegistro === true || String(record?.placa || '').startsWith('REGISTRO_')) && type === 'INSERT') {
      const nombre = d.nombre || 'Sin nombre';
      const email = d.email || record?.email || 'Sin email';
      const whatsapp = d.whatsapp || 'Sin número';

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

      telegramMsg = `📋 <b>NUEVA SOLICITUD</b>\n\n` +
        `🚗 Placa: <b>${placa}</b>\n` +
        `📧 Email: <b>${email}</b>\n\n` +
        `🕐 ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`;
    }

    // Enviar por Telegram
    if (telegramMsg) {
      await sendTelegram(telegramMsg);
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
