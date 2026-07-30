-- ============================================================
-- ADMIN LIST USER TRANSACTIONS — RPC para que un admin lea
-- el historial de movimientos de cualquier usuario.
--
-- Lo consume el modal de detalle de usuario en el panel admin
-- (js/admin/users.js → openDetail()), que muestra los últimos 10
-- movimientos en una lista.
--
-- Sin esta función, la llamada `sb.rpc('admin_list_user_transactions',
-- { target_user_id })` falla y el modal siempre muestra
-- "Sin movimientos registrados".
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- Si ya existe una versión con otra firma/return type, la dropeamos
-- (Postgres no permite cambiar el return type con CREATE OR REPLACE).
drop function if exists public.admin_list_user_transactions(uuid);

create or replace function public.admin_list_user_transactions(
  target_user_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  type text,
  amount integer,
  description text,
  plan_id text,
  payment_method text,
  reference text,
  created_at timestamptz,
  created_by uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  -- Solo admins pueden leer transacciones de otros usuarios
  select coalesce(is_admin, false) into caller_is_admin
    from public.profiles
   where id = auth.uid();

  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo los administradores pueden listar transacciones de otros usuarios';
  end if;

  return query
    select t.id,
           t.user_id,
           t.type,
           t.amount,
           t.description,
           t.plan_id,
           t.payment_method,
           t.reference,
           t.created_at,
           t.created_by
      from public.transactions t
     where t.user_id = target_user_id
     order by t.created_at desc
     limit 200;
end;
$$;

grant execute on function public.admin_list_user_transactions(uuid) to authenticated;
