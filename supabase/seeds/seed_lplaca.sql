-- ============================================================
-- ⚠️ OBSOLETO — NO EJECUTAR
-- Reemplazado por: supabase/seed_filter_v2.sql  (13 consultas)
-- Se conserva solo como referencia histórica del catálogo inicial
-- de 6 consultas que compartían el comando /lplaca.
-- ============================================================
-- Seed — 6 consultas que comparten el comando /lplaca
-- Bot: @Recup_Sd_bot (bot_id = 'recupsd')
-- Categoria: filter (pestaña "Consultar placa")
--
-- Las 6 devuelven una lista de botones con los PDFs disponibles;
-- el cliente elige y el bot manda el documento correspondiente.
-- ============================================================

insert into public.consultas_catalog
  (nombre, descripcion, categoria, tipo_dato, bot_id, comando,
   costo_interno, precio_venta, plan_minimo_bot, respuesta_formato, orden, activa)
values
  ('Inscripción de vehículo',
   'Primera inscripción de dominio del vehículo en SUNARP.',
   'filter', 'placa', 'recupsd', '/lplaca {valor}',
   5, 5, null,
   '{"texto": true, "pdf": true, "botones": true}'::jsonb,
   20, true),

  ('Número de propietarios',
   'Cantidad y datos de los propietarios registrados.',
   'filter', 'placa', 'recupsd', '/lplaca {valor}',
   5, 5, null,
   '{"texto": true, "pdf": true, "botones": true}'::jsonb,
   30, true),

  ('Cambio de características',
   'Historial de cambios de características del vehículo.',
   'filter', 'placa', 'recupsd', '/lplaca {valor}',
   5, 5, null,
   '{"texto": true, "pdf": true, "botones": true}'::jsonb,
   40, true),

  ('Precio referencial del vehículo',
   'Valor referencial SUNAT del vehículo.',
   'filter', 'placa', 'recupsd', '/lplaca {valor}',
   5, 5, null,
   '{"texto": true, "pdf": true, "botones": true}'::jsonb,
   50, true),

  ('Afectaciones',
   'Afectaciones registradas sobre el vehículo.',
   'filter', 'placa', 'recupsd', '/lplaca {valor}',
   5, 5, null,
   '{"texto": true, "pdf": true, "botones": true}'::jsonb,
   60, true),

  ('Gravámenes',
   'Gravámenes vigentes del vehículo.',
   'filter', 'placa', 'recupsd', '/lplaca {valor}',
   5, 5, null,
   '{"texto": true, "pdf": true, "botones": true}'::jsonb,
   70, true);
