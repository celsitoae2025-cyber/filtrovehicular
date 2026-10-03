-- ============================================================
-- Arregla admin_list_admins: la pantalla Equipo salía siempre vacía.
--
-- La función devuelve una columna llamada is_admin, así que dentro del
-- cuerpo «select is_admin from public.profiles» no sabe si se refiere a
-- esa columna de salida o a la de la tabla: PostgreSQL lo rechaza con
-- 42702 («column reference "is_admin" is ambiguous») antes de leer nada,
-- y el panel recibía el error en lugar de la lista de administradores.
--
-- Única diferencia: la consulta del cuerpo va con alias (p.is_admin).
-- ============================================================
create or replace function public.admin_list_admins()
returns table (
  id uuid,
  email text,
  full_name text,
  is_admin boolean,
  status text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  select p.is_admin into caller_is_admin from public.profiles p where p.id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo los administradores pueden listar admins';
  end if;

  return query
    select p.id, u.email::text, p.full_name, p.is_admin, p.status,
           p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.is_admin = true
    order by p.created_at asc;
end;
$$;

grant execute on function public.admin_list_admins() to authenticated;
