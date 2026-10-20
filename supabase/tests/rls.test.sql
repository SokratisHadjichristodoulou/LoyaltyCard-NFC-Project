-- RLS proof. Run with scripts/test-db.sh (needs psql and a throwaway Postgres).
-- Every check raises an exception on failure, so the run stops at the first
-- broken rule and psql exits non-zero. Passing checks print "ok - ...".

\set ON_ERROR_STOP on
set client_min_messages = notice;  -- show the ok lines

create schema if not exists tests;

create or replace function tests.ok(passed boolean, description text)
returns void language plpgsql as $$
begin
  if passed is distinct from true then
    raise exception 'not ok - %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

-- Runs a statement and passes only if it is refused (permission or RLS error).
create or replace function tests.refused(statement text, description text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'not ok - % (statement was allowed)', description;
exception
  when insufficient_privilege then raise notice 'ok - %', description;
  when others then
    if sqlerrm like 'not ok - %' then raise; end if;
    -- RLS "new row violates row-level security policy" also counts as refused
    if sqlstate = '42501' then raise notice 'ok - %', description;
    else raise exception 'not ok - % (unexpected error: %)', description, sqlerrm;
    end if;
end;
$$;

-- Runs a statement and passes only if it fails with any error (e.g. a constraint).
create or replace function tests.fails(statement text, description text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'not ok - % (statement succeeded)', description;
exception
  when others then
    if sqlerrm like 'not ok - %' then raise; end if;
    raise notice 'ok - % (%)', description, sqlerrm;
end;
$$;

-- Act as a signed-in user (what Supabase does for each API request).
create or replace function tests.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner)
-- ---------------------------------------------------------------------------

begin;

insert into public.cafes (id, name, slug)
values ('00000000-0000-0000-0000-0000000000c2', 'Other Cafe', 'other-cafe')
on conflict do nothing;

-- Signing up creates profiles through the trigger. Maria tries to sneak a role in.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'maria@example.test', '{"preferred_language":"en","role":"admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'nikos@example.test', '{}'),
  ('00000000-0000-0000-0000-00000000005f', 'staff@example.test', '{}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'other-admin@example.test', '{}');

select tests.ok(
  (select count(*) = 5 from public.profiles where role = 'customer'),
  'signup creates a customer profile for every new user');
select tests.ok(
  (select role = 'customer' and preferred_language = 'en' from public.profiles
   where id = '00000000-0000-0000-0000-00000000000a'),
  'signup metadata cannot choose a role, but does set the language');

-- Promotions done the documented way: SQL as the database owner.
update public.profiles p set role = 'staff', cafe_id = c.id
from public.cafes c where c.slug = 'coffee-pause-cyprus' and p.id = '00000000-0000-0000-0000-00000000005f';
update public.profiles p set role = 'admin', cafe_id = c.id
from public.cafes c where c.slug = 'coffee-pause-cyprus' and p.id = '00000000-0000-0000-0000-0000000000ad';
update public.profiles set role = 'admin', cafe_id = '00000000-0000-0000-0000-0000000000c2'
where id = '00000000-0000-0000-0000-0000000000a2';

-- Cards, stamps and coupons for Maria and Nikos at Coffee Pause.
insert into public.tags (id, cafe_id, label, tag_uid)
select '00000000-0000-0000-0000-0000000000f1', id, 'Counter tag', '04A1B2C3D4E5F6'
from public.cafes where slug = 'coffee-pause-cyprus';

insert into public.cards (id, cafe_id, customer_id, stamp_count)
select v.id::uuid, c.id, v.customer::uuid, v.stamps
from public.cafes c,
  (values ('00000000-0000-0000-0000-0000000001aa', '00000000-0000-0000-0000-00000000000a', 4),
          ('00000000-0000-0000-0000-0000000001bb', '00000000-0000-0000-0000-00000000000b', 7)) v(id, customer, stamps)
where c.slug = 'coffee-pause-cyprus';

insert into public.stamps (cafe_id, card_id, customer_id, tag_id)
select cafe_id, id, customer_id, '00000000-0000-0000-0000-0000000000f1' from public.cards;

insert into public.coupons (cafe_id, customer_id, code, expires_at)
select cafe_id, customer_id,
       case when customer_id = '00000000-0000-0000-0000-00000000000a' then 'CP-MARI-AAAA-BBBB-CCCC' else 'CP-NIKO-DDDD-EEEE-FFFF' end,
       now() + interval '90 days'
from public.cards;

commit;

-- ---------------------------------------------------------------------------
-- A customer only sees their own rows
-- ---------------------------------------------------------------------------

begin;
set local role authenticated;
select tests.as_user('00000000-0000-0000-0000-00000000000a');

select tests.ok((select count(*) = 1 from public.profiles), 'customer sees exactly one profile');
select tests.ok((select bool_and(id = '00000000-0000-0000-0000-00000000000a') from public.profiles), '... and it is their own');
select tests.ok((select count(*) = 1 and bool_and(customer_id = '00000000-0000-0000-0000-00000000000a') from public.cards), 'customer sees only their own card');
select tests.ok((select count(*) = 1 and bool_and(customer_id = '00000000-0000-0000-0000-00000000000a') from public.stamps), 'customer sees only their own stamps');
select tests.ok((select count(*) = 1 and bool_and(customer_id = '00000000-0000-0000-0000-00000000000a') from public.coupons), 'customer sees only their own coupons');
select tests.ok((select count(*) = 0 from public.coupons where code = 'CP-NIKO-DDDD-EEEE-FFFF'), 'customer cannot read another customer''s coupon by code');
select tests.ok((select count(*) = 0 from public.tags), 'customer cannot read tags');
select tests.ok((select count(*) = 0 from public.find_coupon_for_staff('CP-NIKO-DDDD-EEEE-FFFF')), 'customer gets nothing from the staff coupon lookup');
select tests.ok((select count(*) = 2 from public.cafes), 'customer can read cafe info');
rollback;

-- ---------------------------------------------------------------------------
-- A customer can never write stamps, cards, coupons or tags
-- ---------------------------------------------------------------------------

begin;
set local role authenticated;
select tests.as_user('00000000-0000-0000-0000-00000000000a');

select tests.refused($$insert into public.stamps (cafe_id, card_id, customer_id)
  select cafe_id, id, customer_id from public.cards$$, 'customer cannot insert a stamp');
select tests.refused($$update public.stamps set created_at = now()$$, 'customer cannot update stamps');
select tests.refused($$delete from public.stamps$$, 'customer cannot delete stamps');
select tests.refused($$update public.cards set stamp_count = 10$$, 'customer cannot change their stamp count');
select tests.refused($$insert into public.cards (cafe_id, customer_id) select id, auth.uid() from public.cafes where slug = 'other-cafe'$$, 'customer cannot create a card');
select tests.refused($$insert into public.coupons (cafe_id, customer_id, expires_at)
  select cafe_id, customer_id, now() + interval '1 day' from public.cards$$, 'customer cannot create a coupon');
select tests.refused($$update public.coupons set status = 'valid', expires_at = now() + interval '10 years'$$, 'customer cannot change a coupon');
select tests.refused($$delete from public.coupons$$, 'customer cannot delete coupons');
select tests.refused($$insert into public.tags (cafe_id, label, tag_uid) select id, 'x', 'x' from public.cafes limit 1$$, 'customer cannot create a tag');
select tests.refused($$update public.cafes set stamps_required = 1$$, 'customer cannot change cafe rules');
rollback;

-- ---------------------------------------------------------------------------
-- Nobody but the database owner can change roles
-- ---------------------------------------------------------------------------

begin;
set local role authenticated;
select tests.as_user('00000000-0000-0000-0000-00000000000a');
select tests.refused($$update public.profiles set role = 'admin'$$, 'customer cannot make themselves admin');
select tests.refused($$update public.profiles set cafe_id = (select id from public.cafes limit 1)$$, 'customer cannot join a cafe as staff');
update public.profiles set display_name = 'Maria', preferred_language = 'el';
select tests.ok((select display_name = 'Maria' from public.profiles), 'customer can update their own name and language');
update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000000b';
reset role;
select tests.ok((select display_name is null from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'customer cannot update another customer''s profile');
rollback;

begin;
set local role service_role;
select tests.refused($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b'$$,
  'the server (service role) cannot change roles either');
rollback;

-- ---------------------------------------------------------------------------
-- Signed out (anon): cafe info only
-- ---------------------------------------------------------------------------

begin;
set local role anon;
select tests.ok((select count(*) = 2 from public.cafes), 'anon can read cafe info');
select tests.refused($$select * from public.cards$$, 'anon cannot read cards');
select tests.refused($$select * from public.coupons$$, 'anon cannot read coupons');
select tests.refused($$select * from public.profiles$$, 'anon cannot read profiles');
select tests.refused($$select * from public.find_coupon_for_staff('CP-MARI-AAAA-BBBB-CCCC')$$, 'anon cannot use the staff coupon lookup');
rollback;

-- ---------------------------------------------------------------------------
-- Staff: one coupon by exact code, nothing else
-- ---------------------------------------------------------------------------

begin;
set local role authenticated;
select tests.as_user('00000000-0000-0000-0000-00000000005f');
select tests.ok((select count(*) = 1 from public.find_coupon_for_staff(' cp-mari-aaaa-bbbb-cccc ')), 'staff can look up a coupon by its code');
select tests.ok((select count(*) = 0 from public.find_coupon_for_staff('CP-MARI')), 'staff cannot look up a partial code');
select tests.ok((select count(*) = 0 from public.coupons), 'staff cannot list coupons');
select tests.ok((select count(*) = 0 from public.cards), 'staff cannot list cards');
select tests.refused($$update public.coupons set status = 'used', redeemed_at = now()$$, 'staff cannot redeem directly (only via the server route)');
rollback;

-- ---------------------------------------------------------------------------
-- Admins: everything for their own cafe, nothing for other cafes
-- ---------------------------------------------------------------------------

begin;
set local role authenticated;
select tests.as_user('00000000-0000-0000-0000-0000000000ad');
select tests.ok((select count(*) = 2 from public.cards), 'admin sees every card at their cafe');
select tests.ok((select count(*) = 2 from public.stamps), 'admin sees every stamp at their cafe');
select tests.ok((select count(*) = 2 from public.coupons), 'admin sees every coupon at their cafe');
select tests.ok((select count(*) = 1 from public.tags), 'admin sees their cafe''s tags');
select tests.ok((select count(*) = 4 from public.profiles), 'admin sees their customers, their staff and themselves');
select tests.refused($$update public.cards set stamp_count = 0$$, 'admin cannot write cards through the API');
rollback;

begin;
set local role authenticated;
select tests.as_user('00000000-0000-0000-0000-0000000000a2');
select tests.ok((select count(*) = 0 from public.cards), 'admin of another cafe sees no cards here');
select tests.ok((select count(*) = 0 from public.coupons), 'admin of another cafe sees no coupons here');
select tests.ok((select count(*) = 1 from public.profiles), 'admin of another cafe sees only their own profile');
rollback;

-- ---------------------------------------------------------------------------
-- The server (service role) does the writes
-- ---------------------------------------------------------------------------

begin;
set local role service_role;
insert into public.stamps (cafe_id, card_id, customer_id)
select cafe_id, id, customer_id from public.cards where customer_id = '00000000-0000-0000-0000-00000000000a';
update public.cards set stamp_count = stamp_count + 1 where customer_id = '00000000-0000-0000-0000-00000000000a';
select tests.ok((select stamp_count = 5 from public.cards where customer_id = '00000000-0000-0000-0000-00000000000a'), 'service role can add a stamp');
insert into public.coupons (cafe_id, customer_id, expires_at)
select cafe_id, customer_id, now() + interval '90 days' from public.cards where customer_id = '00000000-0000-0000-0000-00000000000a';
select tests.ok((select bool_and(code ~ '^CP-[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}$') from public.coupons where code not like 'CP-MARI%' and code not like 'CP-NIKO%'),
  'generated coupon codes are 16 random characters from the safe alphabet');
select tests.fails($$insert into public.stamps (cafe_id, card_id, customer_id)
  select '00000000-0000-0000-0000-0000000000c2', id, customer_id from public.cards limit 1$$, 'a stamp cannot point at a card from another cafe');
select tests.fails($$insert into public.coupons (cafe_id, customer_id, code, expires_at)
  select cafe_id, customer_id, 'SHORT', now() + interval '1 day' from public.cards limit 1$$, 'coupon codes shorter than 12 characters are rejected');
rollback;
