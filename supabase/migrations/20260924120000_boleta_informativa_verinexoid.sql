-- ============================================================
-- Boleta Informativa — cambia de bot y de comando
--
-- «Boleta Informativa» (Consulta Vehicular) le pedía el /boi a
-- `fuentesdata`. Pasa a pedirle el /boin a `verinexoid`
-- (@verinexoid_bot), que se registró en el bridge en esta misma
-- sesión.
--
-- Es la única fila con ese nombre en el catálogo de producción
-- (comprobado en vivo), y aun así el WHERE va por id, no por
-- nombre ni por comando.
--
-- Para revertirlo:
--   update public.consultas_catalog
--      set bot_id = 'fuentesdata', comando = '/boi {valor}'
--    where id = '1bd941cc-d0ba-4b89-908f-7afeb61baf3b';
-- ============================================================

update public.consultas_catalog
   set bot_id  = 'verinexoid',
       comando = '/boin {valor}'
 where id = '1bd941cc-d0ba-4b89-908f-7afeb61baf3b'
   and comando = '/boi {valor}';
