-- ============================================================
-- increment_credits — Incremento atómico de créditos
-- Evita race conditions del patrón read-then-write en el webhook.
-- Ejecutar en Supabase → SQL Editor → Run
-- Es seguro correrlo varias veces (usa CREATE OR REPLACE).
-- ============================================================

create or replace function public.increment_credits(
  p_user_id uuid,
  p_amount  integer
)
returns void
language sql
security definer
as $$
  update public.profiles
  set credits_balance = coalesce(credits_balance, 0) + p_amount,
      updated_at      = now()
  where id = p_user_id;
$$;

-- ============================================================
-- SEGURIDAD (CRÍTICO):
-- Esta función es SECURITY DEFINER y acredita saldo a un user_id
-- arbitrario SIN validar quién la invoca. SOLO debe llamarla el
-- webhook de Mercado Pago, que usa la SERVICE_ROLE key.
--
-- Por defecto PostgreSQL otorga EXECUTE a PUBLIC (incluye los roles
-- `anon` y `authenticated`), lo que permitía que cualquiera con la
-- clave pública del frontend se regalara créditos llamando a
-- /rest/v1/rpc/increment_credits. Revocamos ese acceso.
-- (service_role bypassa estos grants, así el webhook sigue funcionando.)
-- ============================================================
revoke all on function public.increment_credits(uuid, integer) from public;
revoke all on function public.increment_credits(uuid, integer) from anon;
revoke all on function public.increment_credits(uuid, integer) from authenticated;
grant execute on function public.increment_credits(uuid, integer) to service_role;
