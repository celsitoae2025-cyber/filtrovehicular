import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { email, nombre } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generar código de 6 dígitos
    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    const expira = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutos

    // Guardar en BD
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Eliminar códigos previos de este email
    await sb.from('codigos_verificacion').delete().eq('email', email);

    // Insertar nuevo código
    const { error: dbError } = await sb.from('codigos_verificacion').insert({
      email,
      codigo,
      expira_en: expira,
      intentos: 0,
    });

    if (dbError) {
      console.error('DB error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Error interno al generar código' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar email con Resend
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY no configurada');
      return new Response(
        JSON.stringify({ error: 'Servicio de email no configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Filtro Vehicular+ <noreply@filtrovehicularperu.com>',
        to: [email],
        subject: `${codigo} es tu código de verificación — Filtro Vehicular+`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif"><div style="max-width:500px;margin:0 auto;padding:24px 16px"><div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee"><div style="padding:24px 28px 16px"><div style="font-size:14px;font-weight:700;color:#1d1e1d;letter-spacing:1.5px;margin-bottom:16px">FILTRO VEHICULAR+</div></div><div style="background:#f5f0e4;padding:18px 28px"><div style="font-size:18px;font-weight:600;color:#1d1e1d">Código de verificación de<br/>Filtro Vehicular+</div></div><div style="padding:28px 28px 24px"><div style="font-size:14px;color:#333;line-height:1.7;margin-bottom:20px">Hola${nombre ? ', ' + nombre : ''}.<br/><br/>Recibimos una solicitud para verificar tu cuenta con tu dirección de correo electrónico. Tu código de verificación es:</div><div style="text-align:center;padding:16px 0 20px"><div style="font-size:36px;font-weight:700;color:#1d1e1d;letter-spacing:6px">${codigo}</div></div><div style="text-align:center;margin-bottom:24px"><a href="https://filtrovehicularperu.com/preview.html?vc=${codigo}&ve=${encodeURIComponent(email)}" style="display:inline-block;padding:12px 32px;background:#1d1e1d;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">Activar mi cuenta</a></div><div style="font-size:13px;color:#555;line-height:1.7;margin-bottom:16px">Si no solicitaste este código, es posible que otra persona esté intentando acceder a tu cuenta. <b>No reenvíes ni compartas este código con nadie.</b></div><div style="font-size:13px;color:#555;line-height:1.7">Este código vence en <b>5 minutos</b>.</div></div><div style="padding:16px 28px;border-top:1px solid #f0f0f0"><div style="font-size:13px;color:#888;line-height:1.6">Atentamente,<br/><br/>El equipo de Filtro Vehicular+</div></div></div><div style="text-align:center;padding:16px;font-size:11px;color:#aaa"><a href="https://filtrovehicularperu.com" style="color:#999;text-decoration:none">filtrovehicularperu.com</a></div></div></body></html>`,
      }),
    });

    if (!emailRes.ok) {
      const errData = await emailRes.json().catch(() => ({}));
      console.error('Resend error:', JSON.stringify(errData));
      return new Response(
        JSON.stringify({ error: 'No se pudo enviar el correo. Intenta de nuevo.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, message: 'Código enviado al correo' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
