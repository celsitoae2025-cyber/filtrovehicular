-- ============================================================
-- Seed — 62 consultas del bot @Fuentesdata_bot
-- Bot id: fuentesdata
-- IDEMPOTENTE: borra e inserta todo cada vez que se ejecuta.
-- ============================================================

delete from public.consultas_catalog where bot_id = 'fuentesdata';

insert into public.consultas_catalog
  (nombre, descripcion, categoria, tipo_dato, bot_id, comando,
   costo_interno, precio_venta, plan_minimo_bot, respuesta_formato, orden, activa)
values

-- ============================================================
-- RENIEC (9)
-- ============================================================
('RENIEC Básico',
 'Imagen del rostro y datos en texto a partir del DNI.',
 'reniec', 'dni', 'fuentesdata', '/dnit {valor}',
 2, 2, null, '{"texto": true, "imagenes": 1}'::jsonb, 10, true),

('RENIEC Completo',
 'Imagen del rostro, firma, huellas y datos en texto a partir del DNI.',
 'reniec', 'dni', 'fuentesdata', '/dni {valor}',
 4, 4, null, '{"texto": true, "imagenes": 4}'::jsonb, 20, true),

('Foto del Rostro DNI',
 'Solo la foto registrada del DNI.',
 'reniec', 'dni', 'fuentesdata', '/foto {valor}',
 1, 1, null, '{"texto": true, "imagenes": 1}'::jsonb, 30, true),

('RENIEC por Nombres',
 'Filtro de nombres, texto y .txt. Formato: NOMBRES|APELLIDO1|APELLIDO2',
 'reniec', 'texto', 'fuentesdata', '/nm {valor}',
 0, 0, null, '{"texto": true}'::jsonb, 40, true),

('Ficha C4 Azul',
 'Genera ficha C4 azul en PDF mediante DNI.',
 'reniec', 'dni', 'fuentesdata', '/c4a {valor}',
 5, 5, null, '{"texto": true, "pdf": true}'::jsonb, 50, true),

('Ficha C4 Blanco',
 'Genera ficha C4 blanco en foto/PDF mediante DNI.',
 'reniec', 'dni', 'fuentesdata', '/c4b {valor}',
 5, 5, null, '{"texto": true, "pdf": true, "imagenes": 1}'::jsonb, 60, true),

('Ficha C4 Certificado',
 'Genera ficha C4 certificado en foto/PDF mediante DNI.',
 'reniec', 'dni', 'fuentesdata', '/c4i {valor}',
 5, 5, null, '{"texto": true, "imagenes": 1, "pdf": true}'::jsonb, 70, true),

('DNI Digital Azul/Amarillo',
 'Genera DNI digital azul/amarillo anverso y reverso en formato imagen.',
 'reniec', 'dni', 'fuentesdata', '/dniv {valor}',
 5, 5, null, '{"texto": true, "imagenes": 2}'::jsonb, 80, true),

('DNI Electrónico V3.0',
 'Genera DNI electrónico V3.0 anverso y reverso en formato imagen.',
 'reniec', 'dni', 'fuentesdata', '/dnivel {valor}',
 5, 5, null, '{"texto": true, "imagenes": 2}'::jsonb, 90, true),

-- ============================================================
-- TELEFONIA (6)
-- ============================================================
('Osiptel y Telefonía Online',
 'Consulta números por DNI o teléfono en Osiptel.',
 'telefonia', 'dni', 'fuentesdata', '/telp {valor}',
 8, 8, null, '{"texto": true}'::jsonb, 10, true),

('Telefonía y Osiptel Base',
 'Consulta números por DNI, teléfono o RUC en base de telefonía.',
 'telefonia', 'dni', 'fuentesdata', '/telp2 {valor}',
 6, 6, null, '{"texto": true}'::jsonb, 20, true),

('Identificar Operador',
 'Identifica el operador móvil de un número telefónico.',
 'telefonia', 'telefono', 'fuentesdata', '/operador {valor}',
 1, 1, null, '{"texto": true}'::jsonb, 30, true),

('Claro Perú',
 'Datos del titular de un número Claro.',
 'telefonia', 'telefono', 'fuentesdata', '/claro {valor}',
 5, 5, null, '{"texto": true}'::jsonb, 40, true),

('Movistar Perú',
 'Datos del titular de un número Movistar.',
 'telefonia', 'telefono', 'fuentesdata', '/movistar {valor}',
 5, 5, null, '{"texto": true}'::jsonb, 50, true),

