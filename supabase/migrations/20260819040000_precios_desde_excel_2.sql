-- ============================================================
-- Precios: cinco consultas, segunda ronda de la hoja de créditos
-- (archivo guardado el 19/08/2026 a las 21:50)
--
--   Reporte SBS PDF          /sbsvp      20 → 10   (Financiero)
--   Denuncias Online         /denuncias  25 → 15   (Justicia)
--   Migraciones DNI PDF      /migra      30 → 10   (Extras)
--   Migraciones por CE PDF   /migrace    30 → 10   (Extras)
--   Minedu Online PDF        /minedu     25 → 10   (Extras)
--
-- Falta a propósito una sexta que la hoja pedía: SUNARP TIVE ORG volvía de
-- 15 a 20, deshaciendo lo que se aplicó media hora antes en la ronda
-- anterior. No se toca hasta que el dueño lo confirme: la columna que él
-- rellena guarda la foto de precios de cuando se generó el archivo, así que
-- una fila sin tocar puede parecer una petición de volver atrás.
--
-- Cada uno va por id y comprobando el precio de partida: si alguien lo
-- hubiera movido a mano entretanto, la fila no se actualiza en vez de pisar
-- un cambio más nuevo sin enterarse.
-- ============================================================

update public.consultas_catalog
   set precio_venta = 10
 where id = '98c2035f-3cd3-422a-82e1-1cf70c9e2b84'
   and precio_venta = 20;                       -- Reporte SBS PDF

update public.consultas_catalog
   set precio_venta = 15
 where id = '523c1a2a-81aa-45d2-a48f-5a271aa82744'
   and precio_venta = 25;                       -- Denuncias Online

update public.consultas_catalog
   set precio_venta = 10
 where id = '76795bf4-5ddf-41c4-ba80-686e573778b5'
   and precio_venta = 30;                       -- Migraciones DNI PDF

update public.consultas_catalog
   set precio_venta = 10
 where id = '33d4ce7a-6d88-475d-91c9-c08cb147f358'
   and precio_venta = 30;                       -- Migraciones por CE PDF

update public.consultas_catalog
   set precio_venta = 10
 where id = 'ca58e3c0-25a8-43e7-bc63-086d1928446a'
   and precio_venta = 25;                       -- Minedu Online PDF
