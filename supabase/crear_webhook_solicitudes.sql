-- Ejecutar en Supabase SQL Editor DESPUÉS de desplegar la Edge Function
-- Esto crea un Database Webhook que dispara notify-admin automáticamente
-- cuando se inserta una nueva solicitud (respaldo server-side)

-- NOTA: También puedes crear el webhook desde el Dashboard:
-- Database > Webhooks > Create > Table: solicitudes > Event: INSERT
-- Type: Supabase Edge Function > Function: notify-admin

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Crear función que llama a la Edge Function
CREATE OR REPLACE FUNCTION notify_admin_on_new_solicitud()
RETURNS TRIGGER AS $$
DECLARE
    edge_url TEXT;
    anon_key TEXT;
    payload JSONB;
BEGIN
    -- URL de tu proyecto Supabase
    edge_url := 'https://xojgpfbpomjxpyytmczg.supabase.co/functions/v1/notify-admin';

    -- Anon key (la misma que usa el frontend)
    anon_key := current_setting('app.settings.anon_key', true);

    -- Construir payload compatible con la Edge Function
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'solicitudes',
        'record', jsonb_build_object(
            'placa', NEW.placa,
            'datos', NEW.datos
        )
    );

    -- Enviar HTTP POST a la Edge Function (fire-and-forget)
    PERFORM extensions.http_post(
        edge_url,
        payload::TEXT,
        'application/json'
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- No bloquear la inserción si falla la notificación
    RAISE WARNING 'notify_admin webhook failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger solo en INSERT (no en UPDATE para evitar duplicados)
DROP TRIGGER IF EXISTS trigger_notify_admin ON solicitudes;
CREATE TRIGGER trigger_notify_admin
    AFTER INSERT ON solicitudes
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_on_new_solicitud();
