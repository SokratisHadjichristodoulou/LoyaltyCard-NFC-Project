-- Core schema: cafes, profiles, tags, cards, stamps, coupons.
-- Re-runnable: every statement is guarded (if not exists / or replace / drop if exists).
-- Every business table carries cafe_id so more cafes can be added later.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Private schema: not exposed through the Supabase API.
create schema if not exists private;

-- Unguessable coupon code, e.g. "CP-7K4Q-29XM-HD3P-WR8N" (16 random characters,
-- about 79 bits). The alphabet skips 0/O and 1/I so codes are easy to read out.
create or replace function public.generate_coupon_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea := uuid_send(gen_random_uuid());
  chars text := '';
begin
  for i in 0..15 loop
    chars := chars || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return 'CP-' || substr(chars, 1, 4) || '-' || substr(chars, 5, 4) || '-'
              || substr(chars, 9, 4) || '-' || substr(chars, 13, 4);
end;
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.cafes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  stamps_required integer not null default 10 check (stamps_required > 0),
  coupon_valid_days integer not null default 90 check (coupon_valid_days > 0),
  stamp_cooldown_seconds integer not null default 180 check (stamp_cooldown_seconds >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- The cafe a staff member or admin works at. Null for customers.
  cafe_id uuid references public.cafes (id) on delete set null,
  role text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
  display_name text check (char_length(display_name) <= 80),
  preferred_language text not null default 'el' check (preferred_language in ('el', 'en')),
  created_at timestamptz not null default now(),
  constraint staff_have_a_cafe check (role = 'customer' or cafe_id is not null)
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  label text not null,
  tag_uid text not null unique,
  staff_id uuid references public.profiles (id) on delete set null,
  active boolean not null default true,
  last_counter bigint not null default 0 check (last_counter >= 0),
  created_at timestamptz not null default now(),
  unique (id, cafe_id)
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  stamp_count integer not null default 0 check (stamp_count >= 0),
  updated_at timestamptz not null default now(),
  unique (cafe_id, customer_id),
  -- Lets stamps prove they belong to the same cafe and customer as their card.
  unique (id, cafe_id, customer_id)
);

create table if not exists public.stamps (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  card_id uuid not null,
  customer_id uuid not null,
  -- Tags are deactivated, not deleted, so the audit trail keeps pointing at them.
  tag_id uuid,
  created_at timestamptz not null default now(),
  foreign key (card_id, cafe_id, customer_id)
    references public.cards (id, cafe_id, customer_id) on delete cascade,
  foreign key (tag_id, cafe_id) references public.tags (id, cafe_id) on delete restrict
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique default public.generate_coupon_code()
    check (char_length(code) >= 12),
  status text not null default 'valid' check (status in ('valid', 'used', 'expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles (id) on delete set null,
  constraint expires_after_issue check (expires_at > issued_at),
  constraint used_means_redeemed check ((status = 'used') = (redeemed_at is not null))
);

-- ---------------------------------------------------------------------------
-- Indexes on lookup columns (unique constraints above already index
-- cafes.slug, tags.tag_uid, coupons.code and cards(cafe_id, customer_id)).
-- ---------------------------------------------------------------------------

create index if not exists profiles_cafe_id_idx on public.profiles (cafe_id);
create index if not exists tags_cafe_id_idx on public.tags (cafe_id);
create index if not exists tags_staff_id_idx on public.tags (staff_id);
create index if not exists cards_customer_id_idx on public.cards (customer_id);
create index if not exists stamps_customer_id_idx on public.stamps (customer_id);
create index if not exists stamps_card_id_idx on public.stamps (card_id, created_at desc);
create index if not exists stamps_cafe_id_idx on public.stamps (cafe_id, created_at desc);
create index if not exists stamps_tag_id_idx on public.stamps (tag_id);
create index if not exists coupons_customer_id_idx on public.coupons (customer_id, issued_at desc);
create index if not exists coupons_cafe_id_idx on public.coupons (cafe_id, status);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists cards_touch_updated_at on public.cards;
create trigger cards_touch_updated_at
  before update on public.cards
  for each row execute function private.touch_updated_at();

-- Create a profile for every new auth user. The role is always 'customer':
-- nothing the client sends at signup (user metadata) can choose a role.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lang text := new.raw_user_meta_data ->> 'preferred_language';
begin
  insert into public.profiles (id, preferred_language)
  values (new.id, case when lang in ('el', 'en') then lang else 'el' end)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Roles and cafe membership can only be changed with direct SQL by the
-- database owner (e.g. the Supabase SQL editor). The API roles, including
-- the service role used by the server, are refused.
create or replace function private.guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated', 'service_role') then
    if tg_op = 'INSERT' and (new.role <> 'customer' or new.cafe_id is not null) then
      raise exception 'new profiles are always customers' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.role is distinct from old.role or new.cafe_id is distinct from old.cafe_id) then
      raise exception 'roles can only be changed by the database owner' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before insert or update on public.profiles
  for each row execute function private.guard_profile_role();
