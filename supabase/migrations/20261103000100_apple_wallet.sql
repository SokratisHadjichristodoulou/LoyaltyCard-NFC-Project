-- Apple Wallet: a customer can add their stamp card to Apple Wallet as a
-- signed .pkpass. iPhones register for updates with the site (Apple's
-- "PassKit web service"); after a change the server sends a push through
-- APNs and the phone downloads the new pass. The pass file and the push are
-- made in the app (src/lib/wallet/apple); the database remembers the passes,
-- the devices that hold them, and which devices still need a push.
-- Re-runnable: create if not exists, create or replace, guarded alters.

-- One Apple pass per card. The serial number is the card's id when the pass
-- is made; it stays after the account is deleted (card_id becomes null), so
-- the phone can still fetch an emptied, voided pass.
create table if not exists public.apple_wallet_passes (
  serial_number uuid primary key,
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  card_id uuid unique references public.cards (id) on delete set null,
  -- Sent by the phone with every request (Authorization: ApplePass <token>).
  auth_token text not null check (char_length(auth_token) between 32 and 128),
  -- When the pass content last changed; phones ask for passes changed since.
  updated_at timestamptz not null default now(),
  -- Goes up by one with every change; a phone is owed a push while the
  -- version it was last pushed is lower.
  version bigint not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists apple_wallet_passes_cafe_idx on public.apple_wallet_passes (cafe_id, updated_at);

-- A pass whose card is deleted has changed (it becomes the emptied pass).
create or replace function private.apple_wallet_pass_card_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.card_id is distinct from old.card_id then
    new.updated_at := clock_timestamp();
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists apple_wallet_passes_card_changed on public.apple_wallet_passes;
create trigger apple_wallet_passes_card_changed
  before update on public.apple_wallet_passes
  for each row execute function private.apple_wallet_pass_card_changed();

-- Which phones (device library ids) hold which pass, with their push token.
-- pushed_version lower than the pass's version means a push is still owed.
create table if not exists public.apple_wallet_registrations (
  device_library_id text not null check (char_length(device_library_id) between 1 and 128),
  serial_number uuid not null references public.apple_wallet_passes (serial_number) on delete cascade,
  push_token text not null check (char_length(push_token) between 1 and 200),
  pushed_version bigint not null default 0,
  pushed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (device_library_id, serial_number)
);

create index if not exists apple_wallet_registrations_serial_idx on public.apple_wallet_registrations (serial_number);

-- Server only: nobody reads or writes these through the API.
alter table public.apple_wallet_passes enable row level security;
alter table public.apple_wallet_registrations enable row level security;
revoke all on public.apple_wallet_passes, public.apple_wallet_registrations from anon, authenticated;
grant select, insert, update, delete on public.apple_wallet_passes, public.apple_wallet_registrations to service_role;

-- The theme the Apple passes were last switched to (like wallet_theme_key for Google).
alter table public.cafes add column if not exists apple_wallet_theme_key text;

-- ---------------------------------------------------------------------------
-- Server-only functions (service role)
-- ---------------------------------------------------------------------------

-- A phone registers for a pass's updates. 'created' the first time, else
-- 'updated'. The phone has just got the pass, so no push is owed yet.
create or replace function public.apple_wallet_register(p_device text, p_serial uuid, p_push_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created boolean;
begin
  insert into public.apple_wallet_registrations as r (device_library_id, serial_number, push_token, pushed_version)
  values (p_device, p_serial, p_push_token, (select p.version from public.apple_wallet_passes p where p.serial_number = p_serial))
  on conflict (device_library_id, serial_number) do update set push_token = excluded.push_token
  returning (xmax = 0) into v_created;
  return case when v_created then 'created' else 'updated' end;
end;
$$;

-- The passes on this phone that changed after p_since (all of them when null).
create or replace function public.apple_wallet_updated_serials(p_device text, p_since timestamptz)
returns table (serial_number uuid, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.serial_number, p.updated_at
  from public.apple_wallet_registrations r
  join public.apple_wallet_passes p on p.serial_number = r.serial_number
  where r.device_library_id = p_device and (p_since is null or p.updated_at > p_since);
$$;

-- Marks a customer's pass as changed. Returns its serial number, or null
-- when they haven't added the card to Apple Wallet.
create or replace function public.apple_wallet_touch(p_cafe_id uuid, p_customer_id uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$
  update public.apple_wallet_passes p set updated_at = clock_timestamp(), version = p.version + 1
  from public.cards c
  where c.id = p.card_id and c.cafe_id = p_cafe_id and c.customer_id = p_customer_id
  returning p.serial_number;
$$;

-- Marks every pass of the cafe as changed (new theme, new rules). Returns how many.
create or replace function public.apple_wallet_touch_all(p_cafe_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  with touched as (
    update public.apple_wallet_passes p set updated_at = clock_timestamp(), version = p.version + 1
    where p.cafe_id = p_cafe_id and p.card_id is not null
    returning 1
  )
  select count(*)::integer from touched;
$$;

-- Takes up to p_limit phones that still need a push (optionally for one pass)
-- and marks them pushed, so two callers never push the same change twice. A
-- change committed meanwhile raises the version again, so it is never lost.
create or replace function public.apple_wallet_claim_pushes(p_cafe_id uuid, p_serial uuid, p_limit integer)
returns table (device_library_id text, serial_number uuid, push_token text)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select r.device_library_id, r.serial_number, p.version
    from public.apple_wallet_registrations r
    join public.apple_wallet_passes p on p.serial_number = r.serial_number
    where p.cafe_id = p_cafe_id
      and (p_serial is null or r.serial_number = p_serial)
      and r.pushed_version < p.version
    order by p.updated_at
    limit greatest(p_limit, 0)
    for update of r skip locked
  )
  update public.apple_wallet_registrations r set pushed_version = due.version, pushed_at = now()
  from due
  where r.device_library_id = due.device_library_id and r.serial_number = due.serial_number
  returning r.device_library_id, r.serial_number, r.push_token;
$$;

-- How many cards of the cafe are on at least one phone (for the admin page).
create or replace function public.apple_wallet_pass_count(p_cafe_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct p.serial_number)::integer
  from public.apple_wallet_passes p
  join public.apple_wallet_registrations r on r.serial_number = p.serial_number
  where p.cafe_id = p_cafe_id and p.card_id is not null;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.apple_wallet_register(text, uuid, text)',
    'public.apple_wallet_updated_serials(text, timestamptz)',
    'public.apple_wallet_touch(uuid, uuid)',
    'public.apple_wallet_touch_all(uuid)',
    'public.apple_wallet_claim_pushes(uuid, uuid, integer)',
    'public.apple_wallet_pass_count(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- The daily job's expired coupons: a customer "has a pass" with Google or Apple.
create or replace function public.wallet_expire_coupons(p_cafe_id uuid, p_limit integer)
returns table (customer_id uuid, has_pass boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select k.id from public.coupons k
    where k.cafe_id = p_cafe_id and k.status = 'valid' and k.expires_at <= now()
    order by k.expires_at
    limit greatest(p_limit, 0)
    for update skip locked
  ), marked as (
    update public.coupons k set status = 'expired'
    from due where k.id = due.id
    returning k.customer_id
  )
  select m.customer_id, exists (
    select 1 from public.cards c
    left join public.apple_wallet_passes a on a.card_id = c.id
    where c.cafe_id = p_cafe_id and c.customer_id = m.customer_id
      and (c.google_wallet_object_id is not null or a.serial_number is not null)
  )
  from marked m;
end;
$$;

revoke all on function public.wallet_expire_coupons(uuid, integer) from public, anon, authenticated;
grant execute on function public.wallet_expire_coupons(uuid, integer) to service_role;

insert into private.applied_migrations (version) values ('20261103000100') on conflict do nothing;
