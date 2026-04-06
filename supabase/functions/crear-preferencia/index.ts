import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') || '';
const SITE_URL = Deno.env.get('SITE_URL') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';

const PLANS: Record<string, { title: string; price: number; credits: number; type: string }> = {
  filtro:      { title: 'Filtro Vehicular Completo',           price: 45,  credits: 0,    type: 'filtro' },
  acceso:      { title: 'Acceso Plataforma Premium',           price: 35,  credits: 0,    type: 'activacion' },
  avanzado:    { title: 'Plan Avanzado - 850 Creditos',        price: 42,  credits: 850,  type: 'recarga' },
  business:    { title: 'Plan Business - 2000 Creditos',       price: 84,  credits: 2000, type: 'recarga' },
  profesional: { title: 'Plan Profesional - 4000 Creditos',    price: 140, credits: 4000, type: 'recarga' },
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { plan, email, placa } = await req.json();

    if (!plan || !email || !PLANS[plan]) {
      return new Response(
        JSON.stringify({ error: 'Plan o email invalido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!MP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'MercadoPago no configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const p = PLANS[plan];

    const preference = {
      items: [{
        title: p.title,
        quantity: 1,
        unit_price: p.price,
        currency_id: 'PEN',
      }],
      payer: { email },
      external_reference: JSON.stringify({
        email,
        credits: p.credits,
        type: p.type,
        plan,
        ...(placa ? { placa } : {}),
      }),
      back_urls: {
        success: `${SITE_URL}/pago-exitoso.html`,
        failure: `${SITE_URL}/index.html`,
        pending: `${SITE_URL}/pago-pendiente.html`,
      },
      auto_return: 'approved',
      notification_url: `${SUPABASE_URL}/functions/v1/webhook-mercadopago`,
      statement_descriptor: 'FILTRO VEHICULAR',
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('MP error:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'Error al crear preferencia de pago' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ init_point: data.init_point, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Edge error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
