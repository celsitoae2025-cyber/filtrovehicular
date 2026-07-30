-- ============================================================
-- BROADCAST NOTIFICATIONS — anuncios masivos a usuarios
--
-- Permite al admin enviar una notificación a múltiples usuarios
-- de una sola vez (anuncios, novedades, mantenimientos, promos).
--
-- Componentes:
--   1. Tabla `broadcasts` — historial de anuncios enviados.
--   2. RPC `admin_count_broadcast_audience(audience)` — preview.
--   3. RPC `admin_broadcast_notification(...)`           — enviar.
--   4. RPC `admin_list_broadcasts()`                     — historial
--      con métricas (cuántas se leyeron).
--
-- Audiencias válidas:
--   • 'all'         — todos los usuarios confirmados, no admins, no suspendidos
--   • 'subscribers' — con suscripción activa
--   • 'with_credits'— con créditos > 0
--   • 'paid'        — han pagado al menos una vez (purchase / admin_adjust+)
--   • 'active_30d'  — login en los últimos 30 días
--
-- Excluye SIEMPRE: admins, suspendidos, no confirmados.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- 1) Tabla de historial -------------------------------------------------
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text,
  type text not null default 'info',     -- 'info' | 'system' | 'promo' | 'credits'
  title text not null,
  body text,
  image_url text,
  audience text not null default 'all',
  sent_count integer not null default 0,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- Añadir columna image_url si la tabla ya existía de una migración previa
alter table public.broadcasts add column if not exists image_url text;

create index if not exists broadcasts_created_idx
  on public.broadcasts (created_at desc);

alter table public.broadcasts enable row level security;

drop policy if exists "broadcasts_admin_select" on public.broadcasts;
create policy "broadcasts_admin_select"
  on public.broadcasts for select
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and coalesce(p.is_admin, false))
  );

-- 2) Helper: query base de audiencia ------------------------------------
-- Devuelve los user_ids que matchean la audiencia. SECURITY DEFINER
-- porque accede a auth.users (email_confirmed_at).
create or replace function public.admin_get_broadcast_audience(p_audience text)
returns setof uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_is_admin boolean;
begin
  select coalesce(p.is_admin, false) into caller_is_admin
    from public.profiles p where p.id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo administradores';
  end if;

  return query
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(p.is_admin, false) = false                  -- nunca admins
    and coalesce(p.status, 'active') = 'active'              -- nunca suspendidos
    and u.email_confirmed_at is not null                     -- nunca no confirmados
    and case p_audience
          when 'all'          then true
          when 'subscribers'  then p.subscription_expires_at is not null
                                   and p.subscription_expires_at > now()
          when 'with_credits' then coalesce(p.credits_balance, 0) > 0
          when 'paid'         then exists (
                                   select 1 from public.transactions t
                                   where t.user_id = p.id
                                     and (
                                       (t.type in ('purchase','subscription')
                                        and t.amount >= 0
                                        and t.payment_method in ('mercadopago','whatsapp','manual'))
                                       or (t.type = 'admin_adjust' and t.amount > 0)
                                     )
                                 )
          when 'active_30d'   then u.last_sign_in_at is not null
                                   and u.last_sign_in_at > now() - interval '30 days'
          else true
        end;
end;
$$;

grant execute on function public.admin_get_broadcast_audience(text) to authenticated;

-- 3) Preview: contar destinatarios --------------------------------------
create or replace function public.admin_count_broadcast_audience(p_audience text)
returns integer
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  c integer;
begin
  select count(*)::int into c
  from public.admin_get_broadcast_audience(p_audience);
  return coalesce(c, 0);
end;
$$;

grant execute on function public.admin_count_broadcast_audience(text) to authenticated;

