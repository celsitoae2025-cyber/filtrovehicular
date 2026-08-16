-- ============================================================
-- FIX DE SEGURIDAD — el cobro deja de decidirse en el navegador
--
-- Problema (auditoría 2026-08-15):
--   1) bridge-proxy solo comprobaba sesión activa, nunca el pago. Cualquier
--      usuario registrado podía llamar al bridge por su cuenta y consultar
--      gratis sin límite.
--   2) refund_consulta la podía llamar el propio cliente sobre cualquier
--      consulta suya en 'pending'. Como el dato se entregaba antes de cobrar,
--      bastaba con pedir el reembolso después de recibirlo.
--
-- Solución: reservar y liquidar.
--   · El frontend cobra PRIMERO (consume_credits) y recibe un consulta_id.
--   · bridge-proxy reclama esa reserva (bridge_claim_consulta) antes de
--     tocar el bridge: comprueba dueño, estado y antigüedad, y la marca
--     'in_flight' para que no se pueda reutilizar.
--   · Al ver la respuesta, el SERVIDOR liquida (bridge_settle_consulta):
--     confirma si hubo datos, o devuelve el crédito si no los hubo.
--
-- Se conserva la regla de negocio: si el bot no encuentra nada, no se cobra.
-- Lo que cambia es QUIÉN lo decide — ahora el servidor, no el cliente.
--
-- Idempotente.
-- ============================================================


-- ============================================================
-- 1) bridge_claim_consulta — reclamar la reserva antes de consultar
--
-- La llama SOLO la edge function bridge-proxy con service_role.
-- Devuelve el costo reservado. Si algo no cuadra, lanza excepción y la
-- edge function rechaza la petición sin llegar al bridge.
-- ============================================================
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
  c_user    uuid;
  c_status  text;
  c_cost    integer;
  c_created timestamptz;
BEGIN
  SELECT user_id, status, cost, created_at
    INTO c_user, c_status, c_cost, c_created
    FROM public.consultas
   WHERE id = p_consulta_id
     FOR UPDATE;

  IF c_user IS NULL THEN
    RAISE EXCEPTION 'CONSULTA_NO_ENCONTRADA';
  END IF;

  -- Que la reserva sea de quien la usa. Sin esto, un usuario podría gastar
  -- la consulta pagada por otro.
  IF c_user <> p_user_id THEN
    RAISE EXCEPTION 'CONSULTA_AJENA';
  END IF;

  -- Un solo uso: en cuanto pasa a 'in_flight' o se liquida, no vale más.
  IF c_status <> 'pending' THEN
    RAISE EXCEPTION 'CONSULTA_YA_USADA';
  END IF;

  -- Una reserva vieja no sirve: evita acumular consulta_id pagados para
  -- gastarlos todos de golpe más tarde.
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


