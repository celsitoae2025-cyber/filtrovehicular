-- A payment and its entitlement must commit together. A duplicate webhook
-- returns false; it must never add credits or extend a subscription twice.
alter table public.transactions
  add column if not exists amount_pen numeric(10, 2);

create or replace function public.apply_mp_approved_payment(
  p_payment_id text,
  p_user_id uuid,
  p_user_email text,
  p_plan_id text,
  p_credits integer,
  p_amount numeric,
  p_type text,
  p_tier text,
  p_days integer,
  p_payer_email text,
  p_method text,
  p_date_approved text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_row bigint;
  v_current_tier text;
  v_current_expires timestamptz;
  v_base timestamptz;
  v_expires timestamptz;
begin
  if nullif(btrim(p_payment_id), '') is null
     or p_user_id is null
     or nullif(btrim(p_plan_id), '') is null
     or p_amount is null or p_amount <= 0
     or p_type is null or p_type not in ('recarga', 'suscripcion')
     or (p_type = 'recarga' and (p_credits is null or p_credits <= 0))
     or (p_type = 'suscripcion' and
         (p_days is null or p_days <= 0 or nullif(btrim(p_tier), '') is null))
  then
    raise exception 'Datos de pago de Mercado Pago invalidos';
  end if;

  insert into public.payments_mp (
    payment_id, user_id, user_email, plan_id, credits, amount, status, type,
    mp_payer_email, mp_payment_method, mp_date_approved
  ) values (
    p_payment_id, p_user_id, coalesce(p_user_email, ''), p_plan_id,
    case when p_type = 'recarga' then p_credits else 0 end,
    p_amount, 'approved', p_type, coalesce(p_payer_email, ''),
    coalesce(p_method, ''), coalesce(p_date_approved, '')
  )
  on conflict (payment_id) do nothing
  returning id into v_payment_row;

  if v_payment_row is null then
    return false;
  end if;

  if p_type = 'recarga' then
    perform set_config('app.internal_profile_update', 'true', true);
    update public.profiles
       set credits_balance = coalesce(credits_balance, 0) + p_credits,
           updated_at = now()
     where id = p_user_id;
    if not found then
      raise exception 'Perfil no encontrado para pago %', p_payment_id;
    end if;

    insert into public.transactions (
      user_id, type, amount, amount_pen, description, plan_id,
      payment_method, reference
    ) values (
      p_user_id, 'purchase', p_credits, p_amount,
      'Pago MP - ' || p_plan_id, p_plan_id, 'mercadopago', p_payment_id
    );
  else
    select subscription_tier, subscription_expires_at
      into v_current_tier, v_current_expires
      from public.profiles
     where id = p_user_id
     for update;
    if not found then
      raise exception 'Perfil no encontrado para pago %', p_payment_id;
    end if;

    v_base := now();
    if v_current_tier = p_tier and v_current_expires > v_base then
      v_base := v_current_expires;
    end if;
    v_expires := v_base + make_interval(days => p_days);

    perform set_config('app.internal_profile_update', 'true', true);
    update public.profiles
       set subscription_tier = p_tier,
           subscription_plan_id = p_plan_id,
           subscription_expires_at = v_expires,
           subscription_started_at = case
             when v_base = v_current_expires then subscription_started_at
             else now()
           end,
           updated_at = now()
     where id = p_user_id;

    insert into public.transactions (
      user_id, type, amount, amount_pen, description, plan_id,
      payment_method, reference
    ) values (
      p_user_id, 'subscription', 0, p_amount,
      'Suscripcion ' || p_plan_id || ' - vence ' || to_char(v_expires, 'YYYY-MM-DD'),
      p_plan_id, 'mercadopago', p_payment_id
    );
  end if;

  return true;
end;
$$;

revoke all on function public.apply_mp_approved_payment(
  text, uuid, text, text, integer, numeric, text, text, integer, text, text, text
) from public, anon, authenticated;
grant execute on function public.apply_mp_approved_payment(
  text, uuid, text, text, integer, numeric, text, text, integer, text, text, text
) to service_role;
