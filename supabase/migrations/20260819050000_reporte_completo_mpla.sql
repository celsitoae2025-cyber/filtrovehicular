-- ============================================================
-- Reporte Completo — cambia de comando y de bot
--
-- Pasa de `/metapla` en `fuentesdata` a `/mpla` en `ghostdataxxx`
-- (@GHOSTDATAXXX_BOT). El precio y el formato de respuesta no se tocan.
--
-- Se deja el `auto_click` como está —«Descargar Reporte PDF»—: era el
-- botón del bot anterior y puede que el nuevo lo llame de otra forma. No
-- rompe nada si no existe: el bridge avisa por consola y devuelve lo que
-- haya llegado (ver sendCommandWithAutoClick en telegram-client.js). En
-- cuanto se vea una respuesta real de /mpla se ajusta la etiqueta, y con
-- ella el lector de js/modules/metapla-report.js, que está escrito
-- contra la salida del bot viejo.
--
-- Va por id: es la única fila con este comando, pero el id no se presta
-- a confusiones.
--
-- Para revertirlo:
--   update public.consultas_catalog
--      set comando = '/metapla {valor}', bot_id = 'fuentesdata'
--    where id = '17848845-281d-4264-b48d-f7b914f20a09';
-- ============================================================

update public.consultas_catalog
   set comando = '/mpla {valor}',
       bot_id  = 'ghostdataxxx'
 where id = '17848845-281d-4264-b48d-f7b914f20a09'
   and comando = '/metapla {valor}';
