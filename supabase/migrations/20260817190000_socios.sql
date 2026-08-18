-- ============================================================
-- SOCIOS — revendedores con saldo propio
-- ------------------------------------------------------------
-- El socio COMPRA créditos al dueño y los revende a sus propios
-- clientes. El dinero solo va del socio hacia el dueño: no hay
-- comisiones que liquidar ni transferencias de vuelta.
--
-- Reglas que sostiene este archivo:
--   · El socio solo puede mover créditos DE SU PROPIO saldo.
--   · Solo ve a los clientes que él cargó (`profiles.socio_id`).
--   · Nadie se hace socio a sí mismo ni se cambia de socio: eso
--     solo lo hace un administrador.
--   · Todo pasa por funciones; no se abre ni una política nueva
--     de lectura sobre `profiles`.
-- ============================================================

-- ─── 1. Marcas en el perfil ─────────────────────────────────
alter table public.profiles
  add column if not exists is_socio boolean not null default false;

-- A qué socio pertenece este cliente. NULL = cliente directo del dueño.
alter table public.profiles
  add column if not exists socio_id uuid references public.profiles(id) on delete set null;

create index if not exists profiles_socio_id_idx on public.profiles (socio_id);


-- ─── 2. Permiso puntual para las funciones del socio ────────
-- El guardia `enforce_profile_update` impide que nadie toque el saldo
-- de otro perfil, y con razón: es lo que impide regalarse créditos.
-- Las funciones de este archivo SÍ tienen que hacerlo, así que el
-- guardia se salta únicamente cuando ellas lo piden con una bandera
-- local a la transacción.
--
-- Se cambia el TRIGGER, no la función: la función es la del guardia
-- de siempre y se queda tal cual está en producción. Un cliente no
-- puede encender la bandera por su cuenta — no hay forma de fijar un
-- parámetro de sesión desde la API, solo desde dentro de estas
-- funciones, y al acabar la transacción se apaga sola.
drop trigger if exists enforce_profile_update on public.profiles;
create trigger enforce_profile_update
  before update on public.profiles
  for each row
  when (coalesce(current_setting('app.socio_op', true), '') <> '1')
  execute function public.enforce_profile_update();


-- ─── 3. Guardia propio: is_socio y socio_id son del dueño ───
create or replace function public.enforce_socio_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Procesos internos, administradores y las funciones de socio pasan.
  if auth.uid() is null
     or public.is_current_user_admin()
     or coalesce(current_setting('app.socio_op', true), '') = '1' then
    return new;
  end if;

  if coalesce(new.is_socio, false) <> coalesce(old.is_socio, false)
     or new.socio_id is distinct from old.socio_id then
    raise exception 'No autorizado a modificar campos de socio';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_socio_fields on public.profiles;
create trigger enforce_socio_fields
  before update on public.profiles
  for each row execute function public.enforce_socio_fields();


-- ─── 4. ¿Quien llama es socio? ──────────────────────────────
create or replace function public.es_socio_actual()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_socio and status = 'active' from public.profiles where id = auth.uid()),
    false
  );
$$;


