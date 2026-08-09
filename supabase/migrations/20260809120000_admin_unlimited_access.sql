-- ============================================================
-- ADMIN — acceso total sin límites
--
-- Objetivo: que las cuentas administradoras tengan acceso ilimitado,
-- sin descuento de créditos ni restricción de categorías. Hoy los
-- admins pagan créditos igual que cualquier usuario; esto lo corrige.
--
-- Qué hace:
--   1) Marca juandevillar80@gmail.com como admin (is_admin = true).
--   2) Reescribe consume_credits para que, si quien llama es admin,
--      la consulta pase siempre y con costo 0 (no toca su saldo ni
--      aplica la restricción de categorías de usuarios free).
--
-- El bypass es por rol (is_admin = true), así aplica a cualquier
-- administrador presente o futuro, no solo a este correo.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================


-- ===== 1) Conceder admin al correo indicado =====
-- Nota: el usuario debe existir en auth.users (haber iniciado sesión al
-- menos una vez). Si aún no existe, corre este bloque después del alta.
UPDATE public.profiles p
   SET is_admin = true,
       updated_at = now()
  FROM auth.users u
 WHERE u.id = p.id
   AND lower(u.email) = lower('juandevillar80@gmail.com');


-- ===== 2) consume_credits — bypass total para administradores =====
CREATE OR REPLACE FUNCTION public.consume_credits(
  cost integer,
  module_name text,
  q_type text,
  q_input text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
  sub_expires     timestamptz;
  caller_paid     boolean;
  caller_admin    boolean;
  is_subscribed   boolean;
  consulta_id     uuid;
  effective_cost  integer;
  ALLOWED_FREE    constant text[] := array['filter'];
BEGIN
  SELECT credits_balance, subscription_expires_at, has_paid_credits, is_admin
    INTO current_balance, sub_expires, caller_paid, caller_admin
    FROM public.profiles WHERE id = auth.uid()
    FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  is_subscribed := sub_expires IS NOT NULL AND sub_expires > now();

  -- ── Administrador: acceso total. Sin restricción de categoría, sin
  --    cobro y sin tocar el saldo. Se registra la consulta con costo 0. ──
  IF coalesce(caller_admin, false) THEN
    INSERT INTO public.consultas (user_id, module, type, input, cost, status)
    VALUES (auth.uid(), module_name, q_type, q_input, 0, 'pending')
    RETURNING id INTO consulta_id;
    RETURN consulta_id;
  END IF;

  -- Restricción para usuarios free (solo categoría filter)
  IF NOT coalesce(caller_paid, false)
     AND NOT is_subscribed
     AND NOT (lower(module_name) = ANY(ALLOWED_FREE)) THEN
    RAISE EXCEPTION 'Esta categoría se desbloquea con tu primera recarga. Tus créditos de bienvenida solo aplican en la sección "Tipo de consulta" del inicio.';
  END IF;

  IF is_subscribed THEN
    effective_cost := 0;
  ELSE
    IF current_balance < cost THEN
      RAISE EXCEPTION 'Créditos insuficientes';
    END IF;
    effective_cost := cost;

    -- Señalar al trigger que este UPDATE es una operación interna de confianza
    PERFORM set_config('app.internal_profile_update', 'true', true);
    UPDATE public.profiles
       SET credits_balance = credits_balance - cost,
           updated_at = now()
     WHERE id = auth.uid();
  END IF;

  INSERT INTO public.consultas (user_id, module, type, input, cost, status)
  VALUES (auth.uid(), module_name, q_type, q_input, effective_cost, 'pending')
  RETURNING id INTO consulta_id;

  IF effective_cost > 0 THEN
    INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (auth.uid(), 'consultation', -effective_cost, module_name || ' / ' || q_type);
  END IF;

  RETURN consulta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_credits(integer, text, text, text) TO authenticated;


-- ===== Verificación (opcional) =====
-- Confirmar que el correo quedó como admin:
--   select u.email, p.is_admin
--     from public.profiles p join auth.users u on u.id = p.id
--    where lower(u.email) = 'juandevillar80@gmail.com';
