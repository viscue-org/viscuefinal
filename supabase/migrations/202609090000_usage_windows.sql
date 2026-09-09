-- 202609090000_usage_windows.sql
-- Transition to rolling 24-hour quota windows

create table if not exists public.usage_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  window_ends_at timestamptz not null,
  status text not null check (status in ('active', 'closed')),
  consumed integer not null default 0,
  reserved integer not null default 0
);

create unique index if not exists index_usage_windows_active on public.usage_windows (user_id) where status = 'active';

alter table public.usage_windows enable row level security;
create policy "Allow service_role full access to usage_windows"
  on public.usage_windows using (auth.role() = 'service_role');

-- Alter cue_reservations
alter table public.cue_reservations add column if not exists usage_window_id uuid references public.usage_windows(id) on delete cascade;

-- Data migration: Convert current-day usage_daily to usage_windows
insert into public.usage_windows (user_id, window_started_at, window_ends_at, status, consumed, reserved)
select
  user_id,
  (usage_date::timestamp at time zone 'utc'),
  (usage_date::timestamp at time zone 'utc') + interval '24 hours',
  'active',
  consumed,
  reserved
from public.usage_daily
where usage_date = (now() at time zone 'utc')::date
on conflict (user_id) where status = 'active' do nothing;

-- Update existing reservations to link to active windows if applicable
update public.cue_reservations cr
set usage_window_id = uw.id
from public.usage_windows uw
where cr.user_id = uw.user_id and uw.status = 'active'
and cr.usage_window_id is null;

-- Atomic helper for account summary and reservations
create or replace function public.process_quota_window(p_user_id uuid)
returns table (
  window_id uuid,
  plan public.viscue_plan,
  allowance int,
  consumed int,
  reserved int,
  remaining int,
  resets_at timestamptz,
  subscription_status text
)
language plpgsql
security definer set search_path = pg_catalog, public
as $$
declare
  v_plan public.viscue_plan := 'free';
  v_sub_status text := null;
  v_allowance int := 9;
  v_window public.usage_windows%rowtype;
begin
  -- 1. Expire stale reservations and decrement exactly once
  update public.usage_windows uw
  set reserved = greatest(0, uw.reserved - (
    select count(*) from public.cue_reservations cr 
    where cr.usage_window_id = uw.id and cr.status = 'reserved' and cr.expires_at <= now()
  ))
  where uw.user_id = p_user_id and uw.status = 'active';

  update public.cue_reservations
  set status = 'expired'
  where user_id = p_user_id and status = 'reserved' and expires_at <= now();

  -- 2. Close elapsed windows
  update public.usage_windows
  set status = 'closed'
  where user_id = p_user_id and status = 'active' and window_ends_at <= now();

  -- 3. Lock or create active window
  select * into v_window from public.usage_windows where user_id = p_user_id and status = 'active' for update;
  
  -- 4. Derive active plan
  select s.plan, s.status::text into v_plan, v_sub_status
  from public.subscriptions s
  where s.user_id = p_user_id and s.status = 'active'
  order by s.created_at desc limit 1;
  if v_plan is null then v_plan := 'free'; end if;
  v_allowance := case when v_plan = 'pro' then 99 when v_plan = 'plus' then 28 else 9 end;

  if v_window.id is null then
    -- Return null resets_at for a non-started window
    return query select
      null::uuid, v_plan, v_allowance, 0, 0, v_allowance, null::timestamptz, v_sub_status;
    return;
  end if;

  return query select
    v_window.id,
    v_plan,
    v_allowance,
    v_window.consumed,
    v_window.reserved,
    greatest(0, v_allowance - v_window.consumed - v_window.reserved),
    v_window.window_ends_at,
    v_sub_status;
end;
$$;

