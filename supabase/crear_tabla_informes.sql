-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor > New Query)

CREATE TABLE IF NOT EXISTS informes (
    placa TEXT PRIMARY KEY,
    datos JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE informes ENABLE ROW LEVEL SECURITY;

-- Política: permitir todo (igual que solicitudes)
CREATE POLICY "Permitir todo en informes" ON informes
    FOR ALL USING (true) WITH CHECK (true);

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_informes_updated ON informes (updated_at DESC);