-- ============================================================
-- 2) bridge_settle_consulta — liquidar según lo que respondió el bot
--
-- p_ok = true  → la consulta trajo datos: se confirma, se queda cobrada.
-- p_ok = false → no hubo datos o falló: se devuelve el crédito.
--
-- La llama SOLO bridge-proxy con service_role. Idempotente: si la consulta
-- ya está liquidada, no hace nada (evita reembolsos dobles).
-- ============================================================
CREATE OR REPLACE FUNCTION public.bridge_settle_consulta(
  p_consulta_id uuid,
  p_ok          boolean,
  p_reason      text DEFAULT NULL
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
   WHERE id = p_consulta_id
     FOR UPDATE;

  IF c_user IS NULL THEN
    RAISE EXCEPTION 'CONSULTA_NO_ENCONTRADA';
  END IF;

  -- Ya liquidada: no repetir (ni cobrar ni devolver dos veces).
  IF c_status NOT IN ('pending', 'in_flight') THEN
    RETURN;
  END IF;

  IF p_ok THEN
    UPDATE public.consultas
       SET status = 'success'
     WHERE id = p_consulta_id;
    RETURN;
  END IF;

  UPDATE public.consultas
     SET status        = 'error',
         error_message = coalesce(p_reason, 'Sin resultados')
   WHERE id = p_consulta_id;

  IF coalesce(c_cost, 0) <= 0 THEN
    RETURN;   -- suscripción o admin: no se cobró, nada que devolver
  END IF;

  PERFORM set_config('app.internal_profile_update', 'true', true);
  UPDATE public.profiles
     SET credits_balance = credits_balance + c_cost,
         updated_at      = now()
   WHERE id = c_user;
  PERFORM set_config('app.internal_profile_update', 'false', true);

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (c_user, 'refund', c_cost,
          'Reembolso automático ' || coalesce(c_module, '') || ' / ' ||
          coalesce(c_type, '') || ' — ' || coalesce(p_reason, 'sin resultados'));
END;
$$;

REVOKE ALL ON FUNCTION public.bridge_settle_consulta(uuid, boolean, text) FROM public;
REVOKE ALL ON FUNCTION public.bridge_settle_consulta(uuid, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.bridge_settle_consulta(uuid, boolean, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_settle_consulta(uuid, boolean, text) TO service_role;


-- ============================================================
-- 3) Quitarle al cliente el poder sobre el dinero
--
-- refund_consulta y confirm_consulta ya no las llama el navegador: ahora
-- liquida el servidor. Se dejan definidas (por si algún script antiguo las
-- usa con service_role) pero se les revoca el permiso a `authenticated`.
--
-- Esto es lo que cierra el fallo #3: el usuario ya no puede pedir el
-- reembolso de una consulta que sí le dio resultados.
-- ============================================================
-- Ojo: en producción confirm_consulta NO existe — el archivo que la define
-- (fixes/fixes_2026_04.sql) nunca se llegó a aplicar. Por eso los REVOKE van
-- condicionados a que la función exista, y no al revés: la migración debe
-- correr igual sea cual sea el estado real de la base.
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.refund_consulta(uuid, text)',
    'public.confirm_consulta(uuid, text)'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public', fn);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
      RAISE NOTICE 'Permisos cerrados en %', fn;
    ELSE
      RAISE NOTICE 'No existe (nada que cerrar): %', fn;
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- 3b) cancel_consulta_no_usada — red de seguridad para el cliente
--
-- Al cobrar ANTES de consultar aparece un hueco: si la petición nunca llega
-- al bridge-proxy (el usuario se queda sin red justo después de cobrar), la
-- reserva queda pagada y nadie la liquida. El crédito se perdería.
--
-- Esta función deja que el propio cliente cancele ESA situación, y solo esa:
-- exige status = 'pending', es decir, que bridge_claim_consulta NUNCA la
-- haya reclamado. Como el proxy marca 'in_flight' ANTES de hablar con el
-- bridge, una consulta en 'pending' no pudo haber entregado ningún dato.
--
-- Por eso esto NO reabre el fallo #3: en cuanto el proxy toma la consulta,
-- deja de estar en 'pending' y esta función la rechaza.
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_consulta_no_usada(
  p_consulta_id uuid
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
BEGIN
  SELECT user_id, cost, status
    INTO c_user, c_cost, c_status
    FROM public.consultas
   WHERE id = p_consulta_id
     FOR UPDATE;

  IF c_user IS NULL THEN
    RAISE EXCEPTION 'Consulta no encontrada';
  END IF;
  IF c_user <> auth.uid() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- La clave del asunto: solo lo nunca reclamado por el servidor.
  IF c_status <> 'pending' THEN
    RETURN;   -- ya en curso o liquidada: no se toca
  END IF;

  UPDATE public.consultas
     SET status        = 'error',
         error_message = 'Cancelada antes de ejecutarse'
   WHERE id = p_consulta_id;

  IF coalesce(c_cost, 0) <= 0 THEN
    RETURN;
  END IF;

  PERFORM set_config('app.internal_profile_update', 'true', true);
  UPDATE public.profiles
     SET credits_balance = credits_balance + c_cost,
         updated_at      = now()
   WHERE id = c_user;
  PERFORM set_config('app.internal_profile_update', 'false', true);

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (c_user, 'refund', c_cost, 'Devolución — consulta no ejecutada');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_consulta_no_usada(uuid) FROM public;
REVOKE ALL ON FUNCTION public.cancel_consulta_no_usada(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_consulta_no_usada(uuid) TO authenticated;


-- ============================================================
-- 4) enforce_profile_update — no apagar la bandera dentro del trigger
--
-- Antes bajaba `app.internal_profile_update` a 'false' al pasar la primera
-- fila. Con un UPDATE interno que tocara varias filas, de la segunda en
-- adelante saltaba la excepción de "campos restringidos" — un fallo que
-- aparecería en producción sin previo aviso el día que alguien escriba un
-- UPDATE múltiple.
--
-- La bandera se pone con set_config(..., true), que es local a la
-- transacción: se limpia sola al terminar. Apagarla aquí no aportaba nada
-- y rompía el caso multi-fila. Ahora la apaga cada función interna justo
-- después de su UPDATE.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass para: service role (sin JWT), admins, o RPCs internas de confianza.
  --
  -- Nota sobre `auth.uid() IS NULL`: es como se reconoce a service_role.
  -- Lo único que impide que un anónimo entre por aquí es que RLS no le da
  -- UPDATE sobre profiles. Si alguna vez se añade una política de escritura
  -- para `anon`, este bypass deja pasar cualquier cosa — no añadir esa
  -- política sin revisar este trigger.
  IF auth.uid() IS NULL
     OR public.is_current_user_admin()
     OR coalesce(current_setting('app.internal_profile_update', true), '') = 'true'
  THEN
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


-- ============================================================
-- COMPROBACIÓN — ninguna función que mueva saldo debe seguir siendo
-- ejecutable por anon o authenticated. El resultado esperado es vacío.
-- ============================================================
SELECT p.proname AS funcion_expuesta, r.rolname AS rol
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL (VALUES ('anon'), ('authenticated')) AS roles(rolname)
  JOIN pg_roles r ON r.rolname = roles.rolname
 WHERE n.nspname = 'public'
   AND p.prosecdef = true
   AND p.proname IN ('increment_credits', 'refund_consulta', 'confirm_consulta',
                     'bridge_claim_consulta', 'bridge_settle_consulta')
   AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')
 ORDER BY p.proname, r.rolname;
