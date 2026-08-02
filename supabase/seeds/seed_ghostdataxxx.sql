-- ============================================================
-- Seed — Catálogo del bot @GHOSTDATAXXX_BOT (bot_id='ghostdataxxx')
-- Reemplaza POR COMPLETO el contenido de todas las pestañas del
-- sidebar (grupo "Extras") EXCEPTO 'vehiculos', que no se toca.
--
-- Categorías que quedan VACÍAS a propósito (sin reemplazo):
--   certificados, actas, vip, facial
--
-- precio_venta = costo_interno (sin markup) — regla del proyecto.
-- plan_minimo_bot = null (sin gating de plan) — ajustar en el
-- panel admin si @GHOSTDATAXXX_BOT requiere un tier específico.
--
-- IMPORTANTE: corre este script UNA VEZ en Supabase → SQL Editor.
-- ============================================================

begin;

-- 1) Limpiar TODAS las consultas previas de las 15 categorías del
--    sidebar que no sean 'vehiculos' (de cualquier bot que tuvieran).
delete from public.consultas_catalog
where categoria in (
  'reniec', 'familiares', 'telefonia', 'sunarp', 'sunat', 'financiero',
  'delitos', 'migraciones', 'estudios', 'mtc', 'seeker',
  'certificados', 'actas', 'vip', 'facial'
);

-- 2) Insertar el catálogo nuevo, todo bajo bot_id='ghostdataxxx'.
insert into public.consultas_catalog
  (nombre, descripcion, categoria, tipo_dato, bot_id, comando,
   costo_interno, precio_venta, plan_minimo_bot, respuesta_formato, orden, activa)
values

