-- ============================================================
-- Certificado SOAT (PDF) — cambia de bot
--
-- La consulta «Certificado SOAT (PDF)» de Consulta Vehicular le pedía el
-- /soat a `laindata`. Pasa a pedírselo a `ghostdataxxx` (@GHOSTDATAXXX_BOT).
-- El comando no cambia —sigue siendo /soat {valor}—, cambia quién lo
-- atiende.
--
-- Ojo con el catálogo: normalmente se edita a mano en Supabase y no queda
-- rastro en ningún commit (ver la memoria del proyecto). Esto va como
-- migración a propósito, para que el cambio se pueda leer y revertir.
--
-- No se toca ninguna otra fila: hay cuatro consultas más con el comando
-- /soat repartidas entre Consulta Vehicular, Vehículos y Premium, y por eso
-- el WHERE va por id y no por comando.
--
-- Para revertirlo:
--   update public.consultas_catalog
--      set bot_id = 'laindata'
--    where id = 'c2e50fa5-239a-4a1e-8493-6daeadab18a6';
-- ============================================================

update public.consultas_catalog
   set bot_id = 'ghostdataxxx'
 where id = 'c2e50fa5-239a-4a1e-8493-6daeadab18a6'
   and comando = '/soat {valor}';
