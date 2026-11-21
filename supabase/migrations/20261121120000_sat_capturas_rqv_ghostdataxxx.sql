-- La consulta vehicular SAT Capturas pasa a RQ Orden de captura.
-- @GHOSTDATAXXX_BOT atiende esta consulta con /rqv por placa.
-- Se conserva la misma fila, categoría, orden, precios y formato.
-- Los otros comandos /rqv del catálogo no forman parte de este cambio.

update public.consultas_catalog
   set nombre      = 'RQ Orden de captura',
       descripcion = 'Consulta órdenes de captura vehicular por placa.',
       comando     = '/rqv {valor}',
       bot_id      = 'ghostdataxxx',
       updated_at  = now()
 where id = '07988a62-78e4-43a8-8fae-64d9d1cfb326';
