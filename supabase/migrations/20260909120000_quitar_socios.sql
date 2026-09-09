-- ============================================================
-- QUITAR SOCIOS — se desmonta el sistema de distribuidores
-- ------------------------------------------------------------
-- Decisión del dueño (2026-09-09): no habrá socios. Este archivo
-- deshace por completo `20260817190000_socios.sql`.
--
-- Lo más importante NO es borrar las funciones, es esto:
-- aquella migración le puso una excepción al guardia que impide
-- tocar el saldo de otro perfil, para que las funciones de socio
-- pudieran mover créditos entre cuentas. Mientras esa excepción
-- siga puesta, existe una rendija abierta en el punto más
-- delicado del sistema. Aquí el guardia vuelve a ser lo que era:
-- sin excepciones, sin banderas, sin puertas de servicio.
--
-- Los saldos NO se tocan. Quien tenga créditos se los queda. Los
-- clientes que estaban marcados a nombre de un socio pasan a ser
-- clientes directos del dueño, que es lo que siempre fueron.
-- Los apuntes del historial (`transactions`) se conservan tal
-- cual: son el registro contable y no se reescribe.
-- ============================================================

-- ─── 1. Dejar constancia de lo que había ────────────────────
-- Sale en la salida del despliegue. No cambia nada; sirve para
-- saber si esto llegó a usarse alguna vez.
do $$
declare
  v_socios integer := 0;
  v_clientes integer := 0;
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles'
                and column_name = 'is_socio') then
    execute 'select count(*) from public.profiles where is_socio' into v_socios;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles'
                and column_name = 'socio_id') then
    execute 'select count(*) from public.profiles where socio_id is not null' into v_clientes;
  end if;
  raise notice 'Al desmontar: % socio(s) y % cliente(s) asignado(s).', v_socios, v_clientes;
end $$;


-- ─── 2. El guardia del perfil vuelve a no tener excepciones ─
-- Esta es la corrección de seguridad. El disparador se vuelve a
-- crear SIN la cláusula `when` que lo saltaba cuando la bandera
-- `app.socio_op` valía '1'. A partir de aquí, ninguna función
-- puede pedir permiso para modificar el saldo de otra persona:
-- el guardia corre siempre, para todas las filas.
drop trigger if exists enforce_profile_update on public.profiles;
create trigger enforce_profile_update
  before update on public.profiles
  for each row
  execute function public.enforce_profile_update();


-- ─── 3. Fuera el guardia propio de los campos de socio ──────
drop trigger  if exists enforce_socio_fields on public.profiles;
drop function if exists public.enforce_socio_fields();


-- ─── 4. Fuera las funciones del socio ───────────────────────
drop function if exists public.socio_transferir_creditos(uuid, integer, text);
drop function if exists public.socio_buscar_usuario(text);
drop function if exists public.socio_mis_clientes();
drop function if exists public.socio_mis_movimientos(integer);
drop function if exists public.socio_mi_resumen();
drop function if exists public.es_socio_actual();


-- ─── 5. Fuera las funciones del administrador ───────────────
drop function if exists public.admin_set_socio(uuid, boolean);
drop function if exists public.admin_list_socios();


-- ─── 6. Fuera las marcas del perfil ─────────────────────────
-- El índice se va solo con la columna.
alter table public.profiles drop column if exists socio_id;
alter table public.profiles drop column if exists is_socio;


-- ─── 7. Comprobación final ──────────────────────────────────
-- Si algo de lo anterior no se aplicó, el despliegue falla aquí en
-- vez de dejar el sistema a medias.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles'
                and column_name in ('is_socio', 'socio_id')) then
    raise exception 'Quedaron columnas de socio en profiles';
  end if;

  if exists (select 1 from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and (p.proname like 'socio\_%' or p.proname in ('es_socio_actual', 'admin_set_socio', 'admin_list_socios'))) then
    raise exception 'Quedaron funciones de socio en la base';
  end if;

  -- El guardia tiene que existir y correr sin condiciones.
  if not exists (select 1 from pg_trigger
                  where tgname = 'enforce_profile_update'
                    and tgrelid = 'public.profiles'::regclass
                    and tgqual is null) then
    raise exception 'El guardia enforce_profile_update no quedó restaurado sin excepciones';
  end if;
end $$;
