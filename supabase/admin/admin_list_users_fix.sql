-- ============================================================
-- ADMIN LIST USERS — agregar `email_confirmed_at` al listado
--
-- La RPC `admin_list_users` venía sin este campo, por lo que el
-- panel admin marcaba TODOS los usuarios como "Sin confirmar".
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- Asegurar que las columnas opcionales existan, para que el SELECT
-- de la función no falle si todavía no se corrió fixes_2026_04 ni
-- welcome_restriction.sql.
alter table public.profiles
  add column if not exists has_paid_credits boolean not null default false,
  add column if not exists subscription_tier text,
  add column if not exists subscription_expires_at timestamptz;

-- Drop primero porque el tipo de retorno cambia (agregamos columnas).
drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  full_name text,
  phone text,
  credits_balance integer,
  status text,
  is_admin boolean,
  has_paid_credits boolean,
  subscription_tier text,
  subscription_expires_at timestamptz,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  select p.is_admin into caller_is_admin
    from public.profiles p where p.id = auth.uid();

  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo los administradores pueden listar usuarios';
  end if;

  return query
    select
      p.id,
      u.email::text,
      p.full_name,
      p.phone,
      p.credits_balance,
      p.status,
      p.is_admin,
      coalesce(p.has_paid_credits, false) as has_paid_credits,
      p.subscription_tier,
      p.subscription_expires_at,
      p.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;
