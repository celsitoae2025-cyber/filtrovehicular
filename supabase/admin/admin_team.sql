-- ============================================================
-- ADMIN TEAM — RPCs para listar y gestionar admins desde el panel
--
-- Reemplaza al "team" mock que vivía en localStorage. Lee admins reales
-- (profiles.is_admin = true) y permite otorgar/revocar el flag por correo.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ===== RPC: listar admins =====
-- Solo accesible para admins. Devuelve perfil + email + last_sign_in_at.
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
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
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


-- ===== RPC: setear el flag is_admin de un usuario por email =====
-- Solo admins pueden ejecutarla. No permite que un admin se quite el rol
-- a sí mismo (evita quedar bloqueados sin admins).
create or replace function public.admin_set_admin_flag(
  target_email text,
  make_admin boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  target_id uuid;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo los administradores pueden cambiar el rol admin';
  end if;

  select id into target_id from auth.users where lower(email) = lower(target_email);
  if target_id is null then
    raise exception 'No se encontró un usuario registrado con ese correo';
  end if;

  -- No permitir auto-revocarse
  if target_id = auth.uid() and make_admin = false then
    raise exception 'No puedes quitarte el rol admin a ti mismo';
  end if;

  update public.profiles
     set is_admin = make_admin,
         updated_at = now()
   where id = target_id;

  return target_id;
end;
$$;

grant execute on function public.admin_set_admin_flag(text, boolean) to authenticated;
