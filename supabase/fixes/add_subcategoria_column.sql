-- Añade columna subcategoria a consultas_catalog (idempotente)
alter table public.consultas_catalog
  add column if not exists subcategoria text default null;
