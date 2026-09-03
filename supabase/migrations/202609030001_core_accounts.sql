-- 202609030001_core_accounts.sql
-- Viscue Core Accounts, Subscriptions, Usage and RLS

create type public.viscue_plan as enum ('free', 'plus', 'pro');
create type public.subscription_status as enum ('active', 'on_hold', 'cancelled', 'expired');

-- Profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Billing Customers
create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dodo_customer_id text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dodo_subscription_id text unique not null,
  plan public.viscue_plan not null,
  status public.subscription_status not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists index_subscriptions_user_status on public.subscriptions (user_id, status);

-- Daily Usage
create table if not exists public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  consumed int not null default 0 check (consumed >= 0),
  reserved int not null default 0 check (reserved >= 0),
  primary key (user_id, usage_date)
);

-- Cue Reservations
create table if not exists public.cue_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null,
  usage_date date not null default (now() at time zone 'utc')::date,
  status text not null check (status in ('reserved', 'committed', 'released', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  unique (user_id, request_key)
);

create index if not exists index_cue_reservations_status_expires on public.cue_reservations (status, expires_at);

-- Webhook Events Audit
create table if not exists public.webhook_events (
  webhook_id text primary key,
  event_type text not null,
  payload_hash text not null,
  processed_at timestamptz not null default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_daily enable row level security;
alter table public.cue_reservations enable row level security;
alter table public.webhook_events enable row level security;

-- Profiles RLS: users can read/update their own profile
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can update their own safe profile fields"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Deny-by-default for all other tables: Only service_role can directly mutate billing, usage, subscriptions
create policy "Allow service_role full access to billing_customers"
  on public.billing_customers using (auth.role() = 'service_role');

create policy "Allow service_role full access to subscriptions"
  on public.subscriptions using (auth.role() = 'service_role');

create policy "Allow service_role full access to usage_daily"
  on public.usage_daily using (auth.role() = 'service_role');

create policy "Allow service_role full access to cue_reservations"
  on public.cue_reservations using (auth.role() = 'service_role');

create policy "Allow service_role full access to webhook_events"
  on public.webhook_events using (auth.role() = 'service_role');

-- Trigger to auto-create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Safe Account Summary function
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
  v_plan public.viscue_plan := 'free';
  v_allowance int := 9;
  v_consumed int := 0;
  v_reserved int := 0;
  v_today date := (now() at time zone 'utc')::date;
  v_sub_status text := null;
  v_resets_at timestamptz := ((v_today + interval '1 day') at time zone 'utc');
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select u.email into v_email from auth.users u where u.id = v_user_id;

  -- Check active subscription
  select s.plan, s.status::text into v_plan, v_sub_status
  from public.subscriptions s
  where s.user_id = v_user_id and s.status = 'active'
  order by s.created_at desc
  limit 1;

  if v_plan is null then
    v_plan := 'free';
  end if;

  -- Set allowance based on active plan
  if v_plan = 'plus' then
    v_allowance := 28;
  elsif v_plan = 'pro' then
    v_allowance := 99;
  else
    v_allowance := 9;
  end if;

  -- Get today's usage
  select u.consumed, u.reserved into v_consumed, v_reserved
  from public.usage_daily u
  where u.user_id = v_user_id and u.usage_date = v_today;

  if v_consumed is null then v_consumed := 0; end if;
  if v_reserved is null then v_reserved := 0; end if;

  return query select
    v_email,
    v_plan,
    v_allowance,
    v_consumed,
    v_reserved,
    greatest(0, v_allowance - v_consumed - v_reserved),
    v_resets_at,
    v_sub_status;
end;
$$;

grant execute on function public.get_account_summary() to authenticated;
