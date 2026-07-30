-- ============================================================
-- PREMIUM CATALOG — 57 servicios exclusivos para suscriptores
-- (plan Profesional / Profesional Plus / Business)
--
-- Bot: @Recup_Sd_bot  (bot_id = 'recupsd')
-- Categoria: 'premium'
-- Visible solo en la pestaña "Consultas Premium" del sidebar.
-- precio_venta = costo en créditos para usuarios FREE
--   (los suscriptores las usan ilimitadamente, incluidas en su plan).
--
-- IDEMPOTENTE: si vuelves a correrlo, NO duplica.
-- Limpia primero los servicios premium previos y vuelve a insertarlos.
-- ============================================================

-- 1) Borrar servicios premium previos (idempotencia)
delete from public.consultas_catalog where categoria = 'premium';

-- 2) Insertar los servicios agrupados por subcategoría
insert into public.consultas_catalog
  (nombre, descripcion, categoria, subcategoria, tipo_dato, bot_id, comando,
   costo_interno, precio_venta, orden, activa)
values

  -- ── RENIEC ──────────────────────────────────────────────
  ('DNI V2',
   'Información de persona desde base de datos Reniec.',
   'premium', 'RENIEC', 'dni', 'recupsd', '/dnis {valor}', 0, 3, 10, true),

  ('DNI V3',
   'Información de persona en tiempo real desde Reniec.',
   'premium', 'RENIEC', 'dni', 'recupsd', '/dnib {valor}', 0, 3, 11, true),

  ('NOMBRES V1',
   'Búsqueda por nombres. Formato: Nombre1 Nombre2|ApellidoP|ApellidoM',
   'premium', 'RENIEC', 'texto', 'recupsd', '/nm {valor}', 0, 3, 12, true),

  ('FACIAL BETA',
   'Reconocimiento facial — sube una imagen para identificar a la persona.',
   'premium', 'RENIEC', 'foto', 'recupsd', '/fab', 0, 18, 13, true),

  ('C4 AZUL V1',
   'Genera C4 Azul v1 por DNI.',
   'premium', 'RENIEC', 'dni', 'recupsd', '/c4 {valor}', 0, 5, 14, true),

  ('DNI VIRTUAL AZUL',
   'Genera DNI Virtual Azul por DNI.',
   'premium', 'RENIEC', 'dni', 'recupsd', '/dniv {valor}', 0, 6, 15, true),

  -- ── TELEFONOS ────────────────────────────────────────────
  ('MOVISTAR POR NUMERO',
   'Consulta el titular de un número Movistar.',
   'premium', 'TELEFONOS', 'telefono', 'recupsd', '/movn {valor}', 0, 4, 20, true),

  ('DATA MOVISTAR',
   'Números Movistar registrados por DNI de cliente.',
   'premium', 'TELEFONOS', 'dni', 'recupsd', '/movd {valor}', 0, 4, 21, true),

  ('BITEL V3',
   'Consulta el titular de un número Bitel v3.',
   'premium', 'TELEFONOS', 'telefono', 'recupsd', '/bitx {valor}', 0, 2, 22, true),

  ('DATA BITEL',
   'Detalles de cliente Bitel por DNI.',
   'premium', 'TELEFONOS', 'dni', 'recupsd', '/bitd {valor}', 0, 3, 23, true),

  ('CLARO V1',
   'Consulta el titular de un número Claro v1.',
   'premium', 'TELEFONOS', 'telefono', 'recupsd', '/cl {valor}', 0, 4, 24, true),

  ('CLARO V2',
   'Consulta el titular de un número Claro v2.',
   'premium', 'TELEFONOS', 'telefono', 'recupsd', '/clw {valor}', 0, 4, 25, true),

  ('CLARO DEUDAS V1',
   'Busca deudas Claro por DNI y teléfono.',
   'premium', 'TELEFONOS', 'dni', 'recupsd', '/dcl {valor}', 0, 5, 26, true),

  ('CLARO DNI V1',
   'Busca teléfonos Claro asociados a un DNI.',
   'premium', 'TELEFONOS', 'dni', 'recupsd', '/cld {valor}', 0, 3, 27, true),

  ('CLARO DNI V2',
   'Busca teléfonos Claro por DNI (versión 2).',
   'premium', 'TELEFONOS', 'dni', 'recupsd', '/cldni {valor}', 0, 3, 28, true),

  ('TELEFONOS DB V1',
   'Consulta teléfonos relacionados al DNI.',
   'premium', 'TELEFONOS', 'telefono', 'recupsd', '/tels {valor}', 0, 3, 29, true),

  ('TITULAR DB',
   'Busca el titular por número de teléfono.',
   'premium', 'TELEFONOS', 'telefono', 'recupsd', '/tel {valor}', 0, 2, 30, true),

  ('IDENTIFICADOR TELF',
   'Identifica números telefónicos.',
   'premium', 'TELEFONOS', 'telefono', 'recupsd', '/ode {valor}', 0, 2, 31, true),

  ('PORTABILIDAD',
   'Consulta si un teléfono fue portado.',
   'premium', 'TELEFONOS', 'telefono', 'recupsd', '/port {valor}', 0, 1, 32, true),

  ('BANCAS MOVILES',
   'Consulta bancas móviles asociadas al número.',
   'premium', 'TELEFONOS', 'telefono', 'recupsd', '/bnt {valor}', 0, 15, 33, true),

  ('OPERADOR TELEFONICO',
   'Consulta el operador telefónico de un número.',
   'premium', 'TELEFONOS', 'telefono', 'recupsd', '/vlop {valor}', 0, 0, 34, true),

  -- ── VEHICULOS ────────────────────────────────────────────
  ('SUNARP ONLINE V1',
   'Busca propiedades y vehículos por DNI (online).',
   'premium', 'VEHÍCULOS', 'dni', 'recupsd', '/sun {valor}', 0, 4, 40, true),

  ('SUNARP BASE V2',
   'Busca propiedades y vehículos por DNI (base).',
   'premium', 'VEHÍCULOS', 'dni', 'recupsd', '/sunb {valor}', 0, 2, 41, true),

  ('INSCRIPCION VEHICULAR',
   'Datos de inscripción vehicular por placa.',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/ivehi {valor}', 0, 10, 42, true),

  ('SUNARP TIVE ORG',
   'Consulta TIVE ORG por placa.',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/tiv {valor}', 0, 20, 43, true),

  ('SUNARP PLACA V1',
   'Consulta datos por placa v1.',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/plai {valor}', 0, 2, 44, true),

  ('PLACA BASE',
   'Busca información por placa.',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/placa {valor}', 0, 4, 45, true),

  ('PLACA BASE 2',
   'Busca información por placa (versión 2).',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/plab {valor}', 0, 4, 46, true),

  ('LEYENDA VEHICULAR',
   'Busca la leyenda vehicular por placa.',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/lplaca {valor}', 0, 12, 47, true),

  ('SOAT',
   'Busca el SOAT vehicular por placa.',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/soat {valor}', 0, 2, 48, true),

  ('HISTORIAL SOAT',
   'Busca el historial de SOAT vehicular.',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/hsoat {valor}', 0, 6, 49, true),

  ('HISTORIAL SOAT 2',
   'Busca el historial de SOAT vehicular (versión 2).',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/hsoat2 {valor}', 0, 6, 50, true),

  ('MTC BASE',
   'Busca datos MTC por DNI.',
   'premium', 'VEHÍCULOS', 'dni', 'recupsd', '/mtcb {valor}', 0, 5, 51, true),

  ('RECORD VEHICULAR',
   'Busca el récord de conductor por DNI.',
   'premium', 'VEHÍCULOS', 'dni', 'recupsd', '/record {valor}', 0, 5, 52, true),

  ('REVISION TECNICA',
   'Consulta la revisión técnica vehicular (CITV) por placa.',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/citv {valor}', 0, 6, 53, true),

  ('SAT PAPELETAS',
   'Consulta papeletas SAT por placa.',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/sat {valor}', 0, 4, 54, true),

  ('SAT CAPTURAS',
   'Consulta capturas vehiculares SAT por placa.',
   'premium', 'VEHÍCULOS', 'placa', 'recupsd', '/csat {valor}', 0, 4, 55, true),

  -- ── FINANCIERO ───────────────────────────────────────────
  ('REPORTE FINANCIERO',
   'Consulta tu estado crediticio — reporte Sentinel.',
   'premium', 'FINANCIERO', 'dni', 'recupsd', '/senti {valor}', 0, 20, 60, true),

  ('REPORTE EQUIFAX BETA',
   'Consulta tu estado crediticio — reporte Equifax.',
   'premium', 'FINANCIERO', 'dni', 'recupsd', '/equix {valor}', 0, 15, 61, true),

  ('REPORTE SBS',
   'Consulta el reporte de la SBS (deudas y entidades financieras).',
   'premium', 'FINANCIERO', 'dni', 'recupsd', '/sbs {valor}', 0, 15, 62, true),

  ('CONSULTA AFP',
   'Consulta tu AFP registrado por DNI.',
   'premium', 'FINANCIERO', 'dni', 'recupsd', '/afp {valor}', 0, 5, 63, true),

  -- ── JUSTICIA ─────────────────────────────────────────────
  ('DENUNCIA POLICIAL',
   'Busca denuncias policiales por DNI.',
   'premium', 'JUSTICIA', 'dni', 'recupsd', '/denun {valor}', 0, 15, 70, true),

  ('CASOS FISCALES MPFN',
   'Busca casos fiscales por DNI.',
   'premium', 'JUSTICIA', 'dni', 'recupsd', '/fis {valor}', 0, 6, 71, true),

  -- ── FAMILIA Y HOGAR ──────────────────────────────────────
  ('HOGAR V2',
   'Consulta datos del hogar y dirección por DNI.',
   'premium', 'FAMILIA Y HOGAR', 'dni', 'recupsd', '/hogar {valor}', 0, 3, 80, true),

  ('ARBOL GEN',
   'Lista de familiares relacionados al DNI.',
   'premium', 'FAMILIA Y HOGAR', 'dni', 'recupsd', '/ag {valor}', 0, 5, 81, true),

  ('FAMILIA GEN',
   'Lista de familiares relacionados al DNI (versión 2).',
   'premium', 'FAMILIA Y HOGAR', 'dni', 'recupsd', '/fam {valor}', 0, 5, 82, true),

  -- ── EDUCACION Y LABORAL ──────────────────────────────────
  ('MINEDU NOTAS',
   'Busca notas MINEDU por DNI.',
   'premium', 'EDUCACIÓN Y LABORAL', 'dni', 'recupsd', '/notas {valor}', 0, 10, 90, true),

  ('MINEDU CONSTANCIA',
   'Genera constancia MINEDU por DNI.',
   'premium', 'EDUCACIÓN Y LABORAL', 'dni', 'recupsd', '/const {valor}', 0, 15, 91, true),

  ('CERT ADULTO MTPE',
   'Busca Certificado Único Laboral por DNI.',
   'premium', 'EDUCACIÓN Y LABORAL', 'dni', 'recupsd', '/cadult {valor}', 0, 8, 92, true),

  -- ── EMPRESAS SUNAT ───────────────────────────────────────
  ('SUNAT RUC V1',
   'Busca datos de empresa por número de RUC.',
   'premium', 'EMPRESAS SUNAT', 'ruc', 'recupsd', '/ruc {valor}', 0, 3, 100, true),

  ('RUC POR RAZON',
   'Busca RUC por nombre o razón social.',
   'premium', 'EMPRESAS SUNAT', 'texto', 'recupsd', '/rucn {valor}', 0, 3, 101, true),

  ('RUC POR DNI',
   'Busca RUC asociado a un DNI.',
   'premium', 'EMPRESAS SUNAT', 'dni', 'recupsd', '/rucd {valor}', 0, 2, 102, true),

  -- ── SALUD ────────────────────────────────────────────────
  ('SALUD SEGUROS FULL',
   'Listado de seguros de salud por DNI.',
   'premium', 'SALUD', 'dni', 'recupsd', '/seg {valor}', 0, 3, 110, true),

  -- ── OTROS ────────────────────────────────────────────────
  ('META DATOS WB',
   'Información general consolidada.',
   'premium', 'OTROS', 'dni', 'recupsd', '/dox {valor}', 0, 10, 120, true);

-- ============================================================
-- Verificar:
-- select orden, nombre, comando, tipo_dato, precio_venta, activa
-- from public.consultas_catalog
-- where categoria = 'premium'
-- order by orden;
-- ============================================================
