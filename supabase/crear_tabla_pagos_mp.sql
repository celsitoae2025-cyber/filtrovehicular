-- Tabla para registrar pagos de MercadoPago (idempotencia + historial)
CREATE TABLE IF NOT EXISTS pagos_mp (
    id              BIGSERIAL PRIMARY KEY,
    payment_id      TEXT UNIQUE NOT NULL,
    email           TEXT NOT NULL,
    plan            TEXT NOT NULL,
    credits         INTEGER DEFAULT 0,
    amount          NUMERIC(10,2) NOT NULL,
    status          TEXT NOT NULL DEFAULT 'approved',
    type            TEXT NOT NULL,
    mp_payer_email  TEXT DEFAULT '',
    mp_payment_method TEXT DEFAULT '',
    mp_date_approved TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indice por email para consultas rapidas
CREATE INDEX IF NOT EXISTS idx_pagos_mp_email ON pagos_mp(email);

-- Indice unico por payment_id (idempotencia)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagos_mp_payment_id ON pagos_mp(payment_id);

-- Habilitar RLS
ALTER TABLE pagos_mp ENABLE ROW LEVEL SECURITY;

-- Politica: solo el service_role puede insertar/leer (desde Edge Functions)
CREATE POLICY "Service role full access" ON pagos_mp
    FOR ALL USING (auth.role() = 'service_role');
