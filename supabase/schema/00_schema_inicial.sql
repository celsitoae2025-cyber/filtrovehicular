-- ============================================================
-- CONSULTIA / FILTRO VEHICULAR+ — Schema inicial
-- Ejecutar en: Supabase → SQL Editor → pegar todo → Run
-- Es seguro ejecutarlo de nuevo: todo usa "if not exists".
-- ============================================================

-- =====  PROFILES  =====
-- Extiende auth.users con datos del negocio
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  phone text,
  credits_balance integer not null default 0,
  is_admin boolean not null default false,
  status text not null default 'active', -- active | suspended
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- =====  Guardia: impedir que usuarios editen campos sensibles  =====
create or replace function public.enforce_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Permitir procesos internos (sin contexto JWT) o administradores.
  if auth.uid() is null or public.is_current_user_admin() then
    new.updated_at := now();
    return new;
  end if;

  -- Solo puedes editar tu propio perfil si no eres admin.
  if auth.uid() <> new.id then
    raise exception 'Solo puedes modificar tu propio perfil';
  end if;

  -- Usuarios no administradores no pueden cambiar campos críticos.
  if new.credits_balance <> old.credits_balance
     or coalesce(new.is_admin, false) <> coalesce(old.is_admin, false)
     or new.status <> old.status
     or new.subscription_tier is distinct from old.subscription_tier
     or new.subscription_plan_id is distinct from old.subscription_plan_id
     or new.subscription_expires_at is distinct from old.subscription_expires_at
     or new.subscription_started_at is distinct from old.subscription_started_at
     or new.has_paid_credits is distinct from old.has_paid_credits
  then
    raise exception 'No autorizado a modificar campos restringidos';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_profile_update on public.profiles;
create trigger enforce_profile_update
  before update on public.profiles
  for each row execute function public.enforce_profile_update();


-- =====  TRIGGER: crear profile al registrarse + 5 créditos bienvenida  =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, credits_balance)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    5  -- créditos de bienvenida
  );

  -- Registra la transacción de bienvenida
  insert into public.transactions (user_id, type, amount, description)
  values (new.id, 'welcome', 5, 'Créditos de bienvenida');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =====  TRANSACTIONS  =====
-- Historial de cambios de créditos: compras, usos, ajustes manuales
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- welcome | purchase | consultation | admin_adjust | refund
  amount integer not null, -- positivo suma, negativo resta
  description text,
  plan_id text,
  payment_method text, -- whatsapp | mercadopago | manual
  reference text, -- id externo (ej. MP payment id)
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

alter table public.transactions enable row level security;

drop policy if exists "read own transactions" on public.transactions;
create policy "read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);


-- =====  CONSULTAS  =====
-- Historial de consultas hechas por los usuarios
create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module text not null, -- reniec | sunarp | sunat | etc.
  type text,
  input text not null,
  cost integer not null default 0,
  status text not null default 'pending', -- pending | success | error
  result_url text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.consultas enable row level security;

drop policy if exists "read own consultas" on public.consultas;
create policy "read own consultas"
  on public.consultas for select
  using (auth.uid() = user_id);


-- =====  FUNCIÓN: ajuste manual de créditos (admin)  =====
-- Se llama desde el panel admin para dar/quitar créditos a un usuario.
-- SECURITY DEFINER permite saltear RLS; valida que quien llama sea admin.
create or replace function public.admin_adjust_credits(
  target_user_id uuid,
  delta integer,
  note text default null,
  method text default 'manual',
  ref text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if coalesce(caller_is_admin, false) = false then
    raise exception 'Solo los administradores pueden ajustar créditos';
  end if;

  update public.profiles
  set credits_balance = credits_balance + delta,
      updated_at = now()
  where id = target_user_id;

  insert into public.transactions (user_id, type, amount, description, payment_method, reference, created_by)
  values (target_user_id, 'admin_adjust', delta, note, method, ref, auth.uid());
end;
$$;


-- =====  FUNCIÓN: descontar créditos al hacer consulta  =====
-- Resta créditos atómicamente; lanza error si no alcanza.
create or replace function public.consume_credits(
  cost integer,
  module_name text,
  q_type text,
  q_input text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  consulta_id uuid;
begin
  select credits_balance into current_balance
  from public.profiles where id = auth.uid()
  for update;

  if current_balance is null then
    raise exception 'Usuario no encontrado';
  end if;

  if current_balance < cost then
    raise exception 'Créditos insuficientes';
  end if;

  update public.profiles
  set credits_balance = credits_balance - cost,
      updated_at = now()
  where id = auth.uid();

  insert into public.consultas (user_id, module, type, input, cost)
  values (auth.uid(), module_name, q_type, q_input, cost)
  returning id into consulta_id;

  insert into public.transactions (user_id, type, amount, description)
  values (auth.uid(), 'consultation', -cost, module_name || ' / ' || q_type);

  return consulta_id;
end;
$$;


-- ============================================================
-- Listo. Ejecutalo una sola vez. Si falla algo, me mandás el error.
-- ============================================================
