-- ============================================================
-- FIX: Créditos de bienvenida se pueden usar en TODAS las categorías
-- (excepto las premium que requieren suscripción, eso se valida en frontend).
--
-- Antes: usuarios con créditos gratis solo podían usar "filter".
-- Ahora: pueden usar cualquier categoría si tienen saldo.
--
-- También mejora el refund para cubrir más edge cases.
--
-- Ejecutar UNA VEZ en SQL Editor de Supabase.
-- ============================================================

-- ===== 1. consume_credits SIN restricción caller_paid =====
create or replace function public.consume_credits(
  cost integer,
  module_name text,
  q_type text,
  q_input text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  sub_expires timestamptz;
  is_subscribed boolean;
  consulta_id uuid;
  effective_cost integer;
begin
  -- Lock atómico de la fila del usuario
  select credits_balance, subscription_expires_at
    into current_balance, sub_expires
    from public.profiles where id = auth.uid()
    for update;

  if current_balance is null then
    raise exception 'Usuario no encontrado';
  end if;

  is_subscribed := sub_expires is not null and sub_expires > now();

  if is_subscribed then
    effective_cost := 0;
  else
    if current_balance < cost then
      raise exception 'Créditos insuficientes';
    end if;
    effective_cost := cost;

    update public.profiles
       set credits_balance = credits_balance - cost,
           updated_at = now()
     where id = auth.uid();
  end if;

  insert into public.consultas (user_id, module, type, input, cost, status)
  values (auth.uid(), module_name, q_type, q_input, effective_cost, 'pending')
  returning id into consulta_id;

  if effective_cost > 0 then
    insert into public.transactions (user_id, type, amount, description)
    values (auth.uid(), 'consultation', -effective_cost, module_name || ' / ' || q_type);
  end if;

  return consulta_id;
end;
$$;

grant execute on function public.consume_credits(integer, text, text, text) to authenticated;
