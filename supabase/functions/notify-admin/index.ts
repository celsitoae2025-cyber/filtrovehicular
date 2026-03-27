// Supabase Edge Function: notify-admin
// Se dispara automáticamente cuando hay nuevos eventos en la base de datos
// Envía: 1) Notificación Push a la app del celular (FCM API V1), 2) Mensaje a Telegram

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Variables de entorno (configurar en Supabase Dashboard → Edge Functions → Secrets)
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '8582237665:AAEKxiJcwCcdF3-FhDC7ngwkLflGq-_kwx8';
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || '7556866897';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Firebase Service Account (para FCM API V1)
const FIREBASE_PROJECT_ID = 'filtro2026-d9530';
const FIREBASE_CLIENT_EMAIL = 'firebase-adminsdk-fbsvc@filtro2026-d9530.iam.gserviceaccount.com';
const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY') || '';

// Obtener token de acceso OAuth2 para FCM API V1
async function getFirebaseAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  // Limpiar y normalizar la clave privada (múltiples estrategias de limpieza)
  let pemKey = FIREBASE_PRIVATE_KEY;
  // Reemplazar literales \n por saltos de línea reales
  pemKey = pemKey.replace(/\\n/g, '\n');
  // Eliminar posibles comillas al inicio/fin
  pemKey = pemKey.replace(/^["']|["']$/g, '');
  
  const keyData = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');  // Eliminar TODOS los espacios/saltos
  
  // Decodificar base64 de forma segura
  const binaryString = atob(keyData);
  const binaryKey = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    binaryKey[i] = binaryString.charCodeAt(i);
  }
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Crear JWT
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const encode = (obj: object) => btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${signingInput}.${sigB64}`;

  // Intercambiar JWT por access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(`Error obteniendo access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// Función para enviar mensaje a Telegram
async function sendTelegram(message: string): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
    const result = await response.json();
    console.log('Telegram enviado:', result.ok ? '✅' : '❌');
  } catch (error) {
    console.error('Error enviando a Telegram:', error);
  }
}

// Función para obtener tokens FCM de Supabase
async function getFCMTokens(): Promise<string[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_push_tokens?select=token`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    const tokens = await response.json();
    return Array.isArray(tokens) ? tokens.map((t: any) => t.token) : [];
  } catch (error) {
    console.error('Error obteniendo tokens FCM:', error);
    return [];
  }
}

// Función para enviar notificación push vía Firebase FCM API V1
async function sendPushNotification(title: string, body: string, data: Record<string, string> = {}): Promise<void> {
  const tokens = await getFCMTokens();

  if (tokens.length === 0) {
    console.log('No hay tokens FCM registrados aún');
    return;
  }

  console.log(`Enviando push a ${tokens.length} dispositivo(s)...`);

  let accessToken: string;
  try {
    accessToken = await getFirebaseAccessToken();
  } catch (e) {
    console.error('Error obteniendo access token:', e);
    return;
  }

  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

  for (const token of tokens) {
    try {
      const response = await fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: {
              ...data,
              url: 'https://filtrovehicularperu.com/admin.html',
              timestamp: Date.now().toString()
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channel_id: 'filtro_admin',
                priority: 'max',
                visibility: 'PUBLIC',
                vibrate_timings: ['0.5s', '0.2s', '0.5s', '0.2s', '0.5s'],
                default_vibrate_timings: false,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
              }
            },
            apns: {
              payload: {
                aps: { sound: 'default', badge: 1, 'content-available': 1 }
              }
            },
            webpush: {
              notification: {
                icon: 'https://filtrovehicularperu.com/assets/media/logopwa.png',
                badge: 'https://filtrovehicularperu.com/assets/media/logopwa.png',
                requireInteraction: true,
                vibrate: [500, 200, 500, 200, 500]
              },
              fcm_options: {
                link: 'https://filtrovehicularperu.com/admin.html'
              }
            }
          }
        })
      });

      const result = await response.json();
      if (result.name) {
        console.log(`✅ Push enviado a token ...${token.slice(-8)}`);
      } else {
        console.error(`❌ Error push token ...${token.slice(-8)}:`, JSON.stringify(result));
      }
    } catch (error) {
      console.error('Error enviando push:', error);
    }
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
    let pushData: Record<string, string> = {};

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
      pushData = { type: 'new_user', email };

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
      pushData = { type: 'new_payment', placa };

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
      pushData = { type: 'dashboard_request', email };

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
      pushData = { type: 'new_request', placa };

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
        pushTitle ? sendPushNotification(pushTitle, pushBody, pushData) : Promise.resolve()
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
