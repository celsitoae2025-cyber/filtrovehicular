-- ============================================================
-- Precios: tres consultas, de la hoja de créditos del 19/08/2026
--
-- El dueño revisó el catálogo en Excel y movió estos tres. Los demás
-- quedan como estaban.
--
--   Reporte Completo    /metapla   20 → 30   (Consulta Vehicular)
--   SUNARP TIVE ORG     /tiv       20 → 15   (Premium)
--   REPORTE FINANCIERO  /senti     20 → 15   (Premium)
--
-- Cada uno va por id y comprobando el precio de partida: si alguien lo
-- hubiera tocado a mano entretanto, la fila no se actualiza en vez de
-- pisar un cambio más nuevo sin enterarse.
--
-- Ojo: hay otras consultas con estos mismos comandos —/tiv sale también
-- en Consulta Vehicular y en Vehículos— y ninguna se mueve. Por eso el
-- WHERE va por id.
--
-- Para revertirlo, cambiar 30 por 20 y 15 por 20 en cada uno.
-- ============================================================

update public.consultas_catalog
   set precio_venta = 30
 where id = '17848845-281d-4264-b48d-f7b914f20a09'
   and precio_venta = 20;

update public.consultas_catalog
   set precio_venta = 15
 where id = '5ad0b254-8b61-4289-9598-619923bb8b57'
   and precio_venta = 20;

update public.consultas_catalog
   set precio_venta = 15
 where id = '0a12b865-c613-4990-a6d9-b0e7476c7ee2'
   and precio_venta = 20;
