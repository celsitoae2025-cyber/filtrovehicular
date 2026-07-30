-- ============================================================
-- Seed v2 — Catálogo "Verifica cualquier placa en segundos"
-- Categoría: filter   |   Bot: @Recup_Sd_bot (bot_id='recupsd')
--
-- Reemplaza por completo las 16 entradas anteriores que quedaron
-- en producción con nombres tipo "REGISTRO DE DOMINIO", etc.
-- Quedan 13 consultas con sus comandos reales y validados.
--
-- IMPORTANTE: corre este script UNA VEZ en Supabase → SQL Editor.
-- ============================================================

begin;

-- 1) Limpiar todas las consultas previas de la categoría 'filter'
delete from public.consultas_catalog where categoria = 'filter';

-- 2) Insertar las 13 consultas correctas
insert into public.consultas_catalog
  (nombre, descripcion, categoria, tipo_dato, bot_id, comando,
   costo_interno, precio_venta, plan_minimo_bot, respuesta_formato, orden, activa)
values
  -- #1 — DNI: propiedades y vehículos del titular
  ('Propiedades y Vehículos por DNI',
   'Lista de propiedades y vehículos registrados a nombre del DNI consultado.',
   'filter', 'dni', 'recupsd', '/sun {valor}',
   3, 3, null,
   '{"texto": true, "pdf": false}'::jsonb,
   10, true),

  -- #2 — DNI: variante alterna (otra base)
  ('Propiedades y Vehículos por DNI V2',
   'Variante alterna (segunda base de datos) de propiedades y vehículos por DNI.',
   'filter', 'dni', 'recupsd', '/sunb {valor}',
   3, 3, null,
   '{"texto": true, "pdf": false}'::jsonb,
   20, true),

  -- #3 — TIVE original (PDF)
  ('TIVE Original PDF',
   'Tarjeta de Identificación Vehicular Electrónica original en PDF.',
   'filter', 'placa', 'recupsd', '/tiv {valor}',
   20, 20, null,
   '{"texto": true, "pdf": true}'::jsonb,
   30, true),

  -- #4 — Consulta vehicular gratis
  ('Consulta Vehicular',
   'Consulta vehicular básica — gratuita.',
   'filter', 'placa', 'recupsd', '/plai {valor}',
   0, 0, null,
   '{"texto": true, "pdf": false}'::jsonb,
   40, true),

  -- #5 — Información por placa
  ('Información por Placa',
   'Información registral del vehículo a partir de la placa.',
   'filter', 'placa', 'recupsd', '/placa {valor}',
   5, 5, null,
   '{"texto": true, "pdf": false}'::jsonb,
   50, true),

  -- #6 — Información por placa V2
  ('Información por Placa V2',
   'Variante alterna de información por placa (segunda base).',
   'filter', 'placa', 'recupsd', '/plab {valor}',
   5, 5, null,
   '{"texto": true, "pdf": false}'::jsonb,
   60, true),

  -- #7 — Leyenda Vehicular PDF (botón del menú /lplaca)
  ('Leyenda Vehicular por placa PDF',
   'Leyenda vehicular completa en PDF.',
   'filter', 'placa', 'recupsd', '/lplaca {valor}',
   10, 10, null,
   '{"texto": true, "pdf": true, "botones": true}'::jsonb,
   70, true),

  -- #8 — Propietarios (botón del menú /lplaca)
  ('Propietarios',
   'Cantidad y datos de los propietarios registrados.',
   'filter', 'placa', 'recupsd', '/lplaca {valor}',
   10, 10, null,
   '{"texto": true, "pdf": true, "botones": true}'::jsonb,
   80, true),

  -- #9 — Cambio de Características (botón del menú /lplaca)
  ('Cambio de Características',
   'Historial de cambios de características técnicas del vehículo.',
   'filter', 'placa', 'recupsd', '/lplaca {valor}',
   10, 10, null,
   '{"texto": true, "pdf": true, "botones": true}'::jsonb,
   90, true),

  -- #10 — Gravámenes y afectaciones (botón del menú /lplaca)
  ('Gravámenes y afectaciones',
   'Gravámenes vigentes y afectaciones registradas sobre el vehículo.',
   'filter', 'placa', 'recupsd', '/lplaca {valor}',
   10, 10, null,
   '{"texto": true, "pdf": true, "botones": true}'::jsonb,
   100, true),

  -- #11 — SOAT vigente
  ('Soat Vehicular',
   'Vigencia y datos del SOAT actual del vehículo.',
   'filter', 'placa', 'recupsd', '/soat {valor}',
   1, 1, null,
   '{"texto": true, "pdf": false}'::jsonb,
   110, true),

  -- #12 — Historial SOAT
  ('Historial de Soat Vehicular',
   'Historial de pólizas SOAT del vehículo.',
   'filter', 'placa', 'recupsd', '/hsoat {valor}',
   10, 10, null,
   '{"texto": true, "pdf": false}'::jsonb,
   120, true),

  -- #13 — Historial SOAT V2  (créditos asumidos = 10; ajustar si es otro valor)
  ('Historial de Soat Vehicular V2',
   'Variante alterna del historial de pólizas SOAT (segunda base).',
   'filter', 'placa', 'recupsd', '/hsoat2 {valor}',
   10, 10, null,                                -- ← AJUSTAR aquí si el costo no es 10
   '{"texto": true, "pdf": false}'::jsonb,
   130, true);

commit;

-- ============================================================
-- Verificación post-ejecución
-- ============================================================
select orden, nombre, comando, tipo_dato, precio_venta as cr, bot_id, activa
from public.consultas_catalog
where categoria = 'filter'
order by orden;
