-- ============================================================
-- INCREMENTAL: agrega 3 comandos faltantes de RENIEC del bot
-- @Fuentesdata_bot que no se incluyeron en el seed inicial.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Es idempotente: no inserta duplicados si ya existen.
-- ============================================================

-- Borra primero por (bot_id, comando) para asegurar idempotencia
delete from public.consultas_catalog
where bot_id = 'fuentesdata'
  and comando in ('/c4i {valor}', '/dniv {valor}', '/dnivel {valor}');

insert into public.consultas_catalog
  (nombre, descripcion, categoria, tipo_dato, bot_id, comando,
   costo_interno, precio_venta, plan_minimo_bot, respuesta_formato, orden, activa)
values
  ('Ficha C4 certificado',
   'Genera la ficha C4 certificado en formato imagen o PDF a partir del DNI.',
   'reniec', 'dni', 'fuentesdata', '/c4i {valor}',
   5, 5, null, '{"texto": true, "imagenes": 1, "pdf": true}'::jsonb, 60, true),

  ('DNI digital azul/amarillo',
   'Genera el DNI digital azul/amarillo anverso y reverso en formato imagen.',
   'reniec', 'dni', 'fuentesdata', '/dniv {valor}',
   5, 5, null, '{"texto": true, "imagenes": 2}'::jsonb, 70, true),

  ('DNI electrónico V3.0',
   'Genera el DNI electrónico V3.0 anverso y reverso en formato imagen.',
   'reniec', 'dni', 'fuentesdata', '/dnivel {valor}',
   5, 5, null, '{"texto": true, "imagenes": 2}'::jsonb, 80, true);

-- Reordenar /c4b al final del listado RENIEC
update public.consultas_catalog
set orden = 90
where bot_id = 'fuentesdata' and comando = '/c4b {valor}';

-- Verificar resultado
select comando, nombre, orden
from public.consultas_catalog
where bot_id = 'fuentesdata' and categoria = 'reniec'
order by orden;
