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
    const { email } = await req.json();

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
        subject: `${codigo} — Código de verificación · Filtro Vehicular+`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1d1e1d">
            <div style="text-align:center;margin-bottom:28px">
              <div style="font-size:18px;font-weight:700;letter-spacing:1px">FILTRO VEHICULAR+</div>
              <div style="font-size:12px;color:#8a7e5e;margin-top:4px">Verificación de cuenta</div>
            </div>
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:14px;color:#5e5848;margin-bottom:16px">Tu código de verificación es:</div>
              <div style="font-size:42px;font-weight:800;letter-spacing:8px;color:#1d1e1d;padding:18px 0;background:#f5f0e4;border-radius:12px">${codigo}</div>
            </div>
            <div style="font-size:13px;color:#8a7e5e;text-align:center;line-height:1.5;margin-bottom:24px">
              Este código vence en <b style="color:#1d1e1d">5 minutos</b>.<br/>
              Si no solicitaste este código, ignora este mensaje.
            </div>
            <div style="border-top:1px solid #e6dec8;padding-top:16px;text-align:center;font-size:11px;color:#b5a890">
              filtrovehicularperu.com · Lima, Perú
            </div>
          </div>
        `,
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
