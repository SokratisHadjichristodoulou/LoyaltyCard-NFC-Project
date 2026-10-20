-- Stamping and coupon issuing (public.record_stamp). Run with scripts/test-db.sh.

\set ON_ERROR_STOP on
set client_min_messages = notice;  -- show the ok lines

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'eleni@example.test'),
  ('00000000-0000-0000-0000-0000000005a2', 'andreas@example.test');

create temporary table cafe as select id from public.cafes where slug = 'coffee-pause-cyprus';
grant select on cafe to service_role, authenticated, anon;

-- ---------------------------------------------------------------------------
-- Only the server may stamp
-- ---------------------------------------------------------------------------

set local role authenticated;
select tests.as_user('00000000-0000-0000-0000-0000000005a1');
select tests.refused($$select * from public.record_stamp((select id from cafe), auth.uid())$$,
  'a customer cannot stamp their own card');
reset role;

set local role anon;
select tests.refused($$select * from public.record_stamp((select id from cafe), '00000000-0000-0000-0000-0000000005a1')$$,
  'a signed-out visitor cannot stamp');
reset role;

-- ---------------------------------------------------------------------------
-- First stamp and the cooldown
-- ---------------------------------------------------------------------------

set local role service_role;

create temporary table r1 as select * from public.record_stamp((select id from cafe), '00000000-0000-0000-0000-0000000005a1');
select tests.ok((select result = 'stamped' and stamp_count = 1 and stamps_required = 10 from r1),
  'first stamp creates the card and counts 1 of 10');
select tests.ok((select count(*) = 1 from public.cards where customer_id = '00000000-0000-0000-0000-0000000005a1'),
  'the card row was created on the first stamp');

create temporary table r2 as select * from public.record_stamp((select id from cafe), '00000000-0000-0000-0000-0000000005a1');
select tests.ok((select result = 'cooldown' and stamp_count = 1 and retry_after_seconds between 170 and 180 from r2),
  'a second tap within 3 minutes is refused with the seconds to wait');
select tests.ok((select count(*) = 1 from public.stamps where customer_id = '00000000-0000-0000-0000-0000000005a1'),
  'the refused tap is not logged as a stamp');

create temporary table r3 as select * from public.record_stamp((select id from cafe), '00000000-0000-0000-0000-0000000005a2');
select tests.ok((select result = 'stamped' and stamp_count = 1 from r3),
  'the cooldown is per customer: another customer can be stamped right away');

-- Pretend the first stamp was 4 minutes ago.
reset role;
update public.stamps set created_at = now() - interval '4 minutes' where customer_id = '00000000-0000-0000-0000-0000000005a1';
set local role service_role;
create temporary table r4 as select * from public.record_stamp((select id from cafe), '00000000-0000-0000-0000-0000000005a1');
select tests.ok((select result = 'stamped' and stamp_count = 2 from r4), 'after the cooldown the next stamp counts');

-- ---------------------------------------------------------------------------
-- The 10th stamp issues a coupon and starts the card again
-- ---------------------------------------------------------------------------

reset role;
update public.cafes set stamp_cooldown_seconds = 0 where id = (select id from cafe);
set local role service_role;

select public.record_stamp((select id from cafe), '00000000-0000-0000-0000-0000000005a1') from generate_series(3, 9);
select tests.ok((select stamp_count = 9 from public.cards where customer_id = '00000000-0000-0000-0000-0000000005a1'),
  'nine stamps, no coupon yet');
select tests.ok((select count(*) = 0 from public.coupons where customer_id = '00000000-0000-0000-0000-0000000005a1'),
  '... and no coupon issued before the 10th');

create temporary table r10 as select * from public.record_stamp((select id from cafe), '00000000-0000-0000-0000-0000000005a1');
select tests.ok((select result = 'coupon_issued' and stamp_count = 0 and coupon_code is not null from r10),
  'the 10th stamp issues a coupon and the card starts again at 0');
select tests.ok((select c.code = r.coupon_code and c.status = 'valid'
                 and c.expires_at between now() + interval '89 days 23 hours' and now() + interval '90 days 1 hour'
                 from public.coupons c, r10 r where c.customer_id = '00000000-0000-0000-0000-0000000005a1'),
  'the coupon is valid for the cafe''s 90 days');
select tests.ok((select count(*) = 10 from public.stamps where customer_id = '00000000-0000-0000-0000-0000000005a1'),
  'all 10 stamps are in the audit log');

create temporary table r11 as select * from public.record_stamp((select id from cafe), '00000000-0000-0000-0000-0000000005a1');
select tests.ok((select result = 'stamped' and stamp_count = 1 from r11), 'the next stamp starts the new card');

-- A stamp from a tag at another cafe is rejected by the foreign key.
reset role;
insert into public.cafes (id, name, slug) values ('00000000-0000-0000-0000-0000000000c3', 'Third Cafe', 'third-cafe');
insert into public.tags (id, cafe_id, label, tag_uid) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c3', 'Elsewhere', '04FFFFFFFFFFFF');
set local role service_role;
select tests.fails($$select * from public.record_stamp((select id from cafe), '00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-0000000000f3')$$,
  'a tag from another cafe cannot stamp this cafe''s card');

-- The customer sees the result through RLS.
reset role;
set local role authenticated;
select tests.as_user('00000000-0000-0000-0000-0000000005a1');
select tests.ok((select count(*) = 1 from public.coupons), 'the customer can read their new coupon');
select tests.ok((select stamp_count = 1 from public.cards), 'the customer sees their restarted card');

rollback;
