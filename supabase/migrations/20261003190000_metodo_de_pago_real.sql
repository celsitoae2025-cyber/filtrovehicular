-- ============================================================
-- CÓMO PAGÓ EL CLIENTE, DE VERDAD
--
-- Las ventas manuales se guardaban siempre con payment_method =
-- 'whatsapp', escrito a pelo dentro de la función. Daba igual que el
-- cliente pagara por Yape, por Plin, en efectivo o por transferencia:
-- en la base todo era «whatsapp». Por eso el panel de Compras, que
-- ofrece filtrar por Yape, Plin o Visa, no devolvía jamás una fila y
-- los totales por método no cuadraban con nada.
--
-- admin_record_sale pasa a aceptar p_method y guarda lo que se le diga.
-- El valor por defecto sigue siendo 'whatsapp', así que cualquier
-- llamada antigua se comporta exactamente igual que hasta hoy.
--
-- Se borra primero la versión anterior: añadir un parámetro crearía una
-- segunda función con el mismo nombre y PostgREST no sabría a cuál
-- llamar.
--
-- NO se toca admin_grant_subscription. Para que la venta de un plan
-- también lleve su método, el panel deja de pasarle el importe y anota
-- la venta con esta misma función (una sola fila, igual que antes).
-- ============================================================

drop function if exists public.admin_record_sale(uuid, numeric, text, text, text);

create or replace function public.admin_record_sale(
  target_user_id  uuid,
  p_amount_pen    numeric,
  p_kind          text default 'credits',   -- 'credits' | 'subscription'
  p_plan_id       text default null,
  p_note          text default null,
  p_method        text default 'whatsapp'   -- yape | plin | efectivo | transferencia | mercadopago | whatsapp
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  new_id          uuid;
  desc_txt        text;
begin
  select coalesce(p.is_admin, false) into caller_is_admin
  from public.profiles p where p.id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo admins pueden registrar ventas';
  end if;

  if p_amount_pen is null or p_amount_pen <= 0 then
    raise exception 'p_amount_pen debe ser un número positivo';
  end if;

  desc_txt := 'Venta ' || coalesce(p_kind, 'manual') ||
              coalesce(' (' || p_plan_id || ')', '') ||
              coalesce(' · ' || p_note, '');

  insert into public.transactions (
    user_id, type, amount, amount_pen,
    payment_method, description, reference
  ) values (
    target_user_id,
    'sale',
    0,
    p_amount_pen,
    coalesce(nullif(trim(p_method), ''), 'whatsapp'),
    desc_txt,
    p_plan_id
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.admin_record_sale(uuid, numeric, text, text, text, text) to authenticated;
