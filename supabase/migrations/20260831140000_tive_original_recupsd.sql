-- ============================================================
-- TIVE Original pasa al bot @Recup_Sd_bot
--
-- La consulta la servía @LainDaata_Bot con /tiv. El comando es el mismo
-- en los dos bots, así que solo cambia de proveedor: mismo nombre, mismo
-- precio, mismo formato de respuesta (PDF con visor).
--
-- «TIVE Generado (Réplica)» NO se toca: es la réplica que emite la
-- plataforma con /tiveg, no la original. Y «SUNARP TIVE ORG» (premium)
-- ya estaba en @Recup_Sd_bot con este mismo comando.
-- ============================================================

update public.consultas_catalog
   set bot_id     = 'recupsd',
       comando    = '/tiv {valor}',
       updated_at = now()
 where nombre = 'TIVE Original';
