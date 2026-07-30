-- ============================================================
-- Sistema de notificaciones para Filtro Vehicular+
-- Corre este script UNA VEZ en el SQL Editor de Supabase.
-- ============================================================

-- 1. Tabla de notificaciones
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'info',        -- 'credits' | 'system' | 'promo' | 'info'
  title text not null,
  body text,
  meta jsonb,                                -- datos extra (créditos, motivo, etc.)
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

-- 2. RLS — cada usuario solo ve/modifica las suyas
alter table public.notifications enable row level security;

drop policy if exists "notif_select_own" on public.notifications;
create policy "notif_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notif_update_own" on public.notifications;
create policy "notif_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. RPC para que el admin cree una notificación a cualquier usuario
--    Requiere que el que llama sea admin (profiles.is_admin = true).
create or replace function public.admin_create_notification(
  target_user_id uuid,
  n_title text,
  n_body text default null,
  n_type text default 'info',
  n_meta jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  new_id uuid;
begin
  select is_admin into caller_is_admin
  from public.profiles
  where id = auth.uid();

  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo admins pueden crear notificaciones';
  end if;

  insert into public.notifications (user_id, type, title, body, meta)
  values (target_user_id, coalesce(n_type, 'info'), n_title, n_body, n_meta)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.admin_create_notification(uuid, text, text, text, jsonb) to authenticated;

-- 4. RPC para que el usuario marque una notificación como leída
create or replace function public.mark_notification_read(n_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where id = n_id and user_id = auth.uid() and read_at is null;
end;
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;

-- 5. RPC para marcar todas como leídas (botón "marcar todas")
create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null;
end;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;

-- 6. RPC conveniencia: contar notificaciones sin leer (para badge)
create or replace function public.unread_notifications_count()
returns integer
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  c integer;
begin
  select count(*)::int into c
  from public.notifications
  where user_id = auth.uid() and read_at is null;
  return coalesce(c, 0);
end;
$$;

grant execute on function public.unread_notifications_count() to authenticated;
