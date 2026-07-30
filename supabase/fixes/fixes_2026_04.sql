-- ============================================================
-- FIXES 2026-04 — Filtro Vehicular+
--
-- Este script:
--   1. Asegura que las columnas de suscripción existan en `profiles`
--      (estaban en la BD viva pero faltaban en el schema versionado).
--   2. Reescribe `consume_credits` para que NO descuente del saldo
--      cuando el usuario tiene una suscripción activa (consultas
--      ilimitadas durante los días contratados).
--   3. Agrega `refund_consulta(uuid)` para revertir un cobro cuando
--      el bridge / bot falla después de que ya descontamos créditos.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Es idempotente.
-- ============================================================

-- ===== 1. Columnas de suscripción en profiles =====
alter table public.profiles
  add column if not exists subscription_tier        text,
  add column if not exists subscription_plan_id     text,
  add column if not exists subscription_started_at  timestamptz,
  add column if not exists subscription_expires_at  timestamptz;

create index if not exists profiles_subscription_active_idx
  on public.profiles (subscription_expires_at)
  where subscription_expires_at is not null;


-- ===== 2. consume_credits — respeta suscripción activa =====
-- Si subscription_expires_at > now() ⇒ inserta la consulta con cost=0
-- y NO toca el saldo. Si no hay suscripción ⇒ valida saldo y descuenta
-- como antes (atómico, con FOR UPDATE).
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

  -- Registramos transacción solo si efectivamente cobramos algo
  if effective_cost > 0 then
    insert into public.transactions (user_id, type, amount, description)
    values (auth.uid(), 'consultation', -effective_cost, module_name || ' / ' || q_type);
  end if;

  return consulta_id;
end;
$$;


-- ===== 3. refund_consulta — revertir cobro tras fallo del bot =====
-- El frontend cobra antes de llamar al bridge. Si el bridge devuelve
-- error o el bot no responde, llamamos a esta RPC para devolver los
-- créditos y marcar la consulta como 'error'. Es idempotente: solo
-- refunda consultas en estado 'pending' del propio usuario.
create or replace function public.refund_consulta(
  consulta_id uuid,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c_user uuid;
  c_cost integer;
  c_status text;
  c_module text;
  c_type text;
begin
  select user_id, cost, status, module, type
    into c_user, c_cost, c_status, c_module, c_type
    from public.consultas
    where id = consulta_id
    for update;

  if c_user is null then
    raise exception 'Consulta no encontrada';
  end if;

  -- Solo el dueño puede refundir su propia consulta
  if c_user <> auth.uid() then
    raise exception 'No autorizado';
  end if;

  -- Solo refundar si está en pending (idempotencia)
  if c_status <> 'pending' then
    return;
  end if;

  -- Marcar la consulta como error
  update public.consultas
     set status = 'error',
         error_message = coalesce(reason, 'Bot no respondió o devolvió error')
   where id = consulta_id;

  -- Si no se cobró nada (suscripción), no hay nada más que hacer
  if c_cost is null or c_cost <= 0 then
    return;
  end if;

  -- Devolver el crédito al saldo
  update public.profiles
     set credits_balance = credits_balance + c_cost,
         updated_at = now()
   where id = auth.uid();

  -- Registrar la transacción de refund
  insert into public.transactions (user_id, type, amount, description)
  values (auth.uid(), 'refund', c_cost,
          'Reembolso ' || c_module || ' / ' || coalesce(c_type, '') ||
          case when reason is not null then ' — ' || reason else '' end);
end;
$$;

grant execute on function public.refund_consulta(uuid, text) to authenticated;


-- ===== 4. confirm_consulta — marcar la consulta como exitosa =====
-- Opcional pero recomendado: el frontend la llama tras render OK.
-- No toca saldo, solo cambia el status para que el historial diferencie
-- pending / success / error.
create or replace function public.confirm_consulta(
  consulta_id uuid,
  result_url_in text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c_user uuid;
  c_status text;
begin
  select user_id, status
    into c_user, c_status
    from public.consultas
    where id = consulta_id
    for update;

  if c_user is null then
    raise exception 'Consulta no encontrada';
  end if;
  if c_user <> auth.uid() then
    raise exception 'No autorizado';
  end if;
  if c_status <> 'pending' then
    return; -- idempotente
  end if;

  update public.consultas
     set status = 'success',
         result_url = result_url_in
   where id = consulta_id;
end;
$$;

grant execute on function public.confirm_consulta(uuid, text) to authenticated;
