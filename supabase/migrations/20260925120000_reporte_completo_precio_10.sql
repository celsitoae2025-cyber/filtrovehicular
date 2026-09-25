-- ============================================================
-- Reporte Completo — precio a 10 créditos
--
-- Bajó de 30 a 10 por pedido directo del dueño (2026-09-24), aunque
-- costo_interno sigue en 20: se vende por debajo de su costo a
-- propósito (confirmado explícitamente pese al aviso).
--
-- Va por id: es la única fila con este comando.
--
-- Para revertirlo:
--   update public.consultas_catalog
--      set precio_venta = 30
--    where id = '17848845-281d-4264-b48d-f7b914f20a09';
-- ============================================================

update public.consultas_catalog
   set precio_venta = 10
 where id = '17848845-281d-4264-b48d-f7b914f20a09'
   and comando = '/mpla {valor}';
