-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Tabla para guardar suscripciones de Web Push Notifications

CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    keys JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: lectura y escritura pública (Edge Function y admin necesitan acceso)
CREATE POLICY "Acceso completo push_subscriptions" ON push_subscriptions
    FOR ALL USING (true) WITH CHECK (true);
