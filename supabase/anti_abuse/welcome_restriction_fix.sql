-- ============================================================
-- FIX: usuarios con plan por días activo recibían el error
-- "Esta categoría se desbloquea con tu primera recarga..."
-- al intentar consultar categorías premium.
--
-- Causa: consume_credits solo permitía pasar si has_paid_credits=true.
-- Si el admin activaba un plan sin entregar créditos (amount=0),
-- el trigger mark_user_paid no marcaba al usuario como pagado.
--
-- Solución:
--   1) consume_credits — permitir paso si tiene suscripción vigente
--      (además del flag has_paid_credits y categorías ALLOWED_FREE).
--   2) mark_user_paid — también marcar has_paid_credits=true cuando
--      entra una transacción de tipo 'subscription' (aunque amount=0).
--
-- Idempotente. Ejecutar UNA VEZ en SQL Editor de Supabase.
-- ============================================================

-- ===== 1) consume_credits: añade el OR de suscripción vigente =====
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
  caller_paid boolean;
  is_subscribed boolean;
  consulta_id uuid;
  effective_cost integer;
  ALLOWED_FREE constant text[] := array['filter'];
begin
  select credits_balance, subscription_expires_at, has_paid_credits
    into current_balance, sub_expires, caller_paid
    from public.profiles where id = auth.uid()
    for update;

  if current_balance is null then
    raise exception 'Usuario no encontrado';
  end if;

  is_subscribed := sub_expires is not null and sub_expires > now();

  -- ===== Restricción de categorías para usuarios free =====
  -- Pasa si: ya pagó alguna vez, O tiene suscripción activa,
  -- O la categoría está en la lista permitida (filter).
  if not coalesce(caller_paid, false)
     and not is_subscribed
     and not (lower(module_name) = any(ALLOWED_FREE)) then
    raise exception 'Esta categoría se desbloquea con tu primera recarga. Tus créditos de bienvenida solo aplican en la sección "Tipo de consulta" del inicio.';
  end if;

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


-- ===== 2) mark_user_paid: marcar también con type='subscription' (amount=0) =====
create or replace function public.mark_user_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Cualquier purchase / admin_adjust / subscription desbloquea el catálogo.
  -- Para subscription aceptamos amount=0 (planes por días sin créditos extra).
  if new.type in ('purchase', 'admin_adjust', 'subscription')
     and (new.amount > 0 or new.type = 'subscription') then
    update public.profiles
       set has_paid_credits = true,
           updated_at = now()
     where id = new.user_id
       and has_paid_credits = false;
  end if;
  return new;
end;
$$;


-- ===== 3) Backfill: marcar como pagados a usuarios con plan activo =====
-- Cualquier usuario con subscription_expires_at futuro queda desbloqueado
-- aunque nunca haya tenido una transacción positiva.
update public.profiles
   set has_paid_credits = true,
       updated_at = now()
 where has_paid_credits = false
   and subscription_expires_at is not null
   and subscription_expires_at > now();
