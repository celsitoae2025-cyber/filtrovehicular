-- ============================================================
-- RLS para que cada usuario pueda leer sus propias transacciones
-- Corre UNA VEZ en el SQL Editor de Supabase.
-- ============================================================

-- Habilita RLS (idempotente — no rompe si ya estaba)
alter table public.transactions enable row level security;

-- Política SELECT: solo ves tus propias transacciones
drop policy if exists "tx_select_own" on public.transactions;
create policy "tx_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

-- No damos INSERT / UPDATE / DELETE directo al usuario.
-- Las escrituras siguen pasando por las RPCs del admin (admin_adjust_credits)
-- o del webhook de Mercado Pago (que corre con service_role).
