-- ============================================================
-- NINGÚN CRÉDITO COBRADO SIN RESULTADO
--
-- El cobro funciona así: se reserva el crédito ANTES de consultar
-- (consume_credits deja la consulta en 'pending'), el servidor la reclama
-- ('in_flight') y al final la liquida: éxito → se queda cobrada; sin datos
-- → bridge_settle_consulta devuelve el crédito.
--
-- El agujero está en las que nunca llegan a liquidarse:
--
--   · 'pending'   — se cobró y la petición no llegó a salir. El cliente lo
--                   cancela solo si sigue con la página abierta; si cerró
--                   la pestaña o se quedó sin internet, nadie lo hace.
--   · 'in_flight' — el servidor la reclamó y se cortó antes de liquidar:
--                   la función agotó su tiempo, el bridge no contestó
--                   nunca, o falló el propio liquidado (queda escrito en
--                   el log como FALLO AL LIQUIDAR).
--
-- En los dos casos el cliente pagó y no recibió nada, y ahí se quedaba.
--
-- Esta función barre esas reservas colgadas y devuelve el crédito. Es la
-- red de seguridad: no sustituye al liquidado normal, lo respalda.
--
-- Plazos: 5 minutos para 'pending' (si no salió en 5 minutos, no va a
-- salir) y 30 para 'in_flight' (la espera por el proveedor no tiene tope,
-- pero media hora es mucho más de lo que vive una función del servidor).
--
-- Quién puede llamarla:
--   · cualquiera, para lo suyo        → liquidar_consultas_colgadas()
--   · un administrador, para todos    → liquidar_consultas_colgadas(true)
-- ============================================================

create or replace function public.liquidar_consultas_colgadas(
  p_todos boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  es_admin boolean;
  quien    uuid := auth.uid();
  n        integer := 0;
  r        record;
begin
  if quien is null then
    raise exception 'Hace falta una sesión';
  end if;

  select coalesce(p.is_admin, false) into es_admin
  from public.profiles p where p.id = quien;

  if p_todos and not coalesce(es_admin, false) then
    raise exception 'Solo un administrador puede liquidar las consultas de todos';
  end if;

  for r in
    select c.id, c.user_id, c.cost, c.module, c.type
      from public.consultas c
     where c.status in ('pending', 'in_flight')
       and (
         (c.status = 'pending'   and c.created_at < now() - interval '5 minutes') or
         (c.status = 'in_flight' and c.created_at < now() - interval '30 minutes')
       )
       and (p_todos or c.user_id = quien)
     order by c.created_at
     limit 500
     for update skip locked
  loop
    update public.consultas
       set status        = 'error',
           error_message = 'Se quedó sin respuesta: crédito devuelto automáticamente'
     where id = r.id;

    if coalesce(r.cost, 0) > 0 then
      perform set_config('app.internal_profile_update', 'true', true);
      update public.profiles
         set credits_balance = credits_balance + r.cost,
             updated_at      = now()
       where id = r.user_id;
      perform set_config('app.internal_profile_update', 'false', true);

      insert into public.transactions (user_id, type, amount, description)
      values (r.user_id, 'refund', r.cost,
              'Reembolso automático ' || coalesce(r.module, '') || ' / ' ||
              coalesce(r.type, '') || ' — la consulta se quedó sin respuesta');
    end if;

    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function public.liquidar_consultas_colgadas(boolean) from public;
revoke all on function public.liquidar_consultas_colgadas(boolean) from anon;
grant execute on function public.liquidar_consultas_colgadas(boolean) to authenticated;
grant execute on function public.liquidar_consultas_colgadas(boolean) to service_role;
