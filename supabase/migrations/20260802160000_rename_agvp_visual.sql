-- Renombra "Árbol Genealógico VP" a "Árbol Genealógico Visual".
-- El propio bot llama a esta consulta "ARBOL GENEALOGICO VISUAL - PDF" en su
-- respuesta, y devuelve un PDF adjunto (confirmado contra el bot real), así
-- que también se corrige respuesta_formato.pdf, que estaba en false.
-- El comando /agvp no cambia.

update public.consultas_catalog
set nombre = 'Árbol Genealógico Visual',
    descripcion = 'Arbol genealogico visual (PDF) via Reniec online.',
    respuesta_formato = '{"texto": true, "pdf": true}'::jsonb
where comando = '/agvp {valor}'
  and bot_id = 'ghostdataxxx';
