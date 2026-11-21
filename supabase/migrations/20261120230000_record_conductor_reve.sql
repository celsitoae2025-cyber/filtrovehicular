-- Récord de Conductor usa /reve en @LainDaata_Bot.
-- Conserva los identificadores, precios y registros de las consultas existentes.
begin;

update public.consultas_catalog
set bot_id = 'laindata',
    comando = '/reve {valor}'
where categoria in ('filter', 'vehiculos', 'mtc')
  and (id = 'be76ab5e-766d-4626-88b5-172bc3defb26'
       or nombre ~* 'r[ée]cord\s+de\s+conductor');

commit;
