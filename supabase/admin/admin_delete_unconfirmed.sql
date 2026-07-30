-- ============================================================
-- ADMIN DELETE UNCONFIRMED USERS — borra usuarios cuyo correo
-- nunca fue confirmado, tanto de auth.users como de las tablas
-- públicas que los referencian.
--
-- Reglas de seguridad:
--   1. Solo admins pueden invocarla.
--   2. Solo borra usuarios con email_confirmed_at IS NULL.
--   3. Nunca borra al admin que llama (ni a otros admins).
--   4. Devuelve la cantidad efectivamente borrada.
--
-- Las foreign keys de Supabase suelen tener `on delete cascade`
-- contra auth.users, así que un solo DELETE en auth.users limpia
-- todas las tablas relacionadas. Igual hacemos limpieza explícita
-- en tablas conocidas como defensa en profundidad.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================

create or replace function public.admin_delete_unconfirmed_users(user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_is_admin boolean;
  uid uuid;
  deleted_count integer := 0;
  unconfirmed boolean;
  is_target_admin boolean;
begin
  -- 1) Verificar que el caller es admin
  select p.is_admin into caller_is_admin
    from public.profiles p where p.id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo los administradores pueden eliminar usuarios';
  end if;

  if user_ids is null or array_length(user_ids, 1) is null then
    return 0;
  end if;

  foreach uid in array user_ids loop
    -- Nunca borrarse a uno mismo
    if uid = auth.uid() then continue; end if;

    -- 2) Solo si el email NO está confirmado
    select (u.email_confirmed_at is null) into unconfirmed
      from auth.users u where u.id = uid;
    if not coalesce(unconfirmed, false) then continue; end if;

    -- 3) Nunca borrar otros admins
    select coalesce(p.is_admin, false) into is_target_admin
      from public.profiles p where p.id = uid;
    if coalesce(is_target_admin, false) then continue; end if;

    -- Limpieza explícita de tablas conocidas (idempotente: si la tabla
    -- no existe el bloque exception lo ignora)
    begin delete from public.consultas      where user_id = uid; exception when undefined_table then null; end;
    begin delete from public.transactions   where user_id = uid; exception when undefined_table then null; end;
    begin delete from public.payments_mp    where user_id = uid; exception when undefined_table then null; end;
    begin delete from public.notifications  where user_id = uid; exception when undefined_table then null; end;
    begin delete from public.free_queries   where user_id = uid; exception when undefined_table then null; end;
    begin delete from public.profiles       where id      = uid; exception when undefined_table then null; end;

    -- Borrar el usuario en auth.users (cascade limpia lo que falte)
    delete from auth.users where id = uid;

    deleted_count := deleted_count + 1;
  end loop;

  return deleted_count;
end;
$$;

grant execute on function public.admin_delete_unconfirmed_users(uuid[]) to authenticated;
