-- ============================================================
-- ANTI-ABUSO DE CUENTAS MÚLTIPLES
-- Bloquea / penaliza cuentas que:
--   1) Usan el mismo dispositivo (browser fingerprint duplicado)
--   2) Usan dominios de correo descartables (mailinator, tempmail, etc.)
--   3) Usan Gmail con +alias o puntos para crear "muchas" cuentas con
--      el mismo correo real (ej. juan@gmail.com == j.u.an+1@gmail.com)
--
-- Cuando se detecta abuso → la cuenta se crea, pero con 0 créditos
-- de bienvenida en vez de 5, y queda marcada en signup_block_reason
-- para que el admin pueda revisar.
--
-- Idempotente: se puede ejecutar varias veces.
-- ============================================================

-- =====  1) COLUMNAS NUEVAS EN profiles  =====
alter table public.profiles
  add column if not exists device_fingerprint text,
  add column if not exists email_normalized   text,
  add column if not exists signup_ip          inet,
  add column if not exists signup_block_reason text,
  add column if not exists signup_user_agent  text;

-- Índices para detección rápida de duplicados
create index if not exists idx_profiles_device_fingerprint
  on public.profiles(device_fingerprint)
  where device_fingerprint is not null;

create index if not exists idx_profiles_email_normalized
  on public.profiles(email_normalized)
  where email_normalized is not null;

create index if not exists idx_profiles_signup_ip
  on public.profiles(signup_ip)
  where signup_ip is not null;


-- =====  2) TABLA: dominios de correo descartables  =====
create table if not exists public.disposable_email_domains (
  domain text primary key,
  added_at timestamptz not null default now(),
  source text default 'manual'
);

-- Seed inicial (lista corta — los más usados en Perú/LATAM)
insert into public.disposable_email_domains (domain, source) values
  ('mailinator.com',     'seed'),
  ('mailinator.net',     'seed'),
  ('mailinator.org',     'seed'),
  ('tempmail.com',       'seed'),
  ('temp-mail.org',      'seed'),
  ('temp-mail.io',       'seed'),
  ('10minutemail.com',   'seed'),
  ('10minutemail.net',   'seed'),
  ('guerrillamail.com',  'seed'),
  ('guerrillamail.net',  'seed'),
  ('guerrillamail.org',  'seed'),
  ('sharklasers.com',    'seed'),
  ('grr.la',             'seed'),
  ('throwaway.email',    'seed'),
  ('throwawaymail.com',  'seed'),
  ('yopmail.com',        'seed'),
  ('yopmail.net',        'seed'),
  ('yopmail.fr',         'seed'),
  ('mohmal.com',         'seed'),
  ('getnada.com',        'seed'),
  ('nada.email',         'seed'),
  ('dispostable.com',    'seed'),
  ('fakeinbox.com',      'seed'),
  ('trashmail.com',      'seed'),
  ('trashmail.net',      'seed'),
  ('mailcatch.com',      'seed'),
  ('inboxalias.com',     'seed'),
  ('emailondeck.com',    'seed'),
  ('mintemail.com',      'seed'),
  ('moakt.com',          'seed'),
  ('tmail.ws',           'seed'),
  ('tmpmail.org',        'seed'),
  ('tmpmail.net',        'seed'),
  ('tmpeml.com',         'seed'),
  ('emlhub.com',         'seed'),
  ('emltmp.com',         'seed'),
  ('mailtemp.info',      'seed'),
  ('mail-temp.com',      'seed'),
  ('spambox.us',         'seed'),
  ('spamgourmet.com',    'seed'),
  ('maildrop.cc',        'seed'),
  ('mytemp.email',       'seed'),
  ('burnermail.io',      'seed'),
  ('33mail.com',         'seed'),
  ('mintemail.com',      'seed')
on conflict (domain) do nothing;

-- RLS: solo admins pueden ver/editar la lista
alter table public.disposable_email_domains enable row level security;

drop policy if exists "admin manage disposable domains" on public.disposable_email_domains;
create policy "admin manage disposable domains"
  on public.disposable_email_domains for all
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and is_admin = true)
  );


-- =====  3) FUNCIÓN: normalizar email  =====
-- Convierte:
--   "Juan.Perez+promo@Gmail.com"  →  "juanperez@gmail.com"
--   "MARIA+1@hotmail.com"         →  "maria@hotmail.com"
-- Reglas:
--   - Lowercase total
--   - Remueve TODO lo que viene después de "+" en la parte local
--   - Si dominio es gmail.com o googlemail.com: remueve también puntos
-- ============================================================
create or replace function public.normalize_email(p_email text)
returns text
language plpgsql
immutable
as $$
declare
  v_email     text;
  v_local     text;
  v_domain    text;
  v_at_pos    int;
  v_plus_pos  int;
begin
  if p_email is null then return null; end if;

  v_email  := lower(trim(p_email));
  v_at_pos := position('@' in v_email);
  if v_at_pos = 0 then return v_email; end if;

  v_local  := substring(v_email from 1 for v_at_pos - 1);
  v_domain := substring(v_email from v_at_pos + 1);

  -- Remover +alias
  v_plus_pos := position('+' in v_local);
  if v_plus_pos > 0 then
    v_local := substring(v_local from 1 for v_plus_pos - 1);
  end if;

  -- Si gmail / googlemail → quitar puntos
  if v_domain in ('gmail.com', 'googlemail.com') then
    v_local  := replace(v_local, '.', '');
    v_domain := 'gmail.com';
  end if;

  return v_local || '@' || v_domain;
