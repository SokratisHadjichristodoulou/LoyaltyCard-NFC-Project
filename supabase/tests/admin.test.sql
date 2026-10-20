-- Admin reports (admin_customers, admin_stats, admin_activity, admin_stamp_log).
-- Run with scripts/test-db.sh.

\set ON_ERROR_STOP on
set client_min_messages = notice;  -- show the ok lines

begin;

insert into public.cafes (id, name, slug) values ('00000000-0000-0000-0000-0000000000c5', 'Fifth Cafe', 'fifth-cafe');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000008a2', 'other-owner@example.test'),
  ('00000000-0000-0000-0000-0000000008b1', 'barista2@example.test'),
  ('00000000-0000-0000-0000-0000000008c1', 'sofia@example.test'),
  ('00000000-0000-0000-0000-0000000008c2', 'petros@example.test');

update public.profiles set role = 'admin', cafe_id = (select id from public.cafes where slug = 'coffee-pause-cyprus')
where id = '00000000-0000-0000-0000-0000000008a1';
update public.profiles set role = 'staff', cafe_id = (select id from public.cafes where slug = 'coffee-pause-cyprus')
where id = '00000000-0000-0000-0000-0000000008b1';
update public.profiles set role = 'admin', cafe_id = '00000000-0000-0000-0000-0000000000c5'
where id = '00000000-0000-0000-0000-0000000008a2';
update public.profiles set display_name = 'Sofia' where id = '00000000-0000-0000-0000-0000000008c1';
update public.cafes set stamp_cooldown_seconds = 0 where slug = 'coffee-pause-cyprus';

-- Sofia: 12 stamps (one coupon issued, then redeemed). Petros: 3 stamps.
set local role service_role;
select public.record_stamp((select id from public.cafes where slug = 'coffee-pause-cyprus'), '00000000-0000-0000-0000-0000000008c1')
from generate_series(1, 12);
select public.record_stamp((select id from public.cafes where slug = 'coffee-pause-cyprus'), '00000000-0000-0000-0000-0000000008c2')
from generate_series(1, 3);
select public.redeem_coupon((select code from public.coupons where customer_id = '00000000-0000-0000-0000-0000000008c1'),
  '00000000-0000-0000-0000-0000000008b1');
-- A customer at the other cafe, who must never show up here.
select public.record_stamp('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000008c2');
reset role;

-- ---------------------------------------------------------------------------
-- The admin sees their cafe
-- ---------------------------------------------------------------------------

set local role authenticated;
select tests.as_user('00000000-0000-0000-0000-0000000008a1');

select tests.ok((select count(*) = 2 from public.admin_customers()), 'admin lists the 2 customers of their cafe');
select tests.ok((select email = 'sofia@example.test' and display_name = 'Sofia' and stamp_count = 2 and stamps_total = 12
                        and coupons_used = 1 and coupons_valid = 0
                 from public.admin_customers() where email like 'sofia%'),
  'customer row: email, name, current stamps, lifetime stamps and coupons');
select tests.ok((select stamps_total = 3 from public.admin_customers() where email like 'petros%'),
  'a customer of two cafes shows only this cafe''s stamps');

select tests.ok((select (s->>'customers')::int = 2 and (s->>'stamps_total')::int = 15 and (s->>'stamps_today')::int = 15
                        and (s->>'coupons_issued')::int = 1 and (s->>'coupons_redeemed')::int = 1 and (s->>'coupons_valid')::int = 0
                 from public.admin_stats() s),
  'stats: customers, stamps, coupons issued and redeemed');
select tests.ok((select jsonb_array_length(s->'daily') = 30 from public.admin_stats() s), 'stats: one row per day for 30 days');
select tests.ok((select (s->'daily'->-1->>'stamps')::int = 15 and (s->'daily'->-1->>'redeemed')::int = 1 from public.admin_stats() s),
  'stats: today has the 15 stamps and 1 redemption');
select tests.ok((select jsonb_array_length(s->'daily') = 7 from public.admin_stats(7) s), 'stats: the number of days can be chosen');

select tests.ok((select count(*) = 17 from public.admin_activity(100)), 'activity: 15 stamps, 1 coupon issued, 1 redeemed');
select tests.ok((select count(*) = 15 from public.admin_stamp_log()), 'stamp log for export has every stamp at this cafe');

-- ---------------------------------------------------------------------------
-- Nobody else sees anything
-- ---------------------------------------------------------------------------

select tests.as_user('00000000-0000-0000-0000-0000000008a2');
select tests.ok((select count(*) = 1 and bool_and(email = 'petros@example.test' and stamps_total = 1) from public.admin_customers()),
  'admin of another cafe sees only their own customer (Petros, with their 1 stamp), not Sofia');
select tests.ok((select (s->>'stamps_total')::int = 1 from public.admin_stats() s), '... and only their own cafe''s stamps');

select tests.as_user('00000000-0000-0000-0000-0000000008b1');
select tests.ok((select count(*) = 0 from public.admin_customers()), 'staff get no customer list');
select tests.ok((select public.admin_stats() is null), 'staff get no stats');
select tests.ok((select count(*) = 0 from public.admin_activity()), 'staff get no activity');

select tests.as_user('00000000-0000-0000-0000-0000000008c1');
select tests.ok((select count(*) = 0 from public.admin_customers()), 'customers get no customer list');
select tests.ok((select count(*) = 0 from public.admin_stamp_log()), 'customers get no stamp log');
reset role;

set local role anon;
select tests.refused($$select * from public.admin_customers()$$, 'signed-out visitors cannot call admin reports');
reset role;

rollback;
