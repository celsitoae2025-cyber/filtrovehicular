-- ============================================================
-- AVISO A LOS CLIENTES — interruptor propio, independiente
--
-- Permite al administrador encender un aviso dentro de la aplicación:
-- una cinta que ven todos los usuarios, con un botón para escribir a
-- soporte por WhatsApp. Pensado para cuando un servicio falla y hay que
-- decírselo a la gente antes de que lo descubran por su cuenta.
--
-- NO TIENE NADA QUE VER CON EL MODO MANTENIMIENTO. Aquel apaga la
-- plataforma entera; este solo informa y la aplicación sigue funcionando
-- con normalidad. Son dos interruptores distintos, cada uno con su fila
-- y sus funciones: encender uno no toca al otro.
--
-- Qué crea:
--   1) La fila 'aviso_clientes' en public.app_settings (la tabla ya
--      existe desde el modo mantenimiento, con su RLS: lectura para
--      todos, escritura solo para administradores).
--   2) RPC set_aviso_clientes(...) — enciende, apaga o edita el texto.
--   3) RPC get_aviso_clientes() — lectura ligera para la aplicación.
--
-- Idempotente: se puede ejecutar las veces que haga falta.
-- ============================================================


-- ===== 1) Fila de configuración =====
-- La tabla se crea aquí también por si esta migración corre sola en una
-- base nueva. Si ya existe, no se toca.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ON CONFLICT DO NOTHING: si el aviso ya estaba configurado, esta
-- migración no puede pisarlo ni apagarlo.
INSERT INTO public.app_settings (key, value)
VALUES ('aviso_clientes', jsonb_build_object(
          'enabled', false,
          'titulo',  '',
          'mensaje', '',
          'cta',     true,
          'version', NULL,
          'activado_en', NULL
        ))
ON CONFLICT (key) DO NOTHING;


-- ===== 2) Encender / apagar / editar (solo administradores) =====
CREATE OR REPLACE FUNCTION public.set_aviso_clientes(
  enabled_in boolean,
  titulo_in  text DEFAULT NULL,
  mensaje_in text DEFAULT NULL,
  cta_in     boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_admin boolean;
  titulo       text;
  mensaje      text;
  nuevo        jsonb;
BEGIN
  SELECT p.is_admin INTO caller_admin
    FROM public.profiles p
   WHERE p.id = auth.uid();

  IF caller_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el aviso a los clientes';
  END IF;

  -- Se recortan a lo que la cinta puede mostrar sin romperse.
  titulo  := left(COALESCE(NULLIF(btrim(titulo_in),  ''), ''), 90);
  mensaje := left(COALESCE(NULLIF(btrim(mensaje_in), ''), ''), 400);

  -- Encender un aviso vacío dejaría una cinta muda en la aplicación de
  -- todos los clientes. Mejor fallar aquí que publicarlo así.
  IF COALESCE(enabled_in, false) AND mensaje = '' THEN
    RAISE EXCEPTION 'El aviso necesita un mensaje antes de encenderse';
  END IF;

  nuevo := jsonb_build_object(
    'enabled', COALESCE(enabled_in, false),
    'titulo',  titulo,
    'mensaje', mensaje,
    'cta',     COALESCE(cta_in, true),
    -- `version` sella CADA cambio. La aplicación la usa para saber si un
    -- cliente que cerró la cinta ya la vio o si esto es algo nuevo que
    -- tiene que volver a mostrarle.
    'version', to_jsonb(now()),
    'activado_en', CASE WHEN COALESCE(enabled_in, false)
                        THEN to_jsonb(now())
                        ELSE 'null'::jsonb END
  );

  INSERT INTO public.app_settings (key, value, updated_at, updated_by)
  VALUES ('aviso_clientes', nuevo, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_at = now(),
         updated_by = auth.uid();

  RETURN nuevo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_aviso_clientes(boolean, text, text, boolean) TO authenticated;


-- ===== 3) Lectura (abierta) =====
-- Abierta a anon a propósito: el aviso tiene que poder verse aunque la
-- sesión todavía no se haya restaurado.
CREATE OR REPLACE FUNCTION public.get_aviso_clientes()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.app_settings WHERE key = 'aviso_clientes'),
    jsonb_build_object('enabled', false, 'titulo', '', 'mensaje', '',
                       'cta', true, 'version', NULL, 'activado_en', NULL)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_aviso_clientes() TO anon, authenticated;
