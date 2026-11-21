-- Actualiza las siete consultas Reniec existentes para @LainDaata_Bot.
-- Mantiene sus UUID, categoría, orden, precios, tipo de dato y formato.
begin;

update public.consultas_catalog as catalogo
   set comando = cambios.comando,
       bot_id = 'laindata',
       nombre = case
         when catalogo.id = '7291440a-12f1-4213-9f4f-b789a6686ff0'::uuid
           then 'DNI Digital Azul/Amarillo (Foto)'
         else catalogo.nombre
       end,
       updated_at = now()
  from (values
    ('7fa694be-01a7-4c41-9505-3582c14a84be'::uuid, '/dnion {valor}'),
    ('525e1119-a4d0-40ba-a5a8-e8480d97bd7f'::uuid, '/nmd {valor}'),
    ('322bb7c5-3cdd-4306-8316-2c0c17255edc'::uuid, '/c4aon {valor}'),
    ('ca089bcc-79ff-4e9c-b02e-6111d3ce306e'::uuid, '/c4bon {valor}'),
    ('947e99ae-a37c-4188-8e63-6d95716fb876'::uuid, '/c4ion {valor}'),
    ('7291440a-12f1-4213-9f4f-b789a6686ff0'::uuid, '/dnivon {valor}'),
    ('97524019-1871-4d68-9ad5-31f1d1327d9f'::uuid, '/dnieon {valor}')
  ) as cambios(id, comando)
 where catalogo.id = cambios.id
   and catalogo.categoria = 'reniec';

commit;
