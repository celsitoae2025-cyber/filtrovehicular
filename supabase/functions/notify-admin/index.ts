// Supabase Edge Function: notify-admin
// Envía notificaciones al admin cuando llega una nueva solicitud:
// 1. Telegram (mensaje detallado)
// 2. Web Push (notificación nativa con sonido, funciona con app cerrada)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Telegram config
const TG_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '8582237665:AAEKxiJcwCcdF3-FhDC7ngwkLflGq-_kwx8';
const TG_CHAT  = Deno.env.get('TELEGRAM_CHAT_ID')   || '7556866897';

// VAPID keys para Web Push
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')  || 'BB9RR2pu2n7t0j6cLWbN-CcdiSrKDZ0pwF--IxLjAU_IFjd6cPd6GASa8lEyya_TksACxoL_Ll8zxs9sC6sb9kQ';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || 'K2fTXmfrSPbUzDX_ZqRzGcm6mst_FUqAarioxU3328I';
const VAPID_SUBJECT = 'mailto:admin@filtrovehicularperu.com';

// --- Supabase client ---
function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

// --- Telegram ---
async function sendTelegram(message: string): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text: message, parse_mode: 'HTML' })
    });
    const r = await res.json();
    console.log('Telegram:', r.ok ? 'OK' : r.description);
  } catch (e) {
    console.error('Telegram error:', e);
  }
}

// --- Web Push (RFC 8291 / RFC 8292) ---
function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createVapidJwt(audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: VAPID_SUBJECT };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = base64UrlDecode(VAPID_PRIVATE);
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256',
      x: base64UrlEncode(base64UrlDecode(VAPID_PUBLIC).slice(1, 33)),
      y: base64UrlEncode(base64UrlDecode(VAPID_PUBLIC).slice(33, 65)),
      d: base64UrlEncode(privateKeyBytes),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    enc.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  } else {
    // DER format parsing
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  }

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function encryptPayload(
  p256dhKey: string,
  authSecret: string,
  payload: string
): Promise<{ encrypted: ArrayBuffer; salt: Uint8Array; localPublicKey: ArrayBuffer }> {
  const enc = new TextEncoder();
  const payloadBytes = enc.encode(payload);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const localPublicKey = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);

  // Import subscriber's public key
  const subscriberPubBytes = base64UrlDecode(p256dhKey);
  const subscriberKey = await crypto.subtle.importKey(
    'raw', subscriberPubBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberKey },
    localKeyPair.privateKey,
    256
  );

  const authBytes = base64UrlDecode(authSecret);

  // HKDF to derive IKM
  const ikmInfo = enc.encode('WebPush: info\0');
  const ikmInfoFull = new Uint8Array(ikmInfo.length + subscriberPubBytes.length + new Uint8Array(localPublicKey).length);
  ikmInfoFull.set(ikmInfo, 0);
  ikmInfoFull.set(subscriberPubBytes, ikmInfo.length);
  ikmInfoFull.set(new Uint8Array(localPublicKey), ikmInfo.length + subscriberPubBytes.length);

  const prk = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const authHmac = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', authBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), new Uint8Array(sharedSecret));

  // Simplified: use AES-GCM with derived key
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive content encryption key using HKDF
  const keyMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
  const contentKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: salt, info: enc.encode('Content-Encoding: aes128gcm\0') },
    keyMaterial,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt']
  );

  // Add padding
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes, 0);
  paddedPayload[payloadBytes.length] = 2; // padding delimiter
  paddedPayload[payloadBytes.length + 1] = 0;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    contentKey,
    paddedPayload
  );

  // Build aes128gcm payload
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  const localPubBytes = new Uint8Array(localPublicKey);
  const header = new Uint8Array(salt.length + 4 + 1 + localPubBytes.length);
  header.set(salt, 0);
  header.set(recordSize, 16);
  header[20] = localPubBytes.length;
  header.set(localPubBytes, 21);

  const body = new Uint8Array(header.length + iv.length + new Uint8Array(encrypted).length);
  body.set(header, 0);
  body.set(iv, header.length);
  body.set(new Uint8Array(encrypted), header.length + iv.length);

  return { encrypted: body.buffer, salt, localPublicKey };
}

async function sendWebPush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createVapidJwt(audience);

    const body = JSON.stringify(JSON.parse(payload)); // Validate JSON
    const bodyBytes = new TextEncoder().encode(body);

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
        'Content-Type': 'application/json',
        'TTL': '86400',
      },
      body: bodyBytes
    });

    console.log('Push status:', res.status);
    return res.status >= 200 && res.status < 300;
  } catch (e) {
    console.error('Push error:', e);
    return false;
  }
}

