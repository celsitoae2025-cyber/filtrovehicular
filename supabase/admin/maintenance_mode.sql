-- ============================================================
-- MODO MANTENIMIENTO — interruptor global
--
-- Permite al administrador poner la plataforma en mantenimiento: los
-- usuarios ven un aviso a pantalla completa y no pueden operar, mientras
-- los administradores siguen trabajando con normalidad.
--
-- Qué crea:
--   1) Tabla public.app_settings — configuración global (clave/valor).
--   2) RLS: cualquiera puede LEER la configuración (el aviso debe verse
--      incluso sin sesión iniciada); solo los admins pueden ESCRIBIR.
--   3) RPC set_maintenance(enabled, message) — cambia el estado y deja
--      registro de quién y cuándo. Valida que quien llama sea admin.
--   4) RPC get_maintenance() — lectura ligera para el front.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================


-- ===== 1) Tabla de configuración global =====
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Fila del modo mantenimiento (no se pisa si ya existe)
INSERT INTO public.app_settings (key, value)
VALUES ('maintenance', jsonb_build_object(
          'enabled', false,
          'message', '',
          'started_at', NULL
        ))
ON CONFLICT (key) DO NOTHING;


-- ===== 2) RLS =====
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Lectura para todos: el aviso debe verse aunque no haya sesión.
DROP POLICY IF EXISTS app_settings_read_all ON public.app_settings;
CREATE POLICY app_settings_read_all
  ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escritura solo para administradores.
DROP POLICY IF EXISTS app_settings_write_admin ON public.app_settings;
CREATE POLICY app_settings_write_admin
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
             WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
             WHERE p.id = auth.uid() AND p.is_admin = true)
  );

GRANT SELECT ON public.app_settings TO anon, authenticated;


-- ===== 3) Cambiar el estado (solo admins) =====
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
  nuevo        jsonb;
BEGIN
  SELECT p.is_admin INTO caller_admin
    FROM public.profiles p
   WHERE p.id = auth.uid();

  IF caller_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el modo mantenimiento';
  END IF;

  nuevo := jsonb_build_object(
    'enabled', COALESCE(enabled_in, false),
    'message', COALESCE(NULLIF(btrim(message_in), ''), ''),
    -- Al activar se sella la hora de inicio; al desactivar se limpia.
    'started_at', CASE WHEN COALESCE(enabled_in, false)
                       THEN to_jsonb(now())
                       ELSE 'null'::jsonb END
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


-- ===== 4) Lectura del estado (abierta) =====
CREATE OR REPLACE FUNCTION public.get_maintenance()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.app_settings WHERE key = 'maintenance'),
    jsonb_build_object('enabled', false, 'message', '', 'started_at', NULL)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_maintenance() TO anon, authenticated;
