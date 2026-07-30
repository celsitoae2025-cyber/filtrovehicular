-- ============================================================
-- Catálogo de consultas — Filtro Vehicular+
-- Corre este script UNA VEZ en el SQL Editor de Supabase.
-- ============================================================

-- 1. Tabla del catálogo
create table if not exists public.consultas_catalog (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  categoria text not null,                    -- "reniec" | "vehiculos" | etc.
  tipo_dato text not null,                    -- "dni" | "placa" | "ruc" | ...
  bot_id text not null,                       -- ID del bot configurado en bots-config.js
  comando text not null,                      -- "/dni {valor}" (con placeholder)
  costo_interno integer not null default 0,   -- créditos que te cuesta en el bot
  precio_venta integer not null,              -- créditos que le cobras al cliente
  plan_minimo_bot text,                       -- "FREE" | "STANDARD" | "GOLD" | etc.
  respuesta_formato jsonb default '{"texto": true, "imagenes": 0, "pdf": false}'::jsonb,
  activa boolean not null default true,
  destacada boolean not null default false,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultas_catalog_activa_cat_idx
  on public.consultas_catalog (activa, categoria, orden);

-- 2. RLS — visitantes anónimos y clientes ven solo las activas, admins ven todo
alter table public.consultas_catalog enable row level security;

-- Lectura pública (anon + authenticated) de consultas activas:
-- los visitantes deben poder previsualizar el catálogo antes de crear cuenta.
drop policy if exists "catalog_select_active" on public.consultas_catalog;
drop policy if exists "catalog_select_public" on public.consultas_catalog;
create policy "catalog_select_public"
  on public.consultas_catalog for select
  to anon, authenticated
  using (activa = true);

drop policy if exists "catalog_admin_all" on public.consultas_catalog;
create policy "catalog_admin_all"
  on public.consultas_catalog for all
  to authenticated
  using ((select is_admin from public.profiles where id = auth.uid()) = true)
  with check ((select is_admin from public.profiles where id = auth.uid()) = true);

-- 3. Las consultas se agregan después según los bots disponibles.
-- Formato de inserción:
--
-- insert into public.consultas_catalog
--   (nombre, descripcion, categoria, tipo_dato, bot_id, comando, costo_interno, precio_venta, plan_minimo_bot, respuesta_formato, orden)
-- values
--   ('Nombre visible',
--    'Descripción del catálogo',
--    'categoria', 'tipo_dato', 'bot_id', '/comando {valor}', 5, 5, 'STANDARD',
--    '{"texto": true, "imagenes": 0, "pdf": false}'::jsonb, 10);
