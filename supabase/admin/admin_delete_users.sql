-- ============================================================
-- ADMIN DELETE USERS — RPC genérica para borrar cualquier
-- conjunto de usuarios desde el panel admin, sin importar si
-- confirmaron email o no.
--
-- Usada por los filtros:
--   - 'inactive'           (no pagó ni consultó nunca)
--   - 'no_login_30d'       (sin login hace 30+ días)
--   - 'has_credits_no_use' (tiene saldo, no consultó)
--
-- Reglas de seguridad:
--   1. Solo admins pueden invocarla (verificación en runtime).
--   2. Nunca borra al admin que llama (auth.uid()).
--   3. Nunca borra a OTROS administradores.
--   4. Devuelve la cantidad efectivamente borrada.
--
-- Mantiene en paralelo la RPC `admin_delete_unconfirmed_users`
-- que sigue siendo más estricta (solo emails no confirmados),
-- como protección extra para ese caso específico.
--
-- Las foreign keys de Supabase suelen tener `on delete cascade`
-- contra auth.users, así que un solo DELETE en auth.users limpia
-- todas las tablas relacionadas. Igual hacemos limpieza explícita
-- en tablas conocidas como defensa en profundidad.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================

create or replace function public.admin_delete_users(user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_is_admin boolean;
  uid uuid;
  deleted_count integer := 0;
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
    -- 2) Nunca borrarse a uno mismo
    if uid = auth.uid() then continue; end if;

    -- 3) Nunca borrar otros admins
    select coalesce(p.is_admin, false) into is_target_admin
      from public.profiles p where p.id = uid;
    if coalesce(is_target_admin, false) then continue; end if;

    -- Limpieza explícita de tablas conocidas (idempotente: si la tabla
    -- no existe el bloque exception lo ignora).
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

grant execute on function public.admin_delete_users(uuid[]) to authenticated;
