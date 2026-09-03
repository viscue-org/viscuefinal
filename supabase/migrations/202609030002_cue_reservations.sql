-- 202609030002_cue_reservations.sql
-- Atomic Cue Reservation State Machine

create or replace function public.reserve_cue(p_request_key text)
returns table (
  reservation_id uuid,
  allowance int,
  consumed int,
  reserved int,
  remaining int,
  resets_at timestamptz
)
language plpgsql
security definer set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_today date := (now() at time zone 'utc')::date;
  v_resets_at timestamptz := ((v_today + interval '1 day') at time zone 'utc');
  v_plan public.viscue_plan := 'free';
  v_allowance int := 9;
  v_consumed int := 0;
  v_reserved int := 0;
  v_existing_id uuid;
  v_existing_status text;
  v_new_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if p_request_key is null or trim(p_request_key) = '' then
    raise exception 'Missing request key' using errcode = '22000';
  end if;

  -- 1. Check existing reservation for this request key (idempotency)
  select id, status into v_existing_id, v_existing_status
  from public.cue_reservations
  where user_id = v_user_id and request_key = p_request_key;

  if v_existing_id is not null then
    -- Fetch active plan and counts to return
    select s.plan into v_plan
    from public.subscriptions s
    where s.user_id = v_user_id and s.status = 'active'
    order by s.created_at desc limit 1;
    if v_plan is null then v_plan := 'free'; end if;
    v_allowance := case when v_plan = 'pro' then 99 when v_plan = 'plus' then 28 else 9 end;

    select u.consumed, u.reserved into v_consumed, v_reserved
    from public.usage_daily u
    where u.user_id = v_user_id and u.usage_date = v_today;

    return query select
      v_existing_id,
      v_allowance,
      coalesce(v_consumed, 0),
      coalesce(v_reserved, 0),
      greatest(0, v_allowance - coalesce(v_consumed, 0) - coalesce(v_reserved, 0)),
      v_resets_at;
    return;
  end if;

  -- 2. Lock usage row for user and date
  insert into public.usage_daily (user_id, usage_date, consumed, reserved)
  values (v_user_id, v_today, 0, 0)
  on conflict (user_id, usage_date) do nothing;

  select u.consumed, u.reserved into v_consumed, v_reserved
  from public.usage_daily u
  where u.user_id = v_user_id and u.usage_date = v_today
  for update;

  -- 3. Calculate current allowance
  select s.plan into v_plan
  from public.subscriptions s
  where s.user_id = v_user_id and s.status = 'active'
  order by s.created_at desc limit 1;
  if v_plan is null then v_plan := 'free'; end if;
  v_allowance := case when v_plan = 'pro' then 99 when v_plan = 'plus' then 28 else 9 end;

  -- 4. Check quota availability
  if (v_allowance - v_consumed - v_reserved) <= 0 then
    raise exception 'quota_exhausted' using errcode = 'P0001';
  end if;

  -- 5. Atomically reserve cue
  v_reserved := v_reserved + 1;
  update public.usage_daily
  set reserved = v_reserved
  where user_id = v_user_id and usage_date = v_today;

  v_new_id := gen_random_uuid();
  insert into public.cue_reservations (id, user_id, request_key, usage_date, status, expires_at)
  values (v_new_id, v_user_id, p_request_key, v_today, 'reserved', now() + interval '5 minutes');

  return query select
    v_new_id,
    v_allowance,
    v_consumed,
    v_reserved,
    greatest(0, v_allowance - v_consumed - v_reserved),
    v_resets_at;
end;
$$;

create or replace function public.commit_cue(p_reservation_id uuid)
returns boolean
language plpgsql
security definer set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_date date;
  v_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select usage_date, status into v_date, v_status
  from public.cue_reservations
  where id = p_reservation_id and user_id = v_user_id
  for update;

  if v_status is null or v_status = 'committed' then
    return true; -- idempotent
  end if;

  if v_status = 'reserved' then
    update public.cue_reservations
    set status = 'committed'
    where id = p_reservation_id;

    update public.usage_daily
    set reserved = greatest(0, reserved - 1),
        consumed = consumed + 1
    where user_id = v_user_id and usage_date = v_date;
  end if;

  return true;
end;
$$;

create or replace function public.release_cue(p_reservation_id uuid)
returns boolean
language plpgsql
security definer set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_date date;
  v_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select usage_date, status into v_date, v_status
  from public.cue_reservations
  where id = p_reservation_id and user_id = v_user_id
  for update;

  if v_status is null or v_status in ('released', 'committed') then
    return true; -- idempotent
  end if;

  if v_status = 'reserved' then
    update public.cue_reservations
    set status = 'released'
    where id = p_reservation_id;

    update public.usage_daily
    set reserved = greatest(0, reserved - 1)
    where user_id = v_user_id and usage_date = v_date;
  end if;

  return true;
end;
$$;

grant execute on function public.reserve_cue(text) to authenticated;
grant execute on function public.commit_cue(uuid) to authenticated;
grant execute on function public.release_cue(uuid) to authenticated;
