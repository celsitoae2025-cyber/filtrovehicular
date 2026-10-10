-- Saved plates are opt-in and private to their owner. No lookup or charge is
-- triggered by inserting a row here.
create table if not exists public.saved_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plate text not null check (plate ~ '^[A-Z0-9]{5,8}$'),
  alias text not null default '' check (char_length(alias) <= 50),
  created_at timestamptz not null default now(),
  unique (user_id, plate)
);

create index if not exists saved_vehicles_owner_created_idx
  on public.saved_vehicles (user_id, created_at desc);

alter table public.saved_vehicles enable row level security;
grant select, insert, delete on public.saved_vehicles to authenticated;

create policy "saved vehicles: owner reads"
  on public.saved_vehicles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "saved vehicles: owner inserts"
  on public.saved_vehicles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "saved vehicles: owner deletes"
  on public.saved_vehicles for delete to authenticated
  using ((select auth.uid()) = user_id);
