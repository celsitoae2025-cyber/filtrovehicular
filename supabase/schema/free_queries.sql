-- ============================================================
-- Consultas gratis — cada usuario registrado puede hacer hasta 2
-- consultas gratis (placa, SOAT o licencia). Después paga con créditos.
-- Corre UNA VEZ en el SQL Editor de Supabase.
-- ============================================================

-- 1. Columna contador en profiles
alter table public.profiles
  add column if not exists free_queries_used integer not null default 0;

-- 2. RPC para incrementar el contador desde la edge function
--    La edge function corre con service_role, pero exponemos esta
--    función para auditoría y para validar el tope atómicamente.
create or replace function public.increment_free_queries(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  new_count integer;
begin
  select free_queries_used into current_count
  from public.profiles
  where id = target_user_id
  for update;

  if current_count is null then
    raise exception 'Perfil no encontrado';
  end if;

  if current_count >= 2 then
    raise exception 'Límite de consultas gratis alcanzado';
  end if;

  update public.profiles
     set free_queries_used = current_count + 1
   where id = target_user_id
   returning free_queries_used into new_count;

  return new_count;
end;
$$;

grant execute on function public.increment_free_queries(uuid) to authenticated;
