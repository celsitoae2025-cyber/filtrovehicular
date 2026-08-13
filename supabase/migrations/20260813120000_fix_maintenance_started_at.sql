-- ============================================================
-- FIX — set_maintenance pisaba started_at en cada llamada
--
-- set_maintenance() sellaba 'started_at' = now() cada vez que se
-- invocaba con enabled_in = true, sin importar si el mantenimiento
-- ya estaba activo. Como "Guardar mensaje" reenvía el enabled_in
-- actual sin cambiarlo (js/admin/maintenance.js → guardarMensaje),
-- editar el aviso mientras el mantenimiento estaba activo borraba la
-- hora real de inicio y la reemplazaba por la del guardado.
--
-- Ahora solo se sella una hora nueva al pasar de apagado → encendido;
-- si ya estaba activo, se conserva el started_at original.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_maintenance(
  enabled_in boolean,
  message_in text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_admin boolean;
  actual       jsonb;
  was_enabled  boolean;
  prev_started timestamptz;
  nuevo        jsonb;
BEGIN
  SELECT p.is_admin INTO caller_admin
    FROM public.profiles p
   WHERE p.id = auth.uid();

  IF caller_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el modo mantenimiento';
  END IF;

  SELECT value INTO actual FROM public.app_settings WHERE key = 'maintenance';
  was_enabled  := COALESCE((actual ->> 'enabled')::boolean, false);
  prev_started := NULLIF(actual ->> 'started_at', '')::timestamptz;

  nuevo := jsonb_build_object(
    'enabled', COALESCE(enabled_in, false),
    'message', COALESCE(NULLIF(btrim(message_in), ''), ''),
    -- Nueva hora solo al activar de verdad (apagado → encendido);
    -- si ya estaba activo, se conserva la hora original.
    'started_at', CASE
                     WHEN COALESCE(enabled_in, false) AND NOT was_enabled
                       THEN to_jsonb(now())
                     WHEN COALESCE(enabled_in, false) AND was_enabled
                       THEN to_jsonb(prev_started)
                     ELSE 'null'::jsonb
                   END
  );

  INSERT INTO public.app_settings (key, value, updated_at, updated_by)
  VALUES ('maintenance', nuevo, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_at = now(),
         updated_by = auth.uid();

  RETURN nuevo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_maintenance(boolean, text) TO authenticated;
