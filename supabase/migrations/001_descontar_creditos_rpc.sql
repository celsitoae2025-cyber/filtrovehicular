-- RPC para descuento atómico de créditos
-- Ejecutar en Supabase SQL Editor para crear la función
CREATE OR REPLACE FUNCTION descontar_creditos(p_email TEXT, p_cantidad INT)
RETURNS JSON AS $$
DECLARE
    v_creditos INT;
    v_nuevo_saldo INT;
BEGIN
    -- Bloquear la fila para evitar race conditions
    SELECT creditos INTO v_creditos
    FROM saldos
    WHERE email = p_email
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'error', 'Usuario no encontrado');
    END IF;

    IF v_creditos < p_cantidad THEN
        RETURN json_build_object('ok', false, 'error', 'Saldo insuficiente', 'creditos', v_creditos);
    END IF;

    v_nuevo_saldo := v_creditos - p_cantidad;

    UPDATE saldos
    SET creditos = v_nuevo_saldo, updated_at = NOW()
    WHERE email = p_email;

    RETURN json_build_object('ok', true, 'creditos', v_nuevo_saldo);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
