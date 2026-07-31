-- ============================================================
-- Seed — Consolida "Extras" en un solo tab al final del sidebar
-- (bot @GHOSTDATAXXX_BOT, bot_id='ghostdataxxx')
--
-- El sidebar ya NO tiene tabs separados de Estudios, Seeker, MTC
-- ni Migraciones/Internacional — todo su contenido se funde en un
-- único tab "Extras" (categoria='extras'), que además ahora suma
-- MTPE, SIS Online y Essalud (antes descartados por falta de tab).
--
-- No toca reniec/familiares/telefonia/sunarp/sunat/financiero/delitos
-- (ya poblados por seed_ghostdataxxx.sql) ni vehiculos/filter/premium.
--
-- IMPORTANTE: corre este script UNA VEZ en Supabase → SQL Editor.
-- ============================================================

begin;

-- 1) Limpiar las categorías que ya no tienen tab propio en el sidebar.
delete from public.consultas_catalog
where categoria in ('estudios', 'seeker', 'mtc', 'migraciones', 'extras');

-- 2) Insertar el catálogo consolidado de "Extras".
insert into public.consultas_catalog
  (nombre, descripcion, categoria, tipo_dato, bot_id, comando,
   costo_interno, precio_venta, plan_minimo_bot, respuesta_formato, orden, activa)
values

('Migraciones DNI PDF', 'Datos migraciones via Reniec online.',
 'extras', 'dni', 'ghostdataxxx', '/migra {valor}',
 30, 30, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

('Migraciones por CE PDF', 'Datos migraciones via Reniec online.',
 'extras', 'texto', 'ghostdataxxx', '/migrace {valor}',
 30, 30, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

('Minedu Online PDF', 'Datos certificado MINEDU online.',
 'extras', 'dni', 'ghostdataxxx', '/minedu {valor}',
 25, 25, null, '{"texto": true, "pdf": true}'::jsonb, 30, true),

('MTC Licencia PDF', 'Datos certificado MTC online.',
 'extras', 'dni', 'ghostdataxxx', '/mtc {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 40, true),

('MTPE Certificado Joven PDF', 'Datos certificado MTPE online.',
 'extras', 'dni', 'ghostdataxxx', '/cerjov {valor}',
 10, 10, null, '{"texto": true, "pdf": true}'::jsonb, 50, true),

('MTPE Certificado Adulto PDF', 'Datos certificado MTPE online.',
 'extras', 'dni', 'ghostdataxxx', '/ceradu {valor}',
 10, 10, null, '{"texto": true, "pdf": true}'::jsonb, 60, true),

('Consulta Sunedu', 'Datos via Sunedu online.',
 'extras', 'dni', 'ghostdataxxx', '/sunedupdf {valor}',
 10, 10, null, '{"texto": true, "pdf": true}'::jsonb, 70, true),

('Búsqueda por Correo (DNI)', 'Datos via Meta Data DataBase.',
 'extras', 'dni', 'ghostdataxxx', '/cor {valor}',
 3, 3, null, '{"texto": true, "pdf": false}'::jsonb, 80, true),

('Búsqueda por Correo (Email)', 'Datos via Meta Data DataBase.',
 'extras', 'texto', 'ghostdataxxx', '/cor {valor}',
 3, 3, null, '{"texto": true, "pdf": false}'::jsonb, 90, true),

('SIS Online', 'Datos via SIS online.',
 'extras', 'dni', 'ghostdataxxx', '/sis {valor}',
 3, 3, null, '{"texto": true, "pdf": false}'::jsonb, 100, true),

('Essalud', 'Datos via ESSALUD online.',
 'extras', 'dni', 'ghostdataxxx', '/essa2 {valor}',
 3, 3, null, '{"texto": true, "pdf": false}'::jsonb, 110, true);

commit;

-- ============================================================
-- Verificación post-ejecución
-- ============================================================
select categoria, count(*) as consultas, bool_and(bot_id = 'ghostdataxxx') as todas_ghostdataxxx
from public.consultas_catalog
where categoria in ('estudios', 'seeker', 'mtc', 'migraciones', 'extras')
group by categoria
order by categoria;
