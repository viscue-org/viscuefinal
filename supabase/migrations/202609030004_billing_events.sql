-- 202609030004_billing_events.sql
-- Idempotent Dodo Subscription Webhook Transaction

create or replace function public.apply_dodo_subscription_event(
  p_webhook_id text,
  p_event_type text,
  p_payload_hash text,
  p_subscription_id text,
  p_customer_id text,
  p_product_id text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns boolean
language plpgsql
security definer set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_plan public.viscue_plan;
  v_status public.subscription_status;
begin
  -- 1. Check duplicate webhook idempotently
  if exists (select 1 from public.webhook_events where webhook_id = p_webhook_id) then
    return true;
  end if;

  -- 2. Record processed webhook
  insert into public.webhook_events (webhook_id, event_type, payload_hash)
  values (p_webhook_id, p_event_type, p_payload_hash);

  -- 3. Resolve user_id from billing_customers
  select user_id into v_user_id
  from public.billing_customers
  where dodo_customer_id = p_customer_id;

  if v_user_id is null then
    -- Cannot link to user yet, keep event audited
    return true;
  end if;

  -- 4. Map product to plan (Viscue Pro: 28 cues, Viscue Plus: 99 cues)
  -- Or default based on product
  if p_product_id = 'pdt_0Njwkcsm5QrrZxWwkAe3L' then
    v_plan := 'plus';
  elsif p_product_id = 'pdt_0Njwkcq27QRFcZ5cACBD5' then
    v_plan := 'pro';
  else
    v_plan := 'free';
  end if;

  -- 5. Map status
  if p_status in ('active', 'renewed', 'trialing') then
    v_status := 'active';
  elsif p_status in ('on_hold', 'past_due', 'paused') then
    v_status := 'on_hold';
  elsif p_status in ('cancelled', 'canceled') then
    v_status := 'cancelled';
  else
    v_status := 'expired';
  end if;

  -- 6. Upsert subscription
  insert into public.subscriptions (
    user_id,
    dodo_subscription_id,
    plan,
    status,
    current_period_start,
    current_period_end,
    updated_at
  )
  values (
    v_user_id,
    p_subscription_id,
    v_plan,
    v_status,
    coalesce(p_period_start, now()),
    coalesce(p_period_end, now() + interval '1 month'),
    now()
  )
  on conflict (dodo_subscription_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    updated_at = now();

  return true;
end;
$$;
