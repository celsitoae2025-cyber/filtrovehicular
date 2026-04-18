-- Tabla para códigos de verificación por email
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS codigos_verificacion (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  codigo TEXT NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  intentos INT DEFAULT 0,
  verificado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas rápidas por email
CREATE INDEX IF NOT EXISTS idx_codigos_email ON codigos_verificacion(email);

-- Limpiar códigos expirados automáticamente (cada hora)
-- Nota: Supabase no tiene cron nativo en plan free.
-- Alternativa: la Edge Function limpia códigos viejos al insertar uno nuevo.

-- Permisos: solo el service_role puede leer/escribir esta tabla
-- (las Edge Functions usan service_role_key, así que funciona automáticamente).
-- RLS: denegar acceso anónimo
ALTER TABLE codigos_verificacion ENABLE ROW LEVEL SECURITY;

-- No crear ninguna policy = nadie con anon key puede acceder.
-- Solo service_role (usado por Edge Functions) tiene acceso.
