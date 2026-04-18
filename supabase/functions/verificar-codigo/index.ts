import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { email, codigo } = await req.json();

    if (!email || !codigo) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Email y código requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Buscar el código más reciente para este email
    const { data, error } = await sb
      .from('codigos_verificacion')
      .select('*')
      .eq('email', email)
      .eq('verificado', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No se encontró un código pendiente. Solicita uno nuevo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar expiración
    if (new Date(data.expira_en) < new Date()) {
      await sb.from('codigos_verificacion').delete().eq('id', data.id);
      return new Response(
        JSON.stringify({ ok: false, error: 'El código expiró. Solicita uno nuevo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar intentos (máximo 5)
    if (data.intentos >= 5) {
      await sb.from('codigos_verificacion').delete().eq('id', data.id);
      return new Response(
        JSON.stringify({ ok: false, error: 'Demasiados intentos. Solicita un código nuevo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar código
    if (data.codigo !== codigo.trim()) {
      // Incrementar intentos
      await sb.from('codigos_verificacion')
        .update({ intentos: data.intentos + 1 })
        .eq('id', data.id);

      const restantes = 4 - data.intentos;
      return new Response(
        JSON.stringify({ ok: false, error: `Código incorrecto. ${restantes > 0 ? restantes + ' intentos restantes.' : 'Último intento.'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Código correcto: marcar como verificado y limpiar
    await sb.from('codigos_verificacion')
      .update({ verificado: true })
      .eq('id', data.id);

    return new Response(
      JSON.stringify({ ok: true, message: 'Código verificado correctamente' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message || 'Error interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
