-- ============================================================
-- ADMIN AUDIT — Tabla y RPCs para registrar acciones del panel
-- administrativo de forma global y persistente.
--
-- Reemplaza al "audit" que vivía en localStorage del navegador
-- del admin (que no era global ni sobrevivía a limpiezas de caché).
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================

create table if not exists public.admin_audit (
  id          bigserial primary key,
  admin_id    uuid not null references auth.users(id) on delete set null,
  admin_name  text,
  admin_email text,
  action      text not null,           -- ej: user.add, recarga.create, mp.reconcile, login
  target      text,                    -- email del usuario afectado, mp_id, etc
  meta        text,                    -- detalle libre legible por humanos
  ip          text,                    -- opcional, si lo recoge el cliente
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_created_idx
  on public.admin_audit (created_at desc);
create index if not exists admin_audit_action_idx
  on public.admin_audit (action);

alter table public.admin_audit enable row level security;

-- Solo admins pueden leer la auditoría
drop policy if exists "audit_select_admin" on public.admin_audit;
create policy "audit_select_admin"
  on public.admin_audit for select
  to authenticated
  using ((select is_admin from public.profiles where id = auth.uid()) = true);


-- ===== RPC: registrar una acción =====
-- Llamada desde el panel admin tras cualquier operación.
-- Verifica que el caller sea admin y rellena admin_name/admin_email.
create or replace function public.log_admin_action(
  action_in text,
  target_in text default null,
  meta_in text default null,
  ip_in text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  caller_name text;
  caller_email text;
  new_id bigint;
begin
  select p.is_admin, p.full_name, u.email
    into caller_is_admin, caller_name, caller_email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid();

  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo admins pueden registrar acciones';
  end if;

  insert into public.admin_audit (admin_id, admin_name, admin_email, action, target, meta, ip)
  values (auth.uid(), coalesce(caller_name, caller_email), caller_email, action_in, target_in, meta_in, ip_in)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.log_admin_action(text, text, text, text) to authenticated;
