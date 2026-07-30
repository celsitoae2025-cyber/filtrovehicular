-- ============================================================
-- ADMIN RLS — políticas para que los administradores puedan
-- leer TODOS los registros de las tablas críticas, sin afectar
-- el acceso normal de los usuarios.
--
-- ⚠️ NOTA SOBRE LA RECURSIÓN INFINITA:
-- La versión anterior de este archivo consultaba `public.profiles`
-- dentro del `using(...)` de las políticas de la propia tabla
-- `profiles`, generando recursión infinita ("infinite recursion
-- detected in policy"). La solución es usar una función
-- SECURITY DEFINER que SALTA la RLS al verificar si el caller es
-- admin. Esa función se usa luego en todas las políticas.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================


-- ============================================================
-- 0) FUNCIÓN HELPER — devuelve true si el usuario actual es admin
--    SECURITY DEFINER → corre con permisos del owner, salta RLS,
--    así no recursiona al consultar `profiles`.
-- ============================================================
create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;


-- ============================================================
-- 1) PROFILES — admin lee todos los perfiles
-- ============================================================
drop policy if exists "admin reads all profiles" on public.profiles;
create policy "admin reads all profiles"
  on public.profiles for select
  to authenticated
  using ( public.is_current_user_admin() );


-- ============================================================
-- 2) TRANSACTIONS — admin lee todas las transacciones
-- ============================================================
drop policy if exists "admin reads all transactions" on public.transactions;
create policy "admin reads all transactions"
  on public.transactions for select
  to authenticated
  using ( public.is_current_user_admin() );


-- ============================================================
-- 3) CONSULTAS — admin lee todas las consultas globales
-- ============================================================
drop policy if exists "admin reads all consultas" on public.consultas;
create policy "admin reads all consultas"
  on public.consultas for select
  to authenticated
  using ( public.is_current_user_admin() );


-- ============================================================
-- 4) PAYMENTS_MP — admin lee todos los pagos de Mercado Pago
-- ============================================================
drop policy if exists "admin reads all payments_mp" on public.payments_mp;
create policy "admin reads all payments_mp"
  on public.payments_mp for select
  to authenticated
  using ( public.is_current_user_admin() );


-- ============================================================
-- 5) BONUS — permitir UPDATE de status en profiles para admins
-- (necesario para el botón Suspender/Reactivar usuario)
-- ============================================================
drop policy if exists "admin updates profiles" on public.profiles;
create policy "admin updates profiles"
  on public.profiles for update
  to authenticated
  using ( public.is_current_user_admin() )
  with check ( public.is_current_user_admin() );


-- ============================================================
-- VERIFICACIÓN — corre estos SELECTs como admin para confirmar
-- ============================================================
-- select public.is_current_user_admin();      -- debería devolver true si eres admin
-- select count(*) from public.profiles;       -- el total real
-- select count(*) from public.transactions;   -- el total real
-- select count(*) from public.consultas;      -- el total real
-- select count(*) from public.payments_mp;    -- el total real
