-- ============================================================
-- Reporte Completo — precio a 20 créditos
--
-- Por pedido directo del dueño (2026-09-24): queda igual a
-- costo_interno (20), sin margen. Primero se aplicó a 10 por una mala
-- lectura del pedido; el dueño corrigió que era 20, no 10.
--
-- Va por id: es la única fila con este comando.
--
-- Para revertirlo:
--   update public.consultas_catalog
--      set precio_venta = 30
--    where id = '17848845-281d-4264-b48d-f7b914f20a09';
-- ============================================================

update public.consultas_catalog
   set precio_venta = 20
 where id = '17848845-281d-4264-b48d-f7b914f20a09'
   and comando = '/mpla {valor}';