-- 4) Enviar anuncio ------------------------------------------------------
-- NOTA: el parámetro p_image_url es opcional. Puede ser null.
-- Se almacena tanto en broadcasts.image_url como en notifications.meta.image_url
-- para que el cliente la muestre en su lista.
create or replace function public.admin_broadcast_notification(
  p_audience text,
  p_type text,
  p_title text,
  p_body text,
  p_meta jsonb default null,
  p_image_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_is_admin boolean;
  caller_email text;
  bid uuid;
  inserted integer := 0;
  enriched_meta jsonb;
begin
  -- 1. Verificar admin
  select coalesce(p.is_admin, false), u.email
    into caller_is_admin, caller_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = auth.uid();

  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo administradores pueden enviar anuncios';
  end if;

  -- 2. Validaciones
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'El título es obligatorio';
  end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'El mensaje es obligatorio';
  end if;
  if length(p_title) > 200 then
    raise exception 'El título es demasiado largo (máx 200)';
  end if;
  if length(p_body) > 1000 then
    raise exception 'El mensaje es demasiado largo (máx 1000)';
  end if;
  if coalesce(p_type, '') not in ('info','system','promo','credits') then
    p_type := 'info';
  end if;

  -- 3. Crear el registro de broadcast
  insert into public.broadcasts (admin_id, admin_email, type, title, body, image_url, audience, meta)
  values (auth.uid(), caller_email, p_type, p_title, p_body, p_image_url, p_audience, p_meta)
  returning id into bid;

  -- 4. Enriquecer meta con el broadcast_id y la imagen (si hay)
  enriched_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('broadcast_id', bid);
  if p_image_url is not null and length(trim(p_image_url)) > 0 then
    enriched_meta := enriched_meta || jsonb_build_object('image_url', p_image_url);
  end if;

  -- 5. Insertar las notificaciones a todos los matched users
  with audience as (
    select * from public.admin_get_broadcast_audience(p_audience)
  )
  insert into public.notifications (user_id, type, title, body, meta)
  select a.admin_get_broadcast_audience, p_type, p_title, p_body, enriched_meta
  from audience a;

  get diagnostics inserted = row_count;

  -- 6. Actualizar el contador
  update public.broadcasts set sent_count = inserted where id = bid;

  return jsonb_build_object('broadcast_id', bid, 'sent_count', inserted);
end;
$$;

-- Permiso para la firma NUEVA (con p_image_url)
grant execute on function public.admin_broadcast_notification(text, text, text, text, jsonb, text)
  to authenticated;

-- Mantener el permiso de la firma antigua si existía (retrocompatible)
do $$ begin
  execute 'grant execute on function public.admin_broadcast_notification(text, text, text, text, jsonb) to authenticated';
exception when undefined_function then null; end $$;

-- 5) Listar historial con métricas de lectura ---------------------------
-- Si la función ya existía con otra firma/tipo, la eliminamos primero.
drop function if exists public.admin_list_broadcasts();

create or replace function public.admin_list_broadcasts()
returns table (
  id uuid,
  admin_email text,
  type text,
  title text,
  body text,
  image_url text,
  audience text,
  sent_count integer,
  read_count integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  caller_is_admin boolean;
begin
  select coalesce(p.is_admin, false) into caller_is_admin
    from public.profiles p where p.id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo administradores';
  end if;

  return query
  select
    b.id,
    b.admin_email,
    b.type,
    b.title,
    b.body,
    b.image_url,
    b.audience,
    b.sent_count,
    coalesce((
      select count(*)::int
      from public.notifications n
      where n.meta ->> 'broadcast_id' = b.id::text
        and n.read_at is not null
    ), 0) as read_count,
    b.created_at
  from public.broadcasts b
  order by b.created_at desc
  limit 200;
end;
$$;

grant execute on function public.admin_list_broadcasts() to authenticated;

-- ============================================================
-- 6) STORAGE — bucket público 'broadcasts' para las imágenes
--    Las imágenes son públicas (se muestran a todos los usuarios)
--    pero SOLO admins pueden subirlas.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('broadcasts', 'broadcasts', true)
on conflict (id) do update set public = true;

-- Políticas del bucket
drop policy if exists "broadcasts_public_read" on storage.objects;
create policy "broadcasts_public_read"
  on storage.objects for select
  using (bucket_id = 'broadcasts');

drop policy if exists "broadcasts_admin_insert" on storage.objects;
create policy "broadcasts_admin_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'broadcasts'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false)
    )
  );

drop policy if exists "broadcasts_admin_delete" on storage.objects;
create policy "broadcasts_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'broadcasts'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false)
    )
  );
