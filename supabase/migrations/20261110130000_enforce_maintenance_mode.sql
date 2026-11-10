-- Enforce the existing global maintenance switch before a consultation can
-- reserve credits or be claimed for delivery. Administrators remain exempt.

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
  maintenance_on boolean;
  maintenance_config jsonb;
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

  IF NOT coalesce(caller_admin, false) THEN
    SELECT value
      INTO maintenance_config
      FROM public.app_settings
     WHERE key = 'maintenance'
       FOR SHARE;

    IF NOT FOUND OR jsonb_typeof(maintenance_config) IS DISTINCT FROM 'object'
       OR jsonb_typeof(maintenance_config -> 'enabled') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'MANTENIMIENTO_NO_DISPONIBLE';
    END IF;
    maintenance_on := (maintenance_config ->> 'enabled')::boolean;
    IF maintenance_on THEN
      RAISE EXCEPTION 'MANTENIMIENTO_ACTIVO';
    END IF;
  END IF;

  is_subscribed := sub_expires IS NOT NULL AND sub_expires > now();

  IF coalesce(caller_admin, false) THEN
    INSERT INTO public.consultas (user_id, module, type, input, cost, status)
    VALUES (auth.uid(), module_name, q_type, q_input, 0, 'pending')
    RETURNING id INTO consulta_id;
    RETURN consulta_id;
  END IF;

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

CREATE OR REPLACE FUNCTION public.bridge_claim_consulta(
  p_consulta_id uuid,
  p_user_id     uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_user         uuid;
  c_status       text;
  c_cost         integer;
  c_created      timestamptz;
  caller_admin   boolean;
  maintenance_on boolean;
  maintenance_config jsonb;
BEGIN
  SELECT user_id, status, cost, created_at
    INTO c_user, c_status, c_cost, c_created
    FROM public.consultas
   WHERE id = p_consulta_id
     FOR UPDATE;

  IF c_user IS NULL THEN
    RAISE EXCEPTION 'CONSULTA_NO_ENCONTRADA';
  END IF;
  IF c_user <> p_user_id THEN
    RAISE EXCEPTION 'CONSULTA_AJENA';
  END IF;

  SELECT coalesce(is_admin, false)
    INTO caller_admin
    FROM public.profiles
   WHERE id = p_user_id;

  IF NOT coalesce(caller_admin, false) THEN
    SELECT value
      INTO maintenance_config
      FROM public.app_settings
     WHERE key = 'maintenance'
       FOR SHARE;
    IF NOT FOUND OR jsonb_typeof(maintenance_config) IS DISTINCT FROM 'object'
       OR jsonb_typeof(maintenance_config -> 'enabled') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'MANTENIMIENTO_NO_DISPONIBLE';
    END IF;
    maintenance_on := (maintenance_config ->> 'enabled')::boolean;
    IF maintenance_on THEN
      RAISE EXCEPTION 'MANTENIMIENTO_ACTIVO';
    END IF;
  END IF;

  IF c_status <> 'pending' THEN
    RAISE EXCEPTION 'CONSULTA_YA_USADA';
  END IF;
  IF c_created < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'CONSULTA_CADUCADA';
  END IF;

  UPDATE public.consultas
     SET status = 'in_flight'
   WHERE id = p_consulta_id;

  RETURN coalesce(c_cost, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.bridge_claim_consulta(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.bridge_claim_consulta(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bridge_claim_consulta(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_claim_consulta(uuid, uuid) TO service_role;
