-- Agregar "Búsqueda por Nombre" al catálogo de Reniec
-- Usa el bot @LainData_Bot (bot_id = 'laindata') con comando /nm
-- Formato del valor: nombres|apellido_paterno|apellido_materno

INSERT INTO public.consultas_catalog
  (nombre, descripcion, categoria, tipo_dato, bot_id, comando, costo_interno, precio_venta, respuesta_formato, activa, orden)
VALUES
  ('Búsqueda por Nombre',
   'Buscar personas por nombre y apellidos en base de datos RENIEC.',
   'reniec', 'texto', 'laindata', '/nm {valor}', 5, 5,
   '{"texto": true, "imagenes": 0}'::jsonb, true, 6);
