-- ============================================================
-- ADMIN SALES TRACKING — registra el ingreso en S/ de las recargas
-- y suscripciones manuales (WhatsApp), para que el dashboard sume
-- correctamente "Ingresos (mes)".
--
-- Antes de este script, las recargas manuales solo guardaban la
-- cantidad de créditos en `transactions.amount` (entero), sin el
-- precio en soles. Por eso el KPI mostraba S/ 0.00 aunque hubieran
-- ventas reales por WhatsApp.
--
-- Este script:
--   1) Agrega la columna `amount_pen` a public.transactions
--   2) Crea la RPC public.admin_record_sale para registrar el
--      monto S/ de una venta manual.
--   3) Actualiza public.admin_grant_subscription para que también
--      registre el monto S/ del plan vendido.
--
-- IMPORTANTE: corre este script UNA SOLA VEZ en SQL Editor.
-- Es idempotente (puede correrse de nuevo sin romper nada).
-- ============================================================


-- ============================================================
-- 1) Agregar columna amount_pen (monto en soles)
-- ============================================================
alter table public.transactions
  add column if not exists amount_pen numeric(10, 2);

comment on column public.transactions.amount_pen is
  'Monto en soles (PEN) cuando esta transacción representa un ingreso real (venta manual o suscripción). NULL para consumos, ajustes negativos, bienvenida, etc.';

-- Índice parcial: acelera el KPI "ingresos del mes"
create index if not exists transactions_amount_pen_month_idx
  on public.transactions (created_at)
  where amount_pen is not null;


-- ============================================================
-- 2) RPC admin_record_sale — registra el monto S/ de una venta
--    manual (créditos por WhatsApp). Inserta una fila de tipo
--    'sale' en transactions con amount=0 y amount_pen=precio.
-- ============================================================
create or replace function public.admin_record_sale(
  target_user_id  uuid,
  p_amount_pen    numeric,
  p_kind          text default 'credits',   -- 'credits' | 'subscription'
  p_plan_id       text default null,
  p_note          text default null
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
  -- Solo admins
  select coalesce(is_admin, false) into caller_is_admin
  from public.profiles where id = auth.uid();
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
    'whatsapp',
    desc_txt,
    p_plan_id
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.admin_record_sale(uuid, numeric, text, text, text) to authenticated;


-- ============================================================
-- 3) admin_grant_subscription — versión con tracking de ingreso
--    Reemplaza la versión anterior. Acepta p_amount_pen opcional
--    para registrar el ingreso S/ de la suscripción.
-- ============================================================
drop function if exists public.admin_grant_subscription(uuid, text, integer, text, text);

create or replace function public.admin_grant_subscription(
  target_user_id  uuid,
  p_tier          text,
  p_days          integer,
  p_plan_id       text default null,
  p_note          text default null,
  p_amount_pen    numeric default null   -- ← NUEVO: precio en soles del plan
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  current_expires timestamptz;
  current_tier    text;
  base_date       timestamptz;
  new_expires     timestamptz;
  tier_label      text;
  notif_body      text;
begin
  -- Solo admins
  select coalesce(is_admin, false) into caller_is_admin
  from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo admins pueden otorgar suscripciones';
  end if;

  -- Validaciones
  if p_tier not in ('profesional', 'profesional_plus', 'business') then
    raise exception 'Tier inválido: % (debe ser profesional, profesional_plus o business)', p_tier;
  end if;
  if p_days is null or p_days <= 0 then
    raise exception 'p_days debe ser un entero positivo';
  end if;

  -- Lock atómico
  select subscription_expires_at, subscription_tier
    into current_expires, current_tier
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Usuario destino no encontrado';
  end if;

  -- Si ya tiene plan activo del MISMO tier, extender
  if current_expires is not null
     and current_expires > now()
     and current_tier = p_tier then
    base_date := current_expires;
  else
    base_date := now();
  end if;

  new_expires := base_date + (p_days || ' days')::interval;

  -- Actualizar perfil
  update public.profiles
  set subscription_tier        = p_tier,
      subscription_plan_id     = p_plan_id,
      subscription_started_at  = case
                                   when current_tier = p_tier and current_expires > now()
                                   then coalesce(subscription_started_at, now())
                                   else now()
                                 end,
      subscription_expires_at  = new_expires
  where id = target_user_id;

  -- Registrar ingreso S/ si se proporcionó precio
  if p_amount_pen is not null and p_amount_pen > 0 then
    insert into public.transactions (
      user_id, type, amount, amount_pen,
      payment_method, description, reference
    ) values (
      target_user_id,
      'sale',
      0,
      p_amount_pen,
      'whatsapp',
      'Venta suscripción ' || p_tier || ' (' || p_days || 'd)' ||
        coalesce(' · ' || p_note, ''),
      p_plan_id
    );
  end if;

  -- Notificación al usuario
  tier_label := case p_tier
                  when 'profesional'      then 'Profesional'
                  when 'profesional_plus' then 'Profesional Plus'
                  when 'business'         then 'Business'
                end;

  notif_body := 'Tu plan ' || tier_label || ' está activo por ' || p_days || ' día' ||
                case when p_days = 1 then '' else 's' end ||
                '. Vence el ' || to_char(new_expires at time zone 'America/Lima', 'DD/MM/YYYY') || '.' ||
                case when p_note is not null and length(trim(p_note)) > 0
                     then ' Nota: ' || p_note else '' end;

  insert into public.notifications (user_id, type, title, body, meta)
  values (
    target_user_id,
    'system',
    '¡Plan ' || tier_label || ' activado!',
    notif_body,
    jsonb_build_object(
      'tier', p_tier,
      'plan_id', p_plan_id,
      'days', p_days,
      'expires_at', new_expires,
      'amount_pen', p_amount_pen,
      'extended', current_expires is not null and current_expires > now() and current_tier = p_tier
    )
  );

  return json_build_object(
    'tier', p_tier,
    'plan_id', p_plan_id,
    'days', p_days,
    'expires_at', new_expires,
    'amount_pen', p_amount_pen,
    'extended', current_expires is not null and current_expires > now() and current_tier = p_tier
  );
end;
$$;

grant execute on function public.admin_grant_subscription(uuid, text, integer, text, text, numeric) to authenticated;


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- Confirma que la columna existe:
--   select column_name, data_type from information_schema.columns
--   where table_name='transactions' and column_name='amount_pen';
--
-- Suma de ingresos del mes (lo que mostrará el dashboard):
--   select coalesce(sum(amount_pen), 0) as ingresos_mes
--   from public.transactions
--   where amount_pen is not null
--     and created_at >= date_trunc('month', now());
