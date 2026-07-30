-- ============================================================
-- SECURITY FIX: las vistas admin_v_duplicate_* NO respetaban RLS.
-- En Postgres ≥15 las vistas son por defecto security_invoker=false,
-- lo que permite a usuarios authenticated leerlas saltándose la RLS
-- de la tabla profiles.
--
-- Este parche:
--   1) Recrea las vistas con security_invoker = true → respetan
--      la política "admin reads all profiles" (solo admins ven datos).
--   2) Revoca acceso de las vistas a anon y solo grant a authenticated
--      (que aun así filtrará por RLS gracias al security_invoker).
--
-- Idempotente. Ejecutar UNA VEZ en SQL Editor de Supabase.
-- ============================================================

-- 1) Recrear vista de dispositivos compartidos con security_invoker
drop view if exists public.admin_v_duplicate_devices;
create view public.admin_v_duplicate_devices
  with (security_invoker = true) as
select
  p.device_fingerprint,
  count(*)                                   as account_count,
  array_agg(p.id order by p.created_at)      as user_ids,
  array_agg(u.email order by p.created_at)   as emails,
  min(p.created_at)                          as first_signup,
  max(p.created_at)                          as last_signup
from public.profiles p
left join auth.users u on u.id = p.id
where p.device_fingerprint is not null
  and length(p.device_fingerprint) >= 8
group by p.device_fingerprint
having count(*) > 1
order by count(*) desc, max(p.created_at) desc;

-- 2) Recrear vista de emails normalizados duplicados
drop view if exists public.admin_v_duplicate_emails;
create view public.admin_v_duplicate_emails
  with (security_invoker = true) as
select
  p.email_normalized,
  count(*)                                   as account_count,
  array_agg(p.id order by p.created_at)      as user_ids,
  array_agg(u.email order by p.created_at)   as raw_emails,
  min(p.created_at)                          as first_signup,
  max(p.created_at)                          as last_signup
from public.profiles p
left join auth.users u on u.id = p.id
where p.email_normalized is not null
group by p.email_normalized
having count(*) > 1
order by count(*) desc, max(p.created_at) desc;

-- 3) Revocar accesos amplios y otorgar solo a authenticated.
--    Como las vistas tienen security_invoker=true, RLS de profiles
--    se evalúa por usuario → un cliente común NO ve nada.
revoke all on public.admin_v_duplicate_devices from public, anon;
revoke all on public.admin_v_duplicate_emails  from public, anon;
grant select on public.admin_v_duplicate_devices to authenticated;
grant select on public.admin_v_duplicate_emails  to authenticated;
