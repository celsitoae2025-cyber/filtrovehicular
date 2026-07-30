-- ============================================================
-- FIX — mover /facial de categoria 'vip' a 'facial'
--
-- El comando /facial requiere subir una foto (tipo_dato='foto').
-- La vista 'view-vip' del frontend no tiene dropzone, asi que el
-- boton "Consultar" quedaba deshabilitado para siempre y nunca se
-- podia ejecutar la consulta.
--
-- La vista 'view-facial' SI tiene el dropzone correcto, asi que
-- movemos la consulta alli.
--
-- Idempotente: corre seguro multiples veces.
-- ============================================================

update public.consultas_catalog
   set categoria = 'facial',
       orden    = 10
 where bot_id = 'fuentesdata'
   and comando = '/facial'
   and categoria = 'vip';

-- Verificar resultado
select id, nombre, categoria, comando, tipo_dato
  from public.consultas_catalog
 where comando = '/facial'
   and bot_id = 'fuentesdata';
