-- Renombra "Árbol Genealógico VP" a "Árbol Genealógico Visual" en el
-- catálogo (el bot mismo llama a esta consulta "ARBOL GENEALOGICO VISUAL"
-- en su respuesta, así que el nombre queda alineado). Solo cambia el
-- nombre visible; el comando /agvp no se toca.
--
-- Correr UNA VEZ en Supabase → SQL Editor.

update public.consultas_catalog
set nombre = 'Árbol Genealógico Visual'
where comando = '/agvp {valor}'
  and bot_id = 'ghostdataxxx';
