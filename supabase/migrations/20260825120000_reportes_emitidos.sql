-- ============================================================
-- Reportes emitidos — para que el QR del PDF sirva de algo
--
-- Un QR solo vale si al escanearlo alguien comprueba, CONTRA NOSOTROS,
-- que ese documento salió de aquí. Sin esto sería un adorno: un cuadrado
-- que abre una página que no sabe nada del papel que tienes en la mano.
--
-- Se guarda lo mínimo para poder confirmarlo: el folio impreso, la placa,
-- cuándo se emitió y el veredicto que llevaba. Nada del contenido del
-- reporte — quien verifica no tiene por qué ver las deudas de nadie.
--
-- CÓMO SE CONSULTA
-- No se expone la tabla. Con una política de lectura abierta, cualquiera
-- pediría la tabla entera y se llevaría todas las placas consultadas por
-- todos los clientes. Se expone UNA función que devuelve una sola fila y
-- solo si aciertas el folio completo.
-- ============================================================

create table if not exists public.reportes_emitidos (
  folio       text primary key,
  placa       text not null,
  emitido_at  timestamptz not null default now(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  veredicto   text
);

create index if not exists reportes_emitidos_user_idx
  on public.reportes_emitidos (user_id, emitido_at desc);

alter table public.reportes_emitidos enable row level security;

-- Cada quien inserta lo suyo, y solo lo suyo.
drop policy if exists "insertar reporte propio" on public.reportes_emitidos;
create policy "insertar reporte propio"
  on public.reportes_emitidos for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Y lee lo suyo. Nadie lee la tabla de otro: para verificar está la
-- función de abajo, que no permite listar.
drop policy if exists "leer reportes propios" on public.reportes_emitidos;
create policy "leer reportes propios"
  on public.reportes_emitidos for select
  to authenticated
  using (auth.uid() = user_id);

-- ── La verificación pública ──────────────────────────────────────────
-- Devuelve una fila o ninguna. No acepta patrones ni listados: o traes el
-- folio entero o no hay nada que ver.
create or replace function public.verificar_reporte(p_folio text)
returns table (folio text, placa text, emitido_at timestamptz, veredicto text)
language sql
security definer
set search_path = public
stable
as $$
  select r.folio, r.placa, r.emitido_at, r.veredicto
    from public.reportes_emitidos r
   where r.folio = upper(trim(p_folio))
   limit 1;
$$;

revoke all on function public.verificar_reporte(text) from public;
grant execute on function public.verificar_reporte(text) to anon, authenticated;
