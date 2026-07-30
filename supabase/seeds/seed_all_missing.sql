-- ============================================================
-- Seed — 35 consultas faltantes del bot @Recup_Sd_bot (recupsd)
-- NO toca las consultas de vehículos/SUNARP/SOAT ya existentes.
-- precio_venta = costo_interno (sin markup) — regla del proyecto.
--
-- Mapeo de categorias → vista del sidebar:
--   reniec, certificados, telefonia, familiares, financiero,
--   delitos, estudios, sunat
-- ============================================================

insert into public.consultas_catalog
  (nombre, descripcion, categoria, tipo_dato, bot_id, comando,
   costo_interno, precio_venta, plan_minimo_bot, respuesta_formato, orden, activa)
values

-- ============================================================
-- 🪪 RENIEC (3)
-- ============================================================
('DNI con foto y firma',
 'Datos RENIEC completos del titular + foto + firma.',
 'reniec', 'dni', 'recupsd', '/dnis {valor}',
 3, 3, null,
 '{"texto": true, "imagenes": 2}'::jsonb, 10, true),

('DNI con foto',
 'Datos RENIEC completos del titular + foto.',
 'reniec', 'dni', 'recupsd', '/dnib {valor}',
 3, 3, null,
 '{"texto": true, "imagenes": 1}'::jsonb, 20, true),

('Búsqueda por nombres',
 'Busca DNIs a partir del nombre y apellidos. Formato: NOMBRE1 NOMBRE2|APELLIDO1|APELLIDO2',
 'reniec', 'texto', 'recupsd', '/nm {valor}',
 3, 3, null,
 '{"texto": true}'::jsonb, 30, true),

-- ============================================================
-- ⚙ CERTIFICADOS / GENERADOR (2)
-- ============================================================
('C4 Azul',
 'Genera certificado C4 azul a partir del DNI.',
 'certificados', 'dni', 'recupsd', '/c4 {valor}',
 5, 5, null,
 '{"texto": true, "imagenes": 1, "pdf": true}'::jsonb, 10, true),

('DNI Virtual Azul',
 'Genera imagen del DNI virtual azul.',
 'certificados', 'dni', 'recupsd', '/dniv {valor}',
 15, 15, null,
 '{"texto": true, "imagenes": 1}'::jsonb, 20, true),

-- ============================================================
-- 📞 TELEFONÍA (16)
-- ============================================================
('Movistar titular',
 'Titular del número Movistar.',
 'telefonia', 'telefono', 'recupsd', '/movn {valor}',
 4, 4, null,
 '{"texto": true}'::jsonb, 10, true),

('Movistar por DNI',
 'Números Movistar asociados al DNI.',
 'telefonia', 'dni', 'recupsd', '/movd {valor}',
 4, 4, null,
 '{"texto": true}'::jsonb, 20, true),

('Bitel titular',
 'Titular del número Bitel.',
 'telefonia', 'telefono', 'recupsd', '/bitx {valor}',
 2, 2, null,
 '{"texto": true}'::jsonb, 30, true),

('Bitel por DNI',
 'Detalles de cliente Bitel por DNI.',
 'telefonia', 'dni', 'recupsd', '/bitd {valor}',
 3, 3, null,
 '{"texto": true}'::jsonb, 40, true),

('Claro titular V1',
 'Titular del número Claro.',
 'telefonia', 'telefono', 'recupsd', '/cl {valor}',
 4, 4, null,
 '{"texto": true}'::jsonb, 50, true),

('Claro titular V2',
 'Titular del número Claro (base VIP).',
 'telefonia', 'telefono', 'recupsd', '/clw {valor}',
 4, 4, null,
 '{"texto": true}'::jsonb, 60, true),

('Claro deudas',
 'PDF con deudas Claro por DNI.',
 'telefonia', 'dni', 'recupsd', '/dcl {valor}',
 5, 5, null,
 '{"texto": true, "pdf": true, "botones": true}'::jsonb, 70, true),

('Claro números V1',
 'Números Claro asociados al DNI.',
 'telefonia', 'dni', 'recupsd', '/cld {valor}',
 3, 3, null,
 '{"texto": true}'::jsonb, 80, true),

('Claro números V2',
 'Números Claro asociados al DNI (variante).',
 'telefonia', 'dni', 'recupsd', '/cldni {valor}',
 3, 3, null,
 '{"texto": true}'::jsonb, 90, true),

('Teléfonos por DNI',
 'Listado de teléfonos relacionados al DNI.',
 'telefonia', 'dni', 'recupsd', '/tels {valor}',
 3, 3, null,
 '{"texto": true}'::jsonb, 100, true),

('Titular por teléfono',
 'Nombre del titular a partir de un teléfono.',
 'telefonia', 'telefono', 'recupsd', '/tel {valor}',
 2, 2, null,
 '{"texto": true}'::jsonb, 110, true),

