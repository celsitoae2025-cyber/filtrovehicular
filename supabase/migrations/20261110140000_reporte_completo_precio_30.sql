-- Reporte Completo: mantener el precio solicitado de 30 créditos.
-- La migración 20260925120000_reporte_completo_precio_20.sql lo bajó a 20;
-- esta actualización restaura los 30 créditos en la fila específica de /mpla.

update public.consultas_catalog
   set precio_venta = 30
 where id = '17848845-281d-4264-b48d-f7b914f20a09'
   and comando = '/mpla {valor}';
