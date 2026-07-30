-- ============================================================
-- FIX CRÍTICO DE SEGURIDAD — increment_credits abierta a anon
-- ============================================================
-- Fecha: 2026-06-12
--
-- PROBLEMA:
--   public.increment_credits(uuid, integer) es SECURITY DEFINER y suma
--   créditos a cualquier user_id sin validar al invocante. Se creó sin
--   un REVOKE de PUBLIC, por lo que conservó el EXECUTE por defecto de
--   PostgreSQL hacia los roles `anon` y `authenticated`.
--
--   Esto permitía que CUALQUIERA (con la anon key pública incrustada en
--   el frontend) se acreditara créditos ilimitados sin pagar:
--     POST /rest/v1/rpc/increment_credits
--     { "p_user_id": "<su propio id>", "p_amount": 999999 }
--   → HTTP 204, saldo acreditado. Bypass total de la pasarela de pago.
--
-- SOLUCIÓN:
--   Revocar EXECUTE de public/anon/authenticated. Solo service_role
--   (que usa el webhook de Mercado Pago) debe poder ejecutarla.
--   service_role bypassa RLS y grants, así que el webhook no se ve
--   afectado.
--
-- Ejecutar en: Supabase → SQL Editor → Run. Idempotente.
-- ============================================================

revoke all on function public.increment_credits(uuid, integer) from public;
revoke all on function public.increment_credits(uuid, integer) from anon;
revoke all on function public.increment_credits(uuid, integer) from authenticated;
grant execute on function public.increment_credits(uuid, integer) to service_role;

-- ============================================================
-- AUDITORÍA: lista las funciones SECURITY DEFINER que TODAVÍA son
-- ejecutables por anon o authenticated, para revisar que ninguna otra
-- regale saldo/suscripción sin validación interna. Revisa el resultado
-- tras aplicar el fix: increment_credits NO debe aparecer para 'anon'.
-- ============================================================
select
  p.proname                                   as funcion,
  pg_get_function_identity_arguments(p.oid)   as args,
  r.rolname                                    as rol_con_execute
from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral (values ('anon'), ('authenticated')) as roles(rolname)
  join pg_roles r on r.rolname = roles.rolname
where n.nspname = 'public'
  and p.prosecdef = true
  and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
order by p.proname, r.rolname;