-- ============================================================
-- RENIEC (5)
-- ============================================================
('Ficha C4 Azul PDF', 'Datos ficha azul via Reniec online.',
 'reniec', 'dni', 'ghostdataxxx', '/c4a {valor}',
 5, 5, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

('Ficha C4 Blanco PDF', 'Datos ficha blanco via Reniec online.',
 'reniec', 'dni', 'ghostdataxxx', '/c4b {valor}',
 5, 5, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

('Ficha C4 Certificado PDF', 'Datos certificado via Reniec online.',
 'reniec', 'dni', 'ghostdataxxx', '/c4i {valor}',
 5, 5, null, '{"texto": true, "pdf": true}'::jsonb, 30, true),

('DNI Digital Azul/Amarillo (Foto)', 'Foto DNI virtual via Reniec online.',
 'reniec', 'dni', 'ghostdataxxx', '/dniv {valor}',
 5, 5, null, '{"texto": true, "imagenes": 1}'::jsonb, 40, true),

('DNI Electrónico (Foto)', 'Foto DNI virtual via Reniec online.',
 'reniec', 'dni', 'ghostdataxxx', '/dnivel {valor}',
 5, 5, null, '{"texto": true, "imagenes": 1}'::jsonb, 50, true),

-- ============================================================
-- FAMILIARES (3)
-- ============================================================
('Árbol Genealógico', 'Datos genealogico via Reniec online.',
 'familiares', 'dni', 'ghostdataxxx', '/ag {valor}',
 5, 5, null, '{"texto": true, "pdf": false}'::jsonb, 10, true),

('Árbol Genealógico Visual', 'Arbol genealogico visual (PDF) via Reniec online.',
 'familiares', 'dni', 'ghostdataxxx', '/agvp {valor}',
 10, 10, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

('Sisfoh', 'Datos integrantes via Sisfoh online.',
 'familiares', 'dni', 'ghostdataxxx', '/hogar {valor}',
 5, 5, null, '{"texto": true, "pdf": false}'::jsonb, 30, true),

-- ============================================================
-- TELEFONIA (9)
-- ============================================================
('Números OSIPTEL por DNI', 'Numeros y titular via OSIPTEL Online.',
 'telefonia', 'dni', 'ghostdataxxx', '/telp {valor}',
 10, 10, null, '{"texto": true, "pdf": false}'::jsonb, 10, true),

('Números OSIPTEL por Teléfono', 'Numeros y titular via OSIPTEL Online.',
 'telefonia', 'telefono', 'ghostdataxxx', '/telp {valor}',
 10, 10, null, '{"texto": true, "pdf": false}'::jsonb, 20, true),

('Claro Online', 'Titular por numero CLARO online.',
 'telefonia', 'telefono', 'ghostdataxxx', '/claro {valor}',
 5, 5, null, '{"texto": true, "pdf": false}'::jsonb, 30, true),

('Bitel', 'Titular por numero BITEL online.',
 'telefonia', 'telefono', 'ghostdataxxx', '/bitel {valor}',
 5, 5, null, '{"texto": true, "pdf": false}'::jsonb, 40, true),

('Movistar', 'Titular por numero MOVISTAR online.',
 'telefonia', 'telefono', 'ghostdataxxx', '/movistar {valor}',
 5, 5, null, '{"texto": true, "pdf": false}'::jsonb, 50, true),

('Entel por DNI', 'Numeros y titular via ENTEL online.',
 'telefonia', 'dni', 'ghostdataxxx', '/entel {valor}',
 5, 5, null, '{"texto": true, "pdf": false}'::jsonb, 60, true),

('Entel por Teléfono', 'Numeros y titular via ENTEL online.',
 'telefonia', 'telefono', 'ghostdataxxx', '/entel {valor}',
 5, 5, null, '{"texto": true, "pdf": false}'::jsonb, 70, true),

('OSIPTEL Líneas por DNI', 'Lineas y operadores de numeros en OSIPTEL Online.',
 'telefonia', 'dni', 'ghostdataxxx', '/lineas {valor}',
 5, 5, null, '{"texto": true, "pdf": false}'::jsonb, 80, true),

('OSIPTEL Operador por Teléfono', 'Lineas y operadores de numeros en OSIPTEL Online.',
 'telefonia', 'telefono', 'ghostdataxxx', '/operador {valor}',
 5, 5, null, '{"texto": true, "pdf": false}'::jsonb, 90, true),

-- ============================================================
-- SUNARP (4)
-- ============================================================
('Sunarp Propiedades por DNI', 'Datos propiedades via Sunarp online.',
 'sunarp', 'dni', 'ghostdataxxx', '/pro {valor}',
 5, 5, null, '{"texto": true, "pdf": false}'::jsonb, 10, true),

('Sunarp Propiedades por RUC', 'Datos propiedades via Sunarp online.',
 'sunarp', 'ruc', 'ghostdataxxx', '/pro {valor}',
 5, 5, null, '{"texto": true, "pdf": false}'::jsonb, 20, true),

('Sunarp Propiedades PDF', 'Datos propiedades via Sunarp online.',
 'sunarp', 'dni', 'ghostdataxxx', '/propdf {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 30, true),

('Sunarp Partidas', 'Datos partidas via Sunarp online. Formato: numeroPartida|ciudad|tipo.',
 'sunarp', 'texto', 'ghostdataxxx', '/partida {valor}',
 10, 10, null, '{"texto": true, "pdf": false}'::jsonb, 40, true),

-- ============================================================
-- SUNAT (7)
-- ============================================================
('Sunat por DNI', 'Datos empresa via Sunat online.',
 'sunat', 'dni', 'ghostdataxxx', '/sunat {valor}',
 10, 10, null, '{"texto": true, "pdf": false}'::jsonb, 10, true),

('Sunat por RUC', 'Datos empresa via Sunat online.',
 'sunat', 'ruc', 'ghostdataxxx', '/sunat {valor}',
 10, 10, null, '{"texto": true, "pdf": false}'::jsonb, 20, true),

('Sunat Consumos por DNI', 'Datos consumos via Sunat online.',
 'sunat', 'dni', 'ghostdataxxx', '/consumos {valor}',
 15, 15, null, '{"texto": true, "pdf": false}'::jsonb, 30, true),

('Sunat Consumos por RUC', 'Datos consumos via Sunat online.',
 'sunat', 'ruc', 'ghostdataxxx', '/consumos {valor}',
 15, 15, null, '{"texto": true, "pdf": false}'::jsonb, 40, true),

('Reporte Tributario', 'Reporte tributario via Sunat online.',
 'sunat', 'dni', 'ghostdataxxx', '/reptrib {valor}',
 10, 10, null, '{"texto": true, "pdf": false}'::jsonb, 50, true),

('Sunat Trabajos', 'Datos trabajos via Sunat Online.',
 'sunat', 'dni', 'ghostdataxxx', '/tra {valor}',
 3, 3, null, '{"texto": true, "pdf": false}'::jsonb, 60, true),

('Sunat Sueldos', 'Datos sueldos via Sunat Online.',
 'sunat', 'dni', 'ghostdataxxx', '/suel {valor}',
 3, 3, null, '{"texto": true, "pdf": false}'::jsonb, 70, true),

-- ============================================================
-- FINANCIERO (1)
-- ============================================================
('Reporte SBS PDF', 'Datos via Sbs online.',
 'financiero', 'dni', 'ghostdataxxx', '/sbsvp {valor}',
 20, 20, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

-- ============================================================
-- JUSTICIA (6)  →  categoria = 'delitos'
-- ============================================================
('Fiscalía Online PDF', 'Casos fiscales via MPFN online.',
 'delitos', 'dni', 'ghostdataxxx', '/fiscapdf {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

('Denuncias Online', 'Denuncias via PNP online.',
 'delitos', 'dni', 'ghostdataxxx', '/denuncias {valor}',
 25, 25, null, '{"texto": true, "pdf": false}'::jsonb, 20, true),

('Denuncias por Placa', 'Denuncias via PNP online.',
 'delitos', 'placa', 'ghostdataxxx', '/denpla {valor}',
 10, 10, null, '{"texto": true, "pdf": false}'::jsonb, 30, true),

('Requisitoria por DNI', 'Requisitoria via PNP online.',
 'delitos', 'dni', 'ghostdataxxx', '/rq {valor}',
 10, 10, null, '{"texto": true, "pdf": false}'::jsonb, 40, true),

('Requisitoria por Placa', 'Requisito via PNP online.',
 'delitos', 'placa', 'ghostdataxxx', '/rqv {valor}',
 10, 10, null, '{"texto": true, "pdf": false}'::jsonb, 50, true),

('Multas Electorales (Foto)', 'Foto de multas electorales.',
 'delitos', 'dni', 'ghostdataxxx', '/jne {valor}',
 5, 5, null, '{"texto": true, "imagenes": 1}'::jsonb, 60, true),

-- ============================================================
-- INTERNACIONAL (2)  →  categoria = 'migraciones'
-- ============================================================
('Migraciones DNI PDF', 'Datos migraciones via Reniec online.',
 'migraciones', 'dni', 'ghostdataxxx', '/migra {valor}',
 30, 30, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

('Migraciones por CE PDF', 'Datos migraciones via Reniec online.',
 'migraciones', 'texto', 'ghostdataxxx', '/migrace {valor}',
 30, 30, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

-- ============================================================
-- ESTUDIOS (2)
-- ============================================================
('Minedu Online PDF', 'Datos certificado MINEDU online.',
 'estudios', 'dni', 'ghostdataxxx', '/minedu {valor}',
 25, 25, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

('Consulta Sunedu', 'Datos via Sunedu online.',
 'estudios', 'dni', 'ghostdataxxx', '/sunedupdf {valor}',
 10, 10, null, '{"texto": true, "pdf": true}'::jsonb, 20, true),

-- ============================================================
-- MTC (1)
-- ============================================================
('MTC Licencia PDF', 'Datos certificado MTC online.',
 'mtc', 'dni', 'ghostdataxxx', '/mtc {valor}',
 15, 15, null, '{"texto": true, "pdf": true}'::jsonb, 10, true),

-- ============================================================
-- SEEKER (2)
-- ============================================================
('Búsqueda por Correo (DNI)', 'Datos via Meta Data DataBase.',
 'seeker', 'dni', 'ghostdataxxx', '/cor {valor}',
 3, 3, null, '{"texto": true, "pdf": false}'::jsonb, 10, true),

('Búsqueda por Correo (Email)', 'Datos via Meta Data DataBase.',
 'seeker', 'texto', 'ghostdataxxx', '/cor {valor}',
 3, 3, null, '{"texto": true, "pdf": false}'::jsonb, 20, true);

commit;

-- ============================================================
-- Verificación post-ejecución
-- ============================================================
select categoria, count(*) as consultas, bool_and(bot_id = 'ghostdataxxx') as todas_ghostdataxxx
from public.consultas_catalog
where categoria in (
  'reniec', 'familiares', 'telefonia', 'sunarp', 'sunat', 'financiero',
  'delitos', 'migraciones', 'estudios', 'mtc', 'seeker',
  'certificados', 'actas', 'vip', 'facial'
)
group by categoria
order by categoria;
