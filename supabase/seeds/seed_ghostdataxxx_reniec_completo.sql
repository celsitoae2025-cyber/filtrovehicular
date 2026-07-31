-- ============================================================
-- Seed — Agrega "Reniec Datos Completos" al tope del tab Reniec
-- (bot @GHOSTDATAXXX_BOT, bot_id='ghostdataxxx')
--
-- Ya ejecutado directamente en producción vía Supabase CLI.
-- Este archivo documenta el cambio en el repo (idempotente).
-- ============================================================

begin;

delete from public.consultas_catalog
where categoria = 'reniec' and comando = '/dnit {valor}';

insert into public.consultas_catalog
  (nombre, descripcion, categoria, tipo_dato, bot_id, comando,
   costo_interno, precio_venta, plan_minimo_bot, respuesta_formato, orden, activa)
values
  ('Reniec Datos Completos', 'Rostro, firma, huellas y datos en texto via Reniec online.',
   'reniec', 'dni', 'ghostdataxxx', '/dnit {valor}',
   5, 5, null, '{"texto": true, "imagenes": 3, "pdf": false}'::jsonb, 5, true);

commit;

-- ============================================================
-- Verificación post-ejecución
-- ============================================================
select nombre, comando, orden from public.consultas_catalog
where categoria = 'reniec' order by orden;