create or replace function public.get_account_summary()
returns table (
  email text,
  plan public.viscue_plan,
  allowance int,
  consumed int,
  reserved int,
  remaining int,
  resets_at timestamptz,
  subscription_status text
)
language plpgsql
security definer set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Unauthorized' using errcode = '42501'; end if;
  select u.email into v_email from auth.users u where u.id = v_user_id;

  return query
  select v_email, pq.plan, pq.allowance, pq.consumed, pq.reserved, pq.remaining, pq.resets_at, pq.subscription_status
  from public.process_quota_window(v_user_id) pq;
end;
$$;

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
  v_existing_id uuid;
  v_new_id uuid;
  v_quota record;
  v_window_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Unauthorized' using errcode = '42501'; end if;
  if p_request_key is null or trim(p_request_key) = '' then raise exception 'Missing request key' using errcode = '22000'; end if;

  -- 1. Idempotency check
  select id into v_existing_id from public.cue_reservations where user_id = v_user_id and request_key = p_request_key;
  if v_existing_id is not null then
    select pq.allowance, pq.consumed, pq.reserved, pq.remaining, pq.resets_at into v_quota from public.process_quota_window(v_user_id) pq;
    return query select v_existing_id, v_quota.allowance, v_quota.consumed, v_quota.reserved, v_quota.remaining, v_quota.resets_at;
    return;
  end if;

  -- 2. Evaluate quota window
  select pq.window_id, pq.allowance, pq.consumed, pq.reserved, pq.remaining, pq.resets_at into v_quota from public.process_quota_window(v_user_id) pq;
  
  if v_quota.window_id is null then
    -- Start a new 24-hour window
    insert into public.usage_windows (user_id, window_started_at, window_ends_at, status, consumed, reserved)
    values (v_user_id, now(), now() + interval '24 hours', 'active', 0, 0)
    returning id, window_ends_at into v_window_id, v_quota.resets_at;
    
    v_quota.consumed := 0;
    v_quota.reserved := 0;
    v_quota.remaining := v_quota.allowance;
  else
    v_window_id := v_quota.window_id;
  end if;

  if v_quota.remaining <= 0 then
    raise exception 'quota_exhausted' using errcode = 'P0001';
  end if;

  -- 3. Atomically reserve cue
  update public.usage_windows
  set reserved = reserved + 1
  where id = v_window_id;

  v_new_id := gen_random_uuid();
  insert into public.cue_reservations (id, user_id, usage_window_id, request_key, status, expires_at)
  values (v_new_id, v_user_id, v_window_id, p_request_key, 'reserved', now() + interval '5 minutes');

  return query select
    v_new_id,
    v_quota.allowance,
    v_quota.consumed,
    v_quota.reserved + 1,
    v_quota.remaining - 1,
    v_quota.resets_at;
end;
$$;

create or replace function public.commit_cue(p_reservation_id uuid)
returns boolean
language plpgsql
security definer set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_window_id uuid;
  v_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Unauthorized' using errcode = '42501'; end if;

  select usage_window_id, status into v_window_id, v_status
  from public.cue_reservations
  where id = p_reservation_id and user_id = v_user_id
  for update;

  if v_status is null or v_status = 'committed' then return true; end if;

  if v_status = 'reserved' then
    update public.cue_reservations set status = 'committed' where id = p_reservation_id;
    update public.usage_windows
    set reserved = greatest(0, reserved - 1),
        consumed = consumed + 1
    where id = v_window_id;
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
  v_window_id uuid;
  v_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Unauthorized' using errcode = '42501'; end if;

  select usage_window_id, status into v_window_id, v_status
  from public.cue_reservations
  where id = p_reservation_id and user_id = v_user_id
  for update;

  if v_status is null or v_status in ('released', 'committed') then return true; end if;

  if v_status = 'reserved' then
    update public.cue_reservations set status = 'released' where id = p_reservation_id;
    update public.usage_windows
    set reserved = greatest(0, reserved - 1)
    where id = v_window_id;
  end if;
  return true;
end;
$$;
