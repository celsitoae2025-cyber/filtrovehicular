-- ============================================================
-- ADMIN DELETE USER — borra UN usuario por ID, con todas
-- las protecciones de seguridad. Equivalente a la versión "batch"
-- pero válida para usuarios CONFIRMADOS también.
--
-- Reglas de seguridad:
--   1. Solo admins pueden invocarla.
--   2. NUNCA se borra a sí mismo.
--   3. NUNCA borra a otro administrador.
--   4. Limpia tablas relacionadas (consultas, transactions,
--      payments_mp, notifications, free_queries, profiles).
--   5. Borra de auth.users al final (cascade limpia el resto).
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================

create or replace function public.admin_delete_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_is_admin boolean;
  is_target_admin boolean;
begin
  -- 1) Verificar que el caller es admin
  select p.is_admin into caller_is_admin
    from public.profiles p where p.id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo los administradores pueden eliminar usuarios';
  end if;

  if target_user_id is null then
    return false;
  end if;

  -- 2) No se puede eliminar a sí mismo
  if target_user_id = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta';
  end if;

  -- 3) No se puede eliminar a otro admin
  select coalesce(p.is_admin, false) into is_target_admin
    from public.profiles p where p.id = target_user_id;
  if coalesce(is_target_admin, false) then
    raise exception 'No puedes eliminar a otro administrador';
  end if;

  -- 4) Limpieza explícita de tablas conocidas (defensa en profundidad)
  begin delete from public.consultas      where user_id = target_user_id; exception when undefined_table then null; end;
  begin delete from public.transactions   where user_id = target_user_id; exception when undefined_table then null; end;
  begin delete from public.payments_mp    where user_id = target_user_id; exception when undefined_table then null; end;
  begin delete from public.notifications  where user_id = target_user_id; exception when undefined_table then null; end;
  begin delete from public.free_queries   where user_id = target_user_id; exception when undefined_table then null; end;
  begin delete from public.profiles       where id      = target_user_id; exception when undefined_table then null; end;

  -- 5) Borrar el usuario de auth.users (cascade limpia lo que falte)
  delete from auth.users where id = target_user_id;

  return true;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;