end;
$$;


-- =====  4) FUNCIÓN: verificar si un dominio es descartable  =====
create or replace function public.is_disposable_email(p_email text)
returns boolean
language plpgsql
stable
as $$
declare
  v_domain text;
  v_at_pos int;
  v_found  boolean;
begin
  if p_email is null then return false; end if;
  v_at_pos := position('@' in p_email);
  if v_at_pos = 0 then return false; end if;
  v_domain := lower(substring(p_email from v_at_pos + 1));

  select exists (
    select 1 from public.disposable_email_domains where domain = v_domain
  ) into v_found;

  return v_found;
end;
$$;


-- =====  5) TRIGGER MEJORADO: handle_new_user con anti-abuso  =====
-- Reemplaza el trigger original. Detecta:
--   - email descartable          → 0 créditos, block_reason='disposable_email'
--   - email_normalized duplicado → 0 créditos, block_reason='duplicate_email'
--   - device_fingerprint dup.    → 0 créditos, block_reason='duplicate_device'
-- Si NO hay abuso → 5 créditos de bienvenida (comportamiento normal).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_norm  text;
  v_fingerprint text;
  v_signup_ip   inet;
  v_user_agent  text;
  v_credits     integer := 5;
  v_block       text    := null;
  v_dup_email   boolean := false;
  v_dup_device  boolean := false;
  v_disposable  boolean := false;
begin
  -- Datos enviados desde el cliente vía user_metadata
  v_email_norm  := public.normalize_email(new.email);
  v_fingerprint := nullif(trim(new.raw_user_meta_data->>'device_fingerprint'), '');
  v_user_agent  := nullif(trim(new.raw_user_meta_data->>'user_agent'), '');

  begin
    v_signup_ip := nullif(trim(new.raw_user_meta_data->>'signup_ip'), '')::inet;
  exception when others then
    v_signup_ip := null;
  end;

  -- 1) Email descartable
  v_disposable := public.is_disposable_email(new.email);
  if v_disposable then
    v_credits := 0;
    v_block   := 'disposable_email';
  end if;

  -- 2) Email normalizado duplicado (Gmail+alias / puntos / variaciones)
  if v_block is null and v_email_norm is not null then
    select exists (
      select 1 from public.profiles
      where email_normalized = v_email_norm
        and id <> new.id
    ) into v_dup_email;
    if v_dup_email then
      v_credits := 0;
      v_block   := 'duplicate_email';
    end if;
  end if;

  -- 3) Dispositivo duplicado (mismo browser fingerprint que otra cuenta)
  if v_block is null and v_fingerprint is not null and length(v_fingerprint) >= 8 then
    select exists (
      select 1 from public.profiles
      where device_fingerprint = v_fingerprint
        and id <> new.id
    ) into v_dup_device;
    if v_dup_device then
      v_credits := 0;
      v_block   := 'duplicate_device';
    end if;
  end if;

  -- Crear el profile con los créditos calculados
  insert into public.profiles (
    id, full_name, phone, credits_balance,
    device_fingerprint, email_normalized,
    signup_ip, signup_user_agent, signup_block_reason
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    v_credits,
    v_fingerprint,
    v_email_norm,
    v_signup_ip,
    v_user_agent,
    v_block
  );

  -- Registrar transacción solo si recibió créditos
  if v_credits > 0 then
    insert into public.transactions (user_id, type, amount, description)
    values (new.id, 'welcome', v_credits, 'Créditos de bienvenida');
  end if;

  return new;
end;
$$;


-- =====  6) BACKFILL: poblar email_normalized en cuentas existentes  =====
-- Una sola vez. Después el trigger lo hace automático.
update public.profiles p
set email_normalized = public.normalize_email(u.email)
from auth.users u
where p.id = u.id
  and p.email_normalized is null;


-- =====  7) VISTA: cuentas duplicadas detectadas (para panel admin)  =====
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


-- =====  8) FUNCIÓN admin: contar cuentas sospechosas  =====
create or replace function public.admin_signup_abuse_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  v_disposable    integer;
  v_dup_email     integer;
  v_dup_device    integer;
  v_total_blocked integer;
begin
  select coalesce(is_admin, false) into caller_is_admin
  from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Solo admins';
  end if;

  select count(*) into v_disposable
    from public.profiles where signup_block_reason = 'disposable_email';
  select count(*) into v_dup_email
    from public.profiles where signup_block_reason = 'duplicate_email';
  select count(*) into v_dup_device
    from public.profiles where signup_block_reason = 'duplicate_device';

  v_total_blocked := v_disposable + v_dup_email + v_dup_device;

  return json_build_object(
    'disposable_email', v_disposable,
    'duplicate_email',  v_dup_email,
    'duplicate_device', v_dup_device,
    'total_blocked',    v_total_blocked
  );
end;
$$;
