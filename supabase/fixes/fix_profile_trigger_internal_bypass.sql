-- ============================================================
-- FIX: enforce_profile_update bloqueaba RPCs internas (security definer)
--
-- Problema: consume_credits / refund_consulta / mark_user_paid son
-- funciones SECURITY DEFINER que modifican campos restringidos de
-- profiles (credits_balance, has_paid_credits). El trigger veía que
-- auth.uid() no era null (el JWT del usuario sigue activo) y lanzaba
-- "No autorizado a modificar campos restringidos".
--
-- Solución: usar set_config() para que las funciones internas señalen
-- que el UPDATE es de confianza. El trigger lo detecta y hace bypass.
-- La variable es transaction-local (tercer arg = true), se resetea sola.
--
-- Ejecutar UNA VEZ en SQL Editor de Supabase. Idempotente.
-- ============================================================


-- ===== 1. Reescribir el trigger con bypass interno =====
CREATE OR REPLACE FUNCTION public.enforce_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass para: service role (sin JWT), admins, o RPCs internas de confianza.
  IF auth.uid() IS NULL
     OR public.is_current_user_admin()
     OR coalesce(current_setting('app.internal_profile_update', true), '') = 'true'
  THEN
    PERFORM set_config('app.internal_profile_update', 'false', true);
    new.updated_at := now();
    RETURN new;
  END IF;

  -- Usuarios normales solo pueden editar su propio perfil.
  IF auth.uid() <> new.id THEN
    RAISE EXCEPTION 'Solo puedes modificar tu propio perfil';
  END IF;

  -- Campos críticos: solo modificables por RPCs internas o admins.
  IF new.credits_balance <> old.credits_balance
     OR coalesce(new.is_admin, false) <> coalesce(old.is_admin, false)
     OR new.status <> old.status
     OR new.subscription_tier IS DISTINCT FROM old.subscription_tier
     OR new.subscription_plan_id IS DISTINCT FROM old.subscription_plan_id
     OR new.subscription_expires_at IS DISTINCT FROM old.subscription_expires_at
     OR new.subscription_started_at IS DISTINCT FROM old.subscription_started_at
     OR new.has_paid_credits IS DISTINCT FROM old.has_paid_credits
  THEN
    RAISE EXCEPTION 'No autorizado a modificar campos restringidos';
  END IF;

  new.updated_at := now();
  RETURN new;
END;
$$;


-- ===== 2. consume_credits — señalar antes del UPDATE interno =====
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
  is_subscribed   boolean;
  consulta_id     uuid;
  effective_cost  integer;
  ALLOWED_FREE    constant text[] := array['filter'];
BEGIN
  SELECT credits_balance, subscription_expires_at, has_paid_credits
    INTO current_balance, sub_expires, caller_paid
    FROM public.profiles WHERE id = auth.uid()
    FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  is_subscribed := sub_expires IS NOT NULL AND sub_expires > now();

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


-- ===== 3. refund_consulta — señalar antes del UPDATE interno =====
CREATE OR REPLACE FUNCTION public.refund_consulta(
  consulta_id uuid,
  reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_user   uuid;
  c_cost   integer;
  c_status text;
  c_module text;
  c_type   text;
BEGIN
  SELECT user_id, cost, status, module, type
    INTO c_user, c_cost, c_status, c_module, c_type
    FROM public.consultas
    WHERE id = consulta_id
    FOR UPDATE;

  IF c_user IS NULL THEN
    RAISE EXCEPTION 'Consulta no encontrada';
  END IF;

  IF c_user <> auth.uid() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF c_status <> 'pending' THEN
    RETURN; -- idempotente
  END IF;

  UPDATE public.consultas
     SET status = 'error',
         error_message = coalesce(reason, 'Bot no respondió o devolvió error')
   WHERE id = consulta_id;

  IF c_cost IS NULL OR c_cost <= 0 THEN
    RETURN;
  END IF;

  -- Señalar al trigger que este UPDATE es una operación interna de confianza
  PERFORM set_config('app.internal_profile_update', 'true', true);
  UPDATE public.profiles
     SET credits_balance = credits_balance + c_cost,
         updated_at = now()
   WHERE id = auth.uid();

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (auth.uid(), 'refund', c_cost,
          'Reembolso ' || c_module || ' / ' || coalesce(c_type, '') ||
          CASE WHEN reason IS NOT NULL THEN ' — ' || reason ELSE '' END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_consulta(uuid, text) TO authenticated;


-- ===== 4. mark_user_paid — señalar antes del UPDATE interno =====
CREATE OR REPLACE FUNCTION public.mark_user_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.type IN ('purchase', 'admin_adjust', 'subscription')
     AND (new.amount > 0 OR new.type = 'subscription') THEN
    -- Señalar al trigger que este UPDATE es una operación interna de confianza
    PERFORM set_config('app.internal_profile_update', 'true', true);
    UPDATE public.profiles
       SET has_paid_credits = true,
           updated_at = now()
     WHERE id = new.user_id
       AND has_paid_credits = false;
  END IF;
  RETURN new;
END;
$$;
