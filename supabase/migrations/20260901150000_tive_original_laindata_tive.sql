-- ============================================================
-- TIVE Original vuelve a @LainDaata_Bot, ahora con /tive
--
-- El 31/08 pasó a @Recup_Sd_bot con /tiv. El dueño la devuelve a
-- @LainDaata_Bot y cambia el comando: /tive en lugar de /tiv, que es
-- otra consulta distinta dentro del mismo bot.
--
-- Precio, nombre y formato de respuesta no se tocan. «TIVE Generado
-- (Réplica)» sigue con /tiveg y «SUNARP TIVE ORG» (premium) sigue en
-- @Recup_Sd_bot: ninguna de las dos entra aquí.
-- ============================================================

update public.consultas_catalog
   set bot_id     = 'laindata',
       comando    = '/tive {valor}',
       updated_at = now()
 where nombre = 'TIVE Original';
