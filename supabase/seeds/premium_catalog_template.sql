-- ============================================================
-- PREMIUM CATALOG — plantilla para insertar consultas exclusivas
-- de la pestaña "Consultas Premium" (visible solo para clientes
-- con plan Profesional / Plus / Business).
--
-- Cómo usarlo:
--   1. Reemplaza los valores de cada fila por el servicio real
--      (nombre, descripcion, comando, tipo_dato, precio_venta).
--   2. Ejecuta este script en Supabase SQL Editor.
--   3. Refresca la PWA — los servicios aparecen automáticamente
--      en la pestaña "Consultas Premium".
--
-- Reglas:
--   - categoria SIEMPRE 'premium'
--   - bot_id SIEMPRE 'recupsd' (es el bot @Recup_Sd_bot)
--   - precio_venta es el costo en créditos para usuarios FREE
--     (los suscriptores tienen consultas ilimitadas en su plan)
--   - tipo_dato puede ser: 'placa', 'dni', 'ruc', 'telefono', 'texto', 'foto'
--   - comando usa {valor} como placeholder (ej: '/lplaca {valor}')
--   - activa = true para que aparezca en la UI
-- ============================================================

insert into public.consultas_catalog (
  nombre, descripcion, categoria, bot_id, comando, tipo_dato, precio_venta, activa
) values
  -- ⬇ Aquí van los servicios premium. Pega tu lista entre los paréntesis.
  -- Ejemplo de plantilla (reemplaza por tu lista real):
  --
  -- ('Nombre del servicio',     'Descripción corta…', 'premium', 'recupsd', '/comando {valor}', 'placa', 5,  true),
  -- ('Otro servicio premium',   'Otra descripción…',  'premium', 'recupsd', '/otrocmd {valor}', 'dni',   10, true),

  ('Servicio premium 1 (editar)', 'Descripción del servicio premium 1', 'premium', 'recupsd', '/cmd1 {valor}', 'placa', 5, true),
  ('Servicio premium 2 (editar)', 'Descripción del servicio premium 2', 'premium', 'recupsd', '/cmd2 {valor}', 'dni',   8, true)
on conflict do nothing;

-- ============================================================
-- Verificar lo insertado:
-- ============================================================
-- select id, nombre, comando, tipo_dato, precio_venta, activa
-- from public.consultas_catalog
-- where categoria = 'premium'
-- order by created_at desc;