('Bitel Perú',
 'Datos del titular de un número Bitel.',
 'telefonia', 'telefono', 'fuentesdata', '/bitel {valor}',
 5, 5, null, '{"texto": true}'::jsonb, 60, true),

-- ============================================================
-- JUSTICIA / DELITOS (9)
-- ============================================================
('MPFN Fiscalía Online PDF',
 'Verifica si un DNI cuenta con casos fiscales en MPFN. Resultado en PDF.',
 'delitos', 'dni', 'fuentesdata', '/fiscapdf {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

('MPFN Fiscalía Online Texto',
 'Verifica si un DNI cuenta con casos fiscales en MPFN. Resultado en texto.',
 'delitos', 'dni', 'fuentesdata', '/fisca {valor}',
 7, 7, null, '{"texto": true}'::jsonb, 20, true),

('MPFN Fiscalía por Nombres',
 'Verifica casos fiscales en MPFN por nombres y apellidos. Formato: NOMBRE - APELLIDO1 - APELLIDO2. Resultado en PDF.',
 'delitos', 'texto', 'fuentesdata', '/fisnombre {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 30, true),

('MPFN Caso Fiscal por Expediente',
 'Visualiza un caso fiscal del MPFN mediante número de expediente. Formato: 01805114504 - 2023 - 45 - 0',
 'delitos', 'texto', 'fuentesdata', '/fisexpe {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 40, true),

('Denuncias Online',
 'Verifica si un DNI cuenta con denuncias. Resultado en PDF.',
 'delitos', 'dni', 'fuentesdata', '/denuncias {valor}',
 20, 20, null, '{"texto": true, "pdf": true}'::jsonb, 50, true),

('Denuncias Vehicular',
 'Verifica si una placa cuenta con denuncias. Resultado en PDF.',
 'delitos', 'placa', 'fuentesdata', '/denunv {valor}',
 20, 20, null, '{"texto": true, "pdf": true}'::jsonb, 60, true),

('Requisitoria Online',
 'Verifica si un DNI cuenta con requisitoria. Resultado en PDF.',
 'delitos', 'dni', 'fuentesdata', '/rq {valor}',
 20, 20, null, '{"texto": true, "pdf": true}'::jsonb, 70, true),

('Requisitoria Vehicular Online',
 'Verifica si una placa cuenta con requisitoria vehicular. Resultado en PDF.',
 'delitos', 'placa', 'fuentesdata', '/rqv {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 80, true),

('Verificación Policial',
 'Verifica si un DNI pertenece a la Policía Nacional del Perú. Resultado en PDF.',
 'delitos', 'dni', 'fuentesdata', '/policia {valor}',
 7, 7, null, '{"texto": true, "pdf": true}'::jsonb, 90, true),

-- ============================================================
-- SUNAT (4)
-- ============================================================
('SUNAT Ficha RUC',
 'Consulta la ficha RUC mediante DNI (8 dígitos) o RUC (11 dígitos).',
 'sunat', 'dni', 'fuentesdata', '/sunat {valor}',
 10, 10, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

('Reporte Consumos PDF',
 'Reporte de consumos y gastos (SUNAT) en PDF mediante DNI.',
 'sunat', 'dni', 'fuentesdata', '/consumos {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

('Consulta Trabajos',
 'Historial de trabajos y sueldos del titular.',
 'sunat', 'dni', 'fuentesdata', '/trabajos {valor}',
 10, 10, null, '{"texto": true}'::jsonb, 30, true),

('Consulta AFP',
 'Verifica si una persona está afiliada a una AFP y genera su reporte en PDF.',
 'sunat', 'dni', 'fuentesdata', '/afp {valor}',
 5, 5, null, '{"texto": true, "pdf": true}'::jsonb, 40, true),

-- ============================================================
-- SUNARP (6)
-- ============================================================
('SUNARP Propiedades Texto',
 'Verifica si un DNI o RUC cuenta con propiedades. Resultado en texto.',
 'sunarp', 'dni', 'fuentesdata', '/pro {valor}',
 4, 4, null, '{"texto": true}'::jsonb, 10, true),

('SUNARP Propiedades PDF',
 'Verifica si un DNI cuenta con propiedades. Resultado en PDF.',
 'sunarp', 'dni', 'fuentesdata', '/propdf {valor}',
 10, 10, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

('SUNARP Bienes PDF',
 'Verifica las propiedades de una persona en SUNARP consolidadas en PDF.',
 'sunarp', 'dni', 'fuentesdata', '/bienes {valor}',
 10, 10, null, '{"texto": true, "pdf": true}'::jsonb, 30, true),

('Partidas Registrales Online',
 'Verifica la copia registral de una propiedad. Formato: LIMA-11207517',
 'sunarp', 'texto', 'fuentesdata', '/partida {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 40, true),

('Propiedades de Vehículos',
 'Verifica los vehículos registrados a nombre de un DNI.',
 'sunarp', 'dni', 'fuentesdata', '/vehiculo {valor}',
 10, 10, null, '{"texto": true, "pdf": true}'::jsonb, 50, true),

('Partida Registral Vehicular',
 'Consulta la partida registral de un vehículo por placa en PDF.',
 'sunarp', 'placa', 'fuentesdata', '/vehiculopdf {valor}',
 10, 10, null, '{"texto": true, "pdf": true}'::jsonb, 60, true),

-- ============================================================
-- VEHICULOS (5)
-- ============================================================
('Información Vehicular por Placa',
 'Datos del vehículo en formato texto a partir de la placa.',
 'vehiculos', 'placa', 'fuentesdata', '/pla {valor}',
 1, 1, null, '{"texto": true}'::jsonb, 10, true),

('Boleta Informativa',
 'Consulta la boleta informativa vehicular en PDF mediante placa.',
 'vehiculos', 'placa', 'fuentesdata', '/boi {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

('TIVE Original',
 'Consulta la tarjeta de identificación vehicular (TIVE) en PDF mediante placa.',
 'vehiculos', 'placa', 'fuentesdata', '/tivep {valor}',
 8, 8, null, '{"texto": true, "pdf": true}'::jsonb, 30, true),

('TIVE Original Premium',
 'Consulta la tarjeta de identificación vehicular original en PDF mediante placa.',
 'vehiculos', 'placa', 'fuentesdata', '/tive {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 40, true),

('Duplicado Tarjeta Vehicular Online',
 'Genera el duplicado de la tarjeta de identificación vehicular (TIVE) online en PDF.',
 'vehiculos', 'placa', 'fuentesdata', '/duplicado {valor}',
 12, 12, null, '{"texto": true, "pdf": true}'::jsonb, 50, true),

-- ============================================================
-- CERTIFICADOS (3)
-- ============================================================
('Antecedentes Penales',
 'Genera certificado de antecedentes penales en PDF mediante DNI.',
 'certificados', 'dni', 'fuentesdata', '/antpen {valor}',
 5, 5, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

('Antecedentes Policiales',
 'Genera certificado de antecedentes policiales en PDF mediante DNI.',
 'certificados', 'dni', 'fuentesdata', '/antpol {valor}',
 5, 5, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

('Antecedentes Judiciales',
 'Genera certificado de antecedentes judiciales en PDF mediante DNI.',
 'certificados', 'dni', 'fuentesdata', '/antjud {valor}',
 5, 5, null, '{"texto": true, "pdf": true}'::jsonb, 30, true),

-- ============================================================
-- ESTUDIOS (2)
-- ============================================================
('MINEDU Certificado de Estudio',
 'Consulta certificado de estudio MINEDU en PDF mediante DNI.',
 'estudios', 'dni', 'fuentesdata', '/minedu {valor}',
 25, 25, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

('SUNEDU Títulos Académicos',
 'Consulta títulos universitarios en SUNEDU con descarga de certificados PDF.',
 'estudios', 'dni', 'fuentesdata', '/sunedu {valor}',
 5, 5, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

-- ============================================================
-- FAMILIA / FAMILIARES (2)
-- ============================================================
('Árbol Genealógico (Texto)',
 'Consulta el árbol genealógico en texto/foto de una persona mediante DNI.',
 'familiares', 'dni', 'fuentesdata', '/ag {valor}',
 5, 5, null, '{"texto": true, "imagenes": 1}'::jsonb, 10, true),

('Árbol Genealógico (PDF)',
 'Consulta el árbol genealógico en PDF de una persona mediante DNI.',
 'familiares', 'dni', 'fuentesdata', '/agv {valor}',
 10, 10, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

-- ============================================================
-- FINANCIERO (3)
-- ============================================================
('Reporte Sentinel',
 'Consulta el reporte Sentinel en PDF mediante DNI o RUC.',
 'financiero', 'dni', 'fuentesdata', '/sentinel {valor}',
 25, 25, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

('Reporte SBS',
 'Consulta el reporte financiero SBS en formato texto estructurado.',
 'financiero', 'dni', 'fuentesdata', '/sbs {valor}',
 25, 25, null, '{"texto": true}'::jsonb, 20, true),

('Reporte SBS Base',
 'Consulta el reporte financiero SBS en PDF desde base de datos.',
 'financiero', 'dni', 'fuentesdata', '/sbsb {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 30, true),

-- ============================================================
-- SEEKER (2)
-- ============================================================
('Seeker Online',
 'Consulta Seeker online mediante DNI (8 dígitos) o teléfono (9 dígitos).',
 'seeker', 'dni', 'fuentesdata', '/seeker {valor}',
 20, 20, null, '{"texto": true}'::jsonb, 10, true),

('Seeker Reporte PDF',
 'Genera reporte PDF integral de Seeker con foto.',
 'seeker', 'dni', 'fuentesdata', '/seekerpdf {valor}',
 20, 20, null, '{"texto": true, "pdf": true, "imagenes": 1}'::jsonb, 20, true),

-- ============================================================
-- MTC (5)
-- ============================================================
('Récord del Conductor',
 'Consulta el récord del conductor (licencia, infracciones y sanciones) en PDF.',
 'mtc', 'dni', 'fuentesdata', '/record {valor}',
 8, 8, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

('MTC Licencia',
 'Consulta ficha de licencia de conducir por DNI en PDF.',
 'mtc', 'dni', 'fuentesdata', '/licencia {valor}',
 5, 5, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

('Revisión Técnica',
 'Consulta la revisión técnica vehicular mediante placa.',
 'mtc', 'placa', 'fuentesdata', '/revtec {valor}',
 5, 5, null, '{"texto": true}'::jsonb, 30, true),

('Historial SOAT',
 'Consulta el seguro vehicular historial en texto mediante placa.',
 'mtc', 'placa', 'fuentesdata', '/hsoat {valor}',
 5, 5, null, '{"texto": true}'::jsonb, 40, true),

('ATU Papeletas Vehiculares',
 'Consulta papeletas de tránsito registradas en ATU mediante placa.',
 'mtc', 'placa', 'fuentesdata', '/atu {valor}',
 6, 6, null, '{"texto": true}'::jsonb, 50, true),

-- ============================================================
-- ACTAS (3)
-- ============================================================
('Acta de Nacimiento Original',
 'Genera ficha de nacimiento de RENIEC.',
 'actas', 'dni', 'fuentesdata', '/actnac {valor}',
 20, 20, null, '{"texto": true, "imagenes": 1}'::jsonb, 10, true),

('Acta de Matrimonio Original',
 'Genera ficha de matrimonio de RENIEC.',
 'actas', 'dni', 'fuentesdata', '/actmat {valor}',
 20, 20, null, '{"texto": true, "imagenes": 1}'::jsonb, 20, true),

('Acta de Defunción Original',
 'Genera ficha de defunción de RENIEC.',
 'actas', 'dni', 'fuentesdata', '/actdef {valor}',
 20, 20, null, '{"texto": true, "imagenes": 1}'::jsonb, 30, true),

-- ============================================================
-- VIP (1)
-- ============================================================
('Meta Data',
 'Búsqueda en RENIEC, MINSA, OSIPTEL, SUNARP, SISFOH, SUNAT y más mediante DNI.',
 'vip', 'dni', 'fuentesdata', '/meta {valor}',
 30, 30, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

-- ============================================================
-- FACIAL (1)
-- ============================================================
('Reconocimiento Facial',
 'Reconocimiento facial a partir de una foto subida.',
 'facial', 'foto', 'fuentesdata', '/facial',
 40, 40, null, '{"texto": true, "imagenes": 1}'::jsonb, 10, true),

-- ============================================================
-- MIGRACIONES (1)
-- ============================================================
('Reporte Migratorio',
 'Reporte migratorio en PDF. Acepta: DNI, CE, PAS, PASEXT, CPP, PTP.',
 'migraciones', 'dni', 'fuentesdata', '/migraciones {valor}',
 25, 25, null, '{"texto": true, "pdf": true}'::jsonb, 10, true);

-- ============================================================
-- Verificar:
-- select categoria, nombre, comando, precio_venta
-- from public.consultas_catalog
-- where bot_id = 'fuentesdata'
-- order by categoria, orden;
-- ============================================================