('Identificador del teléfono',
 'Identifica información de un número telefónico.',
 'telefonia', 'telefono', 'recupsd', '/ode {valor}',
 2, 2, null,
 '{"texto": true}'::jsonb, 120, true),

('Portabilidad',
 'Consulta si un número fue portado.',
 'telefonia', 'telefono', 'recupsd', '/port {valor}',
 1, 1, null,
 '{"texto": true}'::jsonb, 130, true),

('Bancas móviles',
 'Bancas asociadas a un número telefónico.',
 'telefonia', 'telefono', 'recupsd', '/bnt {valor}',
 15, 15, null,
 '{"texto": true}'::jsonb, 140, true),

('Operador telefónico (gratis)',
 'Operador asociado al número (consulta gratuita).',
 'telefonia', 'telefono', 'recupsd', '/vlop {valor}',
 0, 0, null,
 '{"texto": true}'::jsonb, 150, true),

('Valida números Osiptel (gratis)',
 'Números registrados en Osiptel por DNI (consulta gratuita).',
 'telefonia', 'dni', 'recupsd', '/vlnum {valor}',
 0, 0, null,
 '{"texto": true}'::jsonb, 160, true),

-- ============================================================
-- 👨‍👩‍👧‍👦 FAMILIARES (3)
-- ============================================================
('Datos del hogar',
 'Miembros del hogar asociados al DNI.',
 'familiares', 'dni', 'recupsd', '/hogar {valor}',
 3, 3, null,
 '{"texto": true}'::jsonb, 10, true),

('Árbol genealógico',
 'Lista de familiares relacionados al DNI.',
 'familiares', 'dni', 'recupsd', '/ag {valor}',
 5, 5, null,
 '{"texto": true}'::jsonb, 20, true),

('Familia (variante)',
 'Lista de familiares relacionados al DNI (base alternativa).',
 'familiares', 'dni', 'recupsd', '/fam {valor}',
 5, 5, null,
 '{"texto": true}'::jsonb, 30, true),

-- ============================================================
-- 📊 FINANCIERO (3)
-- ============================================================
('Reporte SBS',
 'PDF del reporte crediticio SBS del titular.',
 'financiero', 'dni', 'recupsd', '/sbs {valor}',
 15, 15, null,
 '{"texto": true, "pdf": true}'::jsonb, 10, true),

('Consulta AFP',
 'AFP registrada del titular.',
 'financiero', 'dni', 'recupsd', '/afp {valor}',
 5, 5, null,
 '{"texto": true}'::jsonb, 20, true),

('Seguros de salud',
 'Listado de seguros registrados por DNI.',
 'financiero', 'dni', 'recupsd', '/seg {valor}',
 3, 3, null,
 '{"texto": true}'::jsonb, 30, true),

-- ============================================================
-- 🔎 DELITOS / ANTECEDENTES (3)
-- ============================================================
('Denuncia policial',
 'PDF con denuncias policiales del DNI.',
 'delitos', 'dni', 'recupsd', '/denun {valor}',
 15, 15, null,
 '{"texto": true, "pdf": true}'::jsonb, 10, true),

('Casos fiscales MPFN',
 'PDF con casos fiscales registrados en el MPFN.',
 'delitos', 'dni', 'recupsd', '/fis {valor}',
 6, 6, null,
 '{"texto": true, "pdf": true}'::jsonb, 20, true),

('Meta datos',
 'Información general agregada del DNI.',
 'delitos', 'dni', 'recupsd', '/dox {valor}',
 10, 10, null,
 '{"texto": true}'::jsonb, 30, true),

-- ============================================================
-- 🎓 ESTUDIOS (2)
-- ============================================================
('Minedu notas',
 'PDF con notas de Minedu del estudiante.',
 'estudios', 'dni', 'recupsd', '/notas {valor}',
 10, 10, null,
 '{"texto": true, "pdf": true}'::jsonb, 10, true),

('Minedu constancia',
 'PDF con constancia de logros Minedu del estudiante.',
 'estudios', 'dni', 'recupsd', '/const {valor}',
 15, 15, null,
 '{"texto": true, "pdf": true}'::jsonb, 20, true),

-- ============================================================
-- 🏢 SUNAT (3)
-- ============================================================
('RUC por RUC',
 'Datos de empresa a partir del RUC.',
 'sunat', 'ruc', 'recupsd', '/ruc {valor}',
 3, 3, null,
 '{"texto": true}'::jsonb, 10, true),

('RUC por razón social',
 'Busca RUC a partir del nombre o razón social.',
 'sunat', 'texto', 'recupsd', '/rucn {valor}',
 3, 3, null,
 '{"texto": true}'::jsonb, 20, true),

('RUC por DNI',
 'RUC a partir del DNI del titular.',
 'sunat', 'dni', 'recupsd', '/rucd {valor}',
 2, 2, null,
 '{"texto": true}'::jsonb, 30, true);
