-- ============================================================
-- WELCOME RESTRICTION — los 5 créditos de bienvenida solo se
-- pueden usar en la sección "Tipo de consulta" de la página de
-- inicio (consultas con categoria = 'filter'). Cada consulta
-- descuenta su precio_venta real del saldo de créditos.
--
-- Una vez que el cliente recibe cualquier recarga (MP o admin),
-- se desbloquea todo el catálogo (Reniec, Telefonía, etc).
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ===== 1. Columna `has_paid_credits` en profiles =====
alter table public.profiles
  add column if not exists has_paid_credits boolean not null default false;

-- Backfill: marca como "ya pagó" a cualquiera que tenga al menos una
-- transacción positiva de tipo purchase o admin_adjust.
update public.profiles p
   set has_paid_credits = true
 where p.has_paid_credits = false
   and exists (
     select 1 from public.transactions t
      where t.user_id = p.id
        and t.amount > 0
        and t.type in ('purchase', 'admin_adjust', 'subscription')
   );


-- ===== 2. Trigger: marcar has_paid_credits = true automáticamente =====
-- Cuando entra una transacción nueva con monto positivo de tipo
-- purchase, admin_adjust o subscription → el usuario queda como "ya pagó"
-- y se le desbloquean todas las categorías.
create or replace function public.mark_user_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount > 0 and new.type in ('purchase', 'admin_adjust', 'subscription') then
    update public.profiles
       set has_paid_credits = true,
           updated_at = now()
     where id = new.user_id
       and has_paid_credits = false;
  end if;
  return new;
end;
$$;

drop trigger if exists on_transaction_mark_paid on public.transactions;
create trigger on_transaction_mark_paid
  after insert on public.transactions
  for each row execute procedure public.mark_user_paid();


-- ===== 3. consume_credits — bloquea categorías para usuarios free =====
-- Si el usuario NO ha pagado nunca, solo puede consultar las categorías
-- en la lista ALLOWED_FREE (filter = sección "Tipo de consulta" del
-- home). Para el resto recibe un error claro pidiendo que recargue.
-- El descuento se hace según el precio_venta real de cada consulta.
--
-- Mantiene además la lógica de suscripción activa (cost = 0).
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
  -- Solo la sección "Tipo de consulta" del home (categoria='filter')
  -- está disponible con los 5 créditos de bienvenida. El resto del
  -- catálogo se desbloquea cuando el cliente hace su primera recarga.
  ALLOWED_FREE constant text[] := array['filter'];
begin
  -- Lock atómico de la fila del usuario
  select credits_balance, subscription_expires_at, has_paid_credits
    into current_balance, sub_expires, caller_paid
    from public.profiles where id = auth.uid()
    for update;

  if current_balance is null then
    raise exception 'Usuario no encontrado';
  end if;

  -- ===== Restricción de categorías para usuarios free =====
  -- Si nunca pagó/recibió cargos y el módulo no está en la lista permitida,
  -- bloqueamos la consulta antes de tocar saldo o llamar al bot.
  if not coalesce(caller_paid, false)
     and not (lower(module_name) = any(ALLOWED_FREE)) then
    raise exception 'Esta categoría se desbloquea con tu primera recarga. Tus créditos de bienvenida solo aplican en la sección "Tipo de consulta" del inicio.';
  end if;

  is_subscribed := sub_expires is not null and sub_expires > now();

  if is_subscribed then
    -- Suscripción activa: consulta gratis, registramos cost=0
    effective_cost := 0;
  else
    -- Sin suscripción: validar saldo y descontar
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
