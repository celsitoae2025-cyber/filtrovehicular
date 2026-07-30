-- ============================================================
-- GATING DE CONSULTAS POR SUSCRIPCION
--
-- Agrega la columna `requires_subscription` al catalogo de consultas
-- y marca como gated las consultas vehiculares premium:
--   - Leyenda vehicular
--   - Cambio de caracteristicas
--   - Gravamenes y afectaciones
--   - Propietarios
--
-- Las consultas NO marcadas (SOAT, Consulta vehicular, etc.) se
-- ejecutan normal con creditos (incluidos los 5 de regalo).
--
-- Idempotente: se puede correr varias veces sin problema.
-- ============================================================

-- 1) Columna nueva (default false = todas se ejecutan normal)
alter table public.consultas_catalog
  add column if not exists requires_subscription boolean not null default false;

-- 2) Reset (por si se corre de nuevo y se cambiaron nombres)
update public.consultas_catalog
set requires_subscription = false
where requires_subscription = true;

-- 3) Marcar las 4 consultas que requieren plan
--    Match por LOWER(nombre) ignorando acentos via unaccent si existe.
--    Si tu DB no tiene unaccent, igual los patrones cubren con/sin tilde.
update public.consultas_catalog
set requires_subscription = true
where lower(nombre) in (
  'leyenda vehicular',
  'cambio de caracteristicas',
  'cambio de características',
  'gravamenes y afectaciones',
  'gravámenes y afectaciones',
  'propietarios'
);

-- 4) Verificacion: mostrar el listado actualizado de la categoria vehiculos
select id, nombre, comando, precio_venta, requires_subscription
from public.consultas_catalog
where categoria = 'vehiculos'
order by requires_subscription, nombre;
