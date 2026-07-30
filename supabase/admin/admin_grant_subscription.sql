-- ============================================================
-- ADMIN GRANT / CANCEL SUBSCRIPTION
-- RPCs para que el panel administrativo pueda activar o cancelar
-- una suscripción Profesional / Profesional Plus / Business y
-- enviar la notificación correspondiente al usuario.
--
-- Requisitos previos:
--   - public.profiles con columnas subscription_tier,
--     subscription_plan_id, subscription_started_at, subscription_expires_at
--     (creadas en supabase/fixes_2026_04.sql)
--   - public.notifications (creada en supabase/notifications.sql)
--
-- Ejecuta este script UNA VEZ en el SQL Editor de Supabase.
-- ============================================================

-- ============================================================
-- 1) admin_grant_subscription — activa o extiende una suscripción
-- ============================================================
-- Si el usuario ya tiene una suscripción activa del MISMO tier,
-- los días se SUMAN al expires_at actual. Si no, empieza desde now().
-- También crea una notificación in-app.
-- ============================================================
create or replace function public.admin_grant_subscription(
  target_user_id uuid,
  p_tier         text,
  p_days         integer,
  p_plan_id      text default null,
  p_note         text default null
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

  -- Tomar lock atómico de la fila del usuario destino
  select subscription_expires_at, subscription_tier
    into current_expires, current_tier
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Usuario destino no encontrado';
  end if;

  -- Si ya tiene una suscripción activa del MISMO tier, extender
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
      'extended', current_expires is not null and current_expires > now() and current_tier = p_tier
    )
  );

  return json_build_object(
    'tier', p_tier,
    'plan_id', p_plan_id,
    'days', p_days,
    'expires_at', new_expires,
    'extended', current_expires is not null and current_expires > now() and current_tier = p_tier
  );
end;
$$;

grant execute on function public.admin_grant_subscription(uuid, text, integer, text, text) to authenticated;


-- ============================================================
-- 2) admin_cancel_subscription — desactiva la suscripción
-- ============================================================
-- Pone subscription_tier/expires_at a NULL y notifica al usuario.
-- ============================================================
create or replace function public.admin_cancel_subscription(
  target_user_id uuid,
  p_note         text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  prev_tier       text;
  prev_expires    timestamptz;
  tier_label      text;
begin
  -- Solo admins
  select coalesce(is_admin, false) into caller_is_admin
  from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo admins pueden cancelar suscripciones';
  end if;

  -- Lock atómico
  select subscription_tier, subscription_expires_at
    into prev_tier, prev_expires
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Usuario destino no encontrado';
  end if;

  if prev_tier is null and prev_expires is null then
    raise exception 'El usuario no tiene un plan activo';
  end if;

  -- Limpiar suscripción
  update public.profiles
  set subscription_tier       = null,
      subscription_plan_id    = null,
      subscription_started_at = null,
      subscription_expires_at = null
  where id = target_user_id;

  tier_label := coalesce(case prev_tier
                  when 'profesional'      then 'Profesional'
                  when 'profesional_plus' then 'Profesional Plus'
                  when 'business'         then 'Business'
                  else prev_tier
                end, 'tu plan');

  -- Notificación
  insert into public.notifications (user_id, type, title, body, meta)
  values (
    target_user_id,
    'system',
    'Plan cancelado',
    'Tu plan ' || tier_label || ' ha sido cancelado por el administrador.' ||
      case when p_note is not null and length(trim(p_note)) > 0
           then ' Motivo: ' || p_note else '' end,
    jsonb_build_object('previous_tier', prev_tier, 'previous_expires_at', prev_expires)
  );

  return json_build_object(
    'previous_tier', prev_tier,
    'previous_expires_at', prev_expires
  );
end;
$$;

grant execute on function public.admin_cancel_subscription(uuid, text) to authenticated;


-- ============================================================
-- Verificación rápida (corre como admin):
-- ============================================================
-- select public.admin_grant_subscription(
--   '<user-uuid>'::uuid, 'profesional_plus', 30, 'sp-pp-30', 'Pago WhatsApp');
--
-- select public.admin_cancel_subscription(
--   '<user-uuid>'::uuid, 'Solicitado por el usuario');
