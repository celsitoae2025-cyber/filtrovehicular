// Supabase Edge Function: notify-admin
// Envía notificaciones detalladas a Telegram

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

// Timestamp Lima
function fechaLima(): string {
  return new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

// Handler principal
serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    const { type, table, record } = payload;

    if (type === 'DELETE' || table !== 'solicitudes' || type !== 'INSERT') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const d = record?.datos || record || {};
    const placa = d.placa || record?.placa || 'Sin placa';
    const email = d.email || record?.email || 'Sin email';
    const nombre = d.nombre || '';
    const whatsapp = d.whatsapp || '';
    const servicio = d.servicio || '';
    const credits = d.credits || 0;

    let telegramMsg = '';

    // 1. REGISTRO DE NUEVO USUARIO
    if (d.isRegistro === true || String(placa).startsWith('REGISTRO_')) {
      telegramMsg = `👤 <b>NUEVO REGISTRO DE USUARIO</b>\n\n` +
        `📁 Tipo: <b>Registro de cuenta</b>\n` +
        `📋 Nombre: <b>${nombre || 'Sin nombre'}</b>\n` +
        `📧 Email: <b>${email}</b>\n` +
        (whatsapp ? `📱 WhatsApp: <b>${whatsapp}</b>\n` : '') +
        `\n🕐 ${fechaLima()}`;
    }

    // 2. ACTIVACIÓN DE PLATAFORMA
    else if (d.isActivacion === true || String(placa).startsWith('ACTIVACION_')) {
      telegramMsg = `🚀 <b>SOLICITUD DE ACTIVACION</b>\n\n` +
        `📁 Tipo: <b>Activación de Plataforma Digital</b>\n` +
        `📧 Email: <b>${email}</b>\n` +
        (whatsapp ? `📱 WhatsApp: <b>${whatsapp}</b>\n` : '') +
        (d.voucher ? `🧾 Comprobante: <b>Adjunto</b>\n` : '') +
        `\n🕐 ${fechaLima()}`;
    }

    // 3. RECARGA DE CRÉDITOS
    else if (d.isRecharge === true || String(placa).startsWith('RECARGA_')) {
      telegramMsg = `💰 <b>SOLICITUD DE RECARGA</b>\n\n` +
        `📁 Tipo: <b>Recarga de Créditos</b>\n` +
        `💳 Cantidad: <b>+${credits} créditos</b>\n` +
        `📧 Email: <b>${email}</b>\n` +
        (d.voucher ? `🧾 Comprobante: <b>Adjunto</b>\n` : '') +
        `\n🕐 ${fechaLima()}`;
    }

    // 4. SOLICITUD DE DASHBOARD
    else if (d.isDashboard === true || String(placa).startsWith('DASHBOARD_')) {
      telegramMsg = `🏢 <b>SOLICITUD DE DASHBOARD</b>\n\n` +
        `📁 Tipo: <b>Acceso al Dashboard</b>\n` +
        `📧 Email: <b>${email}</b>\n` +
        (whatsapp ? `📱 WhatsApp: <b>${whatsapp}</b>\n` : '') +
        (d.voucher ? `🧾 Comprobante: <b>Adjunto</b>\n` : '') +
        `\n🕐 ${fechaLima()}`;
    }

    // 5. COMPROBANTE DE PAGO
    else if (d.comprobante_url || record?.comprobante_url) {
      telegramMsg = `🧾 <b>COMPROBANTE DE PAGO</b>\n\n` +
        `📁 Tipo: <b>Pago con comprobante</b>\n` +
        `🚗 Placa: <b>${placa}</b>\n` +
        `📧 Email: <b>${email}</b>\n` +
        (servicio ? `📋 Servicio: <b>${servicio}</b>\n` : '') +
        `\n🕐 ${fechaLima()}`;
    }

    // 6. CONSULTA INDIVIDUAL (servicio específico)
    else if (d.isIndividual === true) {
      telegramMsg = `📄 <b>CONSULTA INDIVIDUAL</b>\n\n` +
        `📁 Servicio: <b>${servicio || 'Consulta Individual'}</b>\n` +
        `🚗 Placa: <b>${placa}</b>\n` +
        `📧 Email: <b>${email}</b>\n` +
        (d.pagoCon ? `💳 Pago: <b>${d.pagoCon}</b>\n` : '') +
        `\n🕐 ${fechaLima()}`;
    }

    // 7. FILTRO VEHICULAR COMPLETO / SOLICITUD GENERAL
    else {
      telegramMsg = `📋 <b>NUEVA SOLICITUD</b>\n\n` +
        `📁 Servicio: <b>${servicio || 'Filtro Vehicular Completo'}</b>\n` +
        `🚗 Placa: <b>${placa}</b>\n` +
        `📧 Email: <b>${email}</b>\n` +
        (d.pagoCon ? `💳 Pago: <b>${d.pagoCon}</b>\n` : '') +
        `\n🕐 ${fechaLima()}`;
    }

    // Enviar
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
