-- Row Level Security and grants.
--
-- Who can do what through the Supabase API:
--   customers  read their own profile, card, stamps and coupons; update only
--              their own display_name and preferred_language
--   staff      look up a single coupon by code (find_coupon_for_staff);
--              redeeming goes through a server route using the service role
--   admins     read everything that belongs to their cafe
--   anon       read cafe info only
-- Cards, stamps, coupons and tags are never written by clients: all writes
-- happen server-side with the service role, which bypasses RLS.
-- Re-runnable: policies are dropped and recreated.

-- ---------------------------------------------------------------------------
-- Role helpers (security definer, so policies can check the caller's role
-- without recursing into the profiles policies)
-- ---------------------------------------------------------------------------

-- The cafe the caller works at, if they are staff or admin.
create or replace function private.staff_cafe_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cafe_id from public.profiles
  where id = (select auth.uid()) and role in ('staff', 'admin');
$$;

create or replace function private.is_admin_of(target_cafe uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and cafe_id = target_cafe
  );
$$;

-- An admin can see a profile that works at their cafe or holds a card there.
create or replace function private.admin_can_see_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles me
    where me.id = (select auth.uid())
      and me.role = 'admin'
      and (
        exists (select 1 from public.profiles p where p.id = target_profile and p.cafe_id = me.cafe_id)
        or exists (select 1 from public.cards c where c.customer_id = target_profile and c.cafe_id = me.cafe_id)
      )
  );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
revoke all on all functions in schema private from public, anon;
grant execute on function private.staff_cafe_id() to authenticated;
grant execute on function private.is_admin_of(uuid) to authenticated;
grant execute on function private.admin_can_see_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.cafes enable row level security;
alter table public.profiles enable row level security;
alter table public.tags enable row level security;
alter table public.cards enable row level security;
alter table public.stamps enable row level security;
alter table public.coupons enable row level security;

-- ---------------------------------------------------------------------------
-- Grants: start from nothing, then add exactly what each role needs.
-- (Supabase grants everything to anon/authenticated by default.)
-- ---------------------------------------------------------------------------

revoke all on public.cafes, public.profiles, public.tags, public.cards, public.stamps, public.coupons
  from anon, authenticated;

grant select on public.cafes to anon, authenticated;
grant select on public.profiles, public.tags, public.cards, public.stamps, public.coupons to authenticated;
grant update (display_name, preferred_language) on public.profiles to authenticated;

grant select, insert, update, delete
  on public.cafes, public.profiles, public.tags, public.cards, public.stamps, public.coupons
  to service_role;

revoke all on function public.generate_coupon_code() from public, anon, authenticated;
grant execute on function public.generate_coupon_code() to service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- cafes: public information
drop policy if exists cafes_read on public.cafes;
create policy cafes_read on public.cafes
  for select to anon, authenticated
  using (true);

-- profiles
drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_read_admin on public.profiles;
create policy profiles_read_admin on public.profiles
  for select to authenticated
  using (private.admin_can_see_profile(id));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- tags: admins only
drop policy if exists tags_read_admin on public.tags;
create policy tags_read_admin on public.tags
  for select to authenticated
  using (private.is_admin_of(cafe_id));

-- cards
drop policy if exists cards_read_own on public.cards;
create policy cards_read_own on public.cards
  for select to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists cards_read_admin on public.cards;
create policy cards_read_admin on public.cards
  for select to authenticated
  using (private.is_admin_of(cafe_id));

-- stamps
drop policy if exists stamps_read_own on public.stamps;
create policy stamps_read_own on public.stamps
  for select to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists stamps_read_admin on public.stamps;
create policy stamps_read_admin on public.stamps
  for select to authenticated
  using (private.is_admin_of(cafe_id));

-- coupons
drop policy if exists coupons_read_own on public.coupons;
create policy coupons_read_own on public.coupons
  for select to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists coupons_read_admin on public.coupons;
create policy coupons_read_admin on public.coupons
  for select to authenticated
  using (private.is_admin_of(cafe_id));

-- ---------------------------------------------------------------------------
-- Staff coupon lookup: one coupon by its exact code, only for the caller's
-- cafe. Staff get no general read access to coupons, so they cannot list them.
-- ---------------------------------------------------------------------------

create or replace function public.find_coupon_for_staff(p_code text)
returns table (
  id uuid,
  code text,
  status text,
  issued_at timestamptz,
  expires_at timestamptz,
  redeemed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.code,
         case when c.status = 'valid' and c.expires_at <= now() then 'expired' else c.status end,
         c.issued_at, c.expires_at, c.redeemed_at
  from public.coupons c
  where c.code = upper(btrim(p_code))
    and c.cafe_id = private.staff_cafe_id();
$$;

revoke all on function public.find_coupon_for_staff(text) from public, anon;
grant execute on function public.find_coupon_for_staff(text) to authenticated, service_role;
