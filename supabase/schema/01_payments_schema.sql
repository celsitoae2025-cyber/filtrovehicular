-- ============================================================
-- Pagos Mercado Pago — schema complementario
-- Ejecutar en Supabase → SQL Editor → Run
-- Es seguro correrlo varias veces (usa IF NOT EXISTS).
-- ============================================================

-- Tabla de pagos registrados por MP (historial + idempotencia)
create table if not exists public.payments_mp (
  id                bigserial primary key,
  payment_id        text unique not null,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  user_email        text not null,
  plan_id           text not null,
  credits           integer not null default 0,
  amount            numeric(10,2) not null,
  status            text not null default 'approved',
  type              text not null, -- 'recarga' | 'suscripcion'
  mp_payer_email    text default '',
  mp_payment_method text default '',
  mp_date_approved  text default '',
  created_at        timestamptz not null default now()
);

create index if not exists idx_payments_mp_user on public.payments_mp(user_id);
create index if not exists idx_payments_mp_email on public.payments_mp(user_email);

-- RLS: solo el dueño del pago puede leerlo; service_role (edge function) tiene acceso total
alter table public.payments_mp enable row level security;

drop policy if exists "user reads own payments" on public.payments_mp;
create policy "user reads own payments"
  on public.payments_mp for select
  using (auth.uid() = user_id);

-- El service_role (que usa la edge function) no requiere policy — lo bypasea por defecto.

-- Agregar 'subscription' al tipo válido de transactions si quieres tipado estricto
-- (por ahora la tabla transactions acepta cualquier string en type; no requiere cambios)