-- ─── 5. Buscar un usuario por su correo exacto ──────────────
-- Devuelve lo mínimo para identificarlo. Coincidencia EXACTA a
-- propósito: el socio no navega la base de usuarios del dueño, llega
-- con el correo que su cliente le dio.
create or replace function public.socio_buscar_usuario(p_email text)
returns table (
  id uuid,
  email text,
  full_name text,
  credits_balance integer,
  es_mi_cliente boolean,
  disponible boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_socio_actual() then
    raise exception 'Solo los socios pueden buscar clientes';
  end if;

  return query
  select p.id,
         u.email::text,
         p.full_name,
         p.credits_balance,
         (p.socio_id = auth.uid()) as es_mi_cliente,
         -- Libre para este socio: no es admin, no es otro socio y no
         -- pertenece ya a un socio distinto.
         (coalesce(p.is_admin, false) = false
          and coalesce(p.is_socio, false) = false
          and p.id <> auth.uid()
          and (p.socio_id is null or p.socio_id = auth.uid())) as disponible
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(trim(p_email))
  limit 1;
end;
$$;


-- ─── 6. Mis clientes ────────────────────────────────────────
create or replace function public.socio_mis_clientes()
returns table (
  id uuid,
  email text,
  full_name text,
  credits_balance integer,
  entregado integer,
  ultima_entrega timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_socio_actual() then
    raise exception 'Solo los socios pueden ver su cartera';
  end if;

  return query
  select p.id,
         u.email::text,
         p.full_name,
         p.credits_balance,
         coalesce(t.entregado, 0)::integer,
         t.ultima
  from public.profiles p
  join auth.users u on u.id = p.id
  left join (
    select user_id, sum(amount)::integer as entregado, max(created_at) as ultima
    from public.transactions
    where type = 'socio_transfer' and created_by = auth.uid()
    group by user_id
  ) t on t.user_id = p.id
  where p.socio_id = auth.uid()
  order by t.ultima desc nulls last, p.full_name;
end;
$$;


-- ─── 7. Entregar créditos a un cliente ──────────────────────
-- El corazón del asunto. Descuenta del socio y abona al cliente en
-- una sola transacción: o se hacen las dos cosas o ninguna.
create or replace function public.socio_transferir_creditos(
  p_cliente_id uuid,
  p_creditos integer,
  p_nota text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_socio uuid := auth.uid();
  v_saldo integer;
  v_cliente record;
begin
  if not public.es_socio_actual() then
    raise exception 'Solo los socios pueden entregar créditos';
  end if;
  if p_creditos is null or p_creditos <= 0 then
    raise exception 'La cantidad de créditos tiene que ser mayor que cero';
  end if;
  if p_cliente_id = v_socio then
    raise exception 'No puedes entregarte créditos a ti mismo';
  end if;

  -- Se bloquea primero el socio y luego el cliente, siempre en ese
  -- orden: dos entregas a la vez no pueden quedarse trabadas.
  select credits_balance into v_saldo
  from public.profiles where id = v_socio for update;

  select id, is_admin, is_socio, socio_id, status into v_cliente
  from public.profiles where id = p_cliente_id for update;

  if v_cliente.id is null then
    raise exception 'Ese usuario no existe';
  end if;
  if coalesce(v_cliente.is_admin, false) or coalesce(v_cliente.is_socio, false) then
    raise exception 'Ese usuario no puede ser cliente de un socio';
  end if;
  if v_cliente.socio_id is not null and v_cliente.socio_id <> v_socio then
    raise exception 'Ese usuario ya es cliente de otro socio';
  end if;
  if v_saldo < p_creditos then
    raise exception 'No tienes créditos suficientes. Te quedan %', v_saldo;
  end if;

  -- A partir de aquí se tocan saldos: se le avisa al guardia del perfil.
  perform set_config('app.socio_op', '1', true);

  update public.profiles
  set credits_balance = credits_balance - p_creditos,
      updated_at = now()
  where id = v_socio;

  update public.profiles
  set credits_balance = credits_balance + p_creditos,
      socio_id = coalesce(socio_id, v_socio),
      updated_at = now()
  where id = p_cliente_id;

  -- Dos apuntes: el que suma al cliente y el que resta al socio. Así
  -- cada uno ve en su historial exactamente lo que le pasó.
  insert into public.transactions (user_id, type, amount, description, payment_method, created_by)
  values (p_cliente_id, 'socio_transfer', p_creditos,
          coalesce(nullif(trim(p_nota), ''), 'Recarga de tu distribuidor'),
          'socio', v_socio);

  insert into public.transactions (user_id, type, amount, description, payment_method, created_by)
  values (v_socio, 'socio_entrega', -p_creditos,
          'Entrega de créditos a un cliente', 'socio', v_socio);

  perform set_config('app.socio_op', '', true);

  return v_saldo - p_creditos;
end;
$$;


-- ─── 8. Movimientos del socio ───────────────────────────────
create or replace function public.socio_mis_movimientos(p_limite integer default 100)
returns table (
  created_at timestamptz,
  cliente text,
  email text,
  creditos integer,
  descripcion text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_socio_actual() then
    raise exception 'Solo los socios pueden ver sus movimientos';
  end if;

  return query
  select t.created_at,
         p.full_name,
         u.email::text,
         t.amount,
         t.description
  from public.transactions t
  join public.profiles p on p.id = t.user_id
  join auth.users u on u.id = t.user_id
  where t.type = 'socio_transfer' and t.created_by = auth.uid()
  order by t.created_at desc
  limit greatest(1, least(coalesce(p_limite, 100), 500));
end;
$$;


-- ─── 9. Resumen del socio ───────────────────────────────────
create or replace function public.socio_mi_resumen()
returns table (
  saldo integer,
  clientes integer,
  entregado integer,
  entregado_mes integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_socio_actual() then
    raise exception 'Solo los socios pueden ver su resumen';
  end if;

  return query
  select (select credits_balance from public.profiles where id = auth.uid()),
         (select count(*)::integer from public.profiles where socio_id = auth.uid()),
         (select coalesce(sum(amount), 0)::integer from public.transactions
           where type = 'socio_transfer' and created_by = auth.uid()),
         (select coalesce(sum(amount), 0)::integer from public.transactions
           where type = 'socio_transfer' and created_by = auth.uid()
             and created_at >= date_trunc('month', now()));
end;
$$;


-- ─── 10. Lado del administrador ─────────────────────────────
-- Nombrar socio, quitarle el cargo y ver cómo va cada uno.
create or replace function public.admin_set_socio(
  p_user_id uuid,
  p_es_socio boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clientes integer;
begin
  if not public.is_current_user_admin() then
    raise exception 'Solo los administradores pueden nombrar socios';
  end if;

  if p_es_socio = false then
    select count(*) into v_clientes from public.profiles where socio_id = p_user_id;
    if v_clientes > 0 then
      raise exception 'Ese socio todavía tiene % cliente(s). Reasígnalos antes de quitarle el cargo', v_clientes;
    end if;
  end if;

  update public.profiles
  set is_socio = coalesce(p_es_socio, false),
      updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.admin_list_socios()
returns table (
  id uuid,
  email text,
  full_name text,
  credits_balance integer,
  clientes integer,
  entregado integer,
  entregado_mes integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Solo los administradores pueden ver los socios';
  end if;

  return query
  select p.id,
         u.email::text,
         p.full_name,
         p.credits_balance,
         (select count(*)::integer from public.profiles c where c.socio_id = p.id),
         (select coalesce(sum(t.amount), 0)::integer from public.transactions t
           where t.type = 'socio_transfer' and t.created_by = p.id),
         (select coalesce(sum(t.amount), 0)::integer from public.transactions t
           where t.type = 'socio_transfer' and t.created_by = p.id
             and t.created_at >= date_trunc('month', now()))
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.is_socio = true
  order by p.full_name;
end;
$$;


-- ─── 11. Permisos ───────────────────────────────────────────
revoke all on function public.socio_buscar_usuario(text) from public;
revoke all on function public.socio_mis_clientes() from public;
revoke all on function public.socio_transferir_creditos(uuid, integer, text) from public;
revoke all on function public.socio_mis_movimientos(integer) from public;
revoke all on function public.socio_mi_resumen() from public;
revoke all on function public.admin_set_socio(uuid, boolean) from public;
revoke all on function public.admin_list_socios() from public;

grant execute on function public.es_socio_actual() to authenticated;
grant execute on function public.socio_buscar_usuario(text) to authenticated;
grant execute on function public.socio_mis_clientes() to authenticated;
grant execute on function public.socio_transferir_creditos(uuid, integer, text) to authenticated;
grant execute on function public.socio_mis_movimientos(integer) to authenticated;
grant execute on function public.socio_mi_resumen() to authenticated;
grant execute on function public.admin_set_socio(uuid, boolean) to authenticated;
grant execute on function public.admin_list_socios() to authenticated;