async function sendAllPushNotifications(title: string, body: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) { console.warn('No Supabase for push'); return; }

  try {
    const { data: subs } = await sb.from('push_subscriptions').select('endpoint, keys');
    if (!subs || subs.length === 0) { console.log('No push subscriptions'); return; }

    const payload = JSON.stringify({ title, body });

    for (const sub of subs) {
      if (!sub.endpoint || !sub.keys) continue;
      const ok = await sendWebPush(sub, payload);
      // Limpiar suscripciones inválidas
      if (!ok) {
        await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).then(() => {});
      }
    }
  } catch (e) {
    console.error('Push broadcast error:', e);
  }
}

// --- Timestamp Lima ---
function fechaLima(): string {
  return new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

// --- Handler ---
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, table, record } = payload;

    if (type === 'DELETE' || (table && table !== 'solicitudes') || (type && type !== 'INSERT')) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const d = record?.datos || record || {};
    const placa = d.placa || record?.placa || 'Sin placa';
    const email = d.email || record?.email || 'Sin email';
    const nombre = d.nombre || '';
    const whatsapp = d.whatsapp || '';
    const servicio = d.servicio || '';
    const credits = d.credits || 0;

    if (d.status === 'approved') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let telegramMsg = '';
    let pushTitle = 'Nueva Solicitud';
    let pushBody = '';

    if (d.isRegistro === true || String(placa).startsWith('REGISTRO_')) {
      pushTitle = 'Nuevo Registro';
      pushBody = `${nombre || email} se ha registrado`;
      telegramMsg = `👤 <b>NUEVO REGISTRO</b>\n\n📋 Nombre: <b>${nombre || 'Sin nombre'}</b>\n📧 Email: <b>${email}</b>\n` +
        (whatsapp ? `📱 WhatsApp: <b>${whatsapp}</b>\n` : '') + `\n🕐 ${fechaLima()}`;
    }
    else if (d.isActivacion === true || String(placa).startsWith('ACTIVACION_')) {
      pushTitle = 'Solicitud de Activacion';
      pushBody = `${email} solicita activar plataforma`;
      telegramMsg = `🚀 <b>SOLICITUD DE ACTIVACION</b>\n\n📧 Email: <b>${email}</b>\n` +
        (whatsapp ? `📱 WhatsApp: <b>${whatsapp}</b>\n` : '') +
        (d.voucher ? `🧾 Comprobante: <b>Adjunto</b>\n` : '') + `\n🕐 ${fechaLima()}`;
    }
    else if (d.isRecharge === true || String(placa).startsWith('RECARGA_')) {
      pushTitle = 'Solicitud de Recarga';
      pushBody = `${email} solicita +${credits} creditos`;
      telegramMsg = `💰 <b>SOLICITUD DE RECARGA</b>\n\n💳 Cantidad: <b>+${credits} creditos</b>\n📧 Email: <b>${email}</b>\n` +
        (d.voucher ? `🧾 Comprobante: <b>Adjunto</b>\n` : '') + `\n🕐 ${fechaLima()}`;
    }
    else if (d.isDashboard === true || String(placa).startsWith('DASHBOARD_')) {
      pushTitle = 'Solicitud de Dashboard';
      pushBody = `${email} solicita acceso al dashboard`;
      telegramMsg = `🏢 <b>SOLICITUD DE DASHBOARD</b>\n\n📧 Email: <b>${email}</b>\n` +
        (whatsapp ? `📱 WhatsApp: <b>${whatsapp}</b>\n` : '') + `\n🕐 ${fechaLima()}`;
    }
    else if (d.isIndividual === true) {
      pushTitle = servicio || 'Consulta Individual';
      pushBody = `Placa: ${placa} - ${email}`;
      telegramMsg = `📄 <b>CONSULTA INDIVIDUAL</b>\n\n📁 Servicio: <b>${servicio || 'Consulta Individual'}</b>\n🚗 Placa: <b>${placa}</b>\n📧 Email: <b>${email}</b>\n\n🕐 ${fechaLima()}`;
    }
    else {
      pushTitle = 'Nueva Solicitud';
      pushBody = `Placa: ${placa} - ${email}`;
      telegramMsg = `📋 <b>NUEVA SOLICITUD</b>\n\n📁 Servicio: <b>${servicio || 'Filtro Vehicular Completo'}</b>\n🚗 Placa: <b>${placa}</b>\n📧 Email: <b>${email}</b>\n\n🕐 ${fechaLima()}`;
    }

    // Enviar en paralelo: Telegram + Web Push
    await Promise.allSettled([
      telegramMsg ? sendTelegram(telegramMsg) : Promise.resolve(),
      sendAllPushNotifications(pushTitle, pushBody)
    ]);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Edge Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
