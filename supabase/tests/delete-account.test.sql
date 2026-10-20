-- Deleting an account removes all of the customer's data. Run with scripts/test-db.sh.

\set ON_ERROR_STOP on
set client_min_messages = notice;  -- show the ok lines

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000dc1', 'leaving@example.test'),
  ('00000000-0000-0000-0000-000000000db1', 'barista3@example.test'),
  ('00000000-0000-0000-0000-000000000dc2', 'staying@example.test');
update public.profiles set role = 'staff', cafe_id = (select id from public.cafes where slug = 'coffee-pause-cyprus')
where id = '00000000-0000-0000-0000-000000000db1';
update public.cafes set stamp_cooldown_seconds = 0 where slug = 'coffee-pause-cyprus';
insert into public.tags (cafe_id, label, tag_uid, staff_id)
select id, 'Barista 3', '04DDDDDDDDDDDD', '00000000-0000-0000-0000-000000000db1' from public.cafes where slug = 'coffee-pause-cyprus';

set local role service_role;
select public.record_stamp((select id from public.cafes where slug = 'coffee-pause-cyprus'), '00000000-0000-0000-0000-000000000dc1')
from generate_series(1, 11);
select public.record_stamp((select id from public.cafes where slug = 'coffee-pause-cyprus'), '00000000-0000-0000-0000-000000000dc2')
from generate_series(1, 10);
-- The barista redeems the coupon of the customer who stays.
select public.redeem_coupon((select code from public.coupons where customer_id = '00000000-0000-0000-0000-000000000dc2'),
  '00000000-0000-0000-0000-000000000db1');
reset role;

-- What the server does on "Delete my account": delete the auth user.
delete from auth.users where id = '00000000-0000-0000-0000-000000000dc1';

select tests.ok((select count(*) = 0 from public.profiles where id = '00000000-0000-0000-0000-000000000dc1'), 'the profile is gone');
select tests.ok((select count(*) = 0 from public.cards where customer_id = '00000000-0000-0000-0000-000000000dc1'), 'the card is gone');
select tests.ok((select count(*) = 0 from public.stamps where customer_id = '00000000-0000-0000-0000-000000000dc1'), 'every stamp is gone');
select tests.ok((select count(*) = 0 from public.coupons where customer_id = '00000000-0000-0000-0000-000000000dc1'), 'every coupon is gone');
select tests.ok((select count(*) = 10 from public.stamps where customer_id = '00000000-0000-0000-0000-000000000dc2'),
  'other customers keep their stamps');

-- A deleted barista leaves the customer's redeemed coupon in place, without the link to them.
delete from auth.users where id = '00000000-0000-0000-0000-000000000db1';
select tests.ok((select status = 'used' and redeemed_by is null from public.coupons where customer_id = '00000000-0000-0000-0000-000000000dc2'),
  'deleting a barista keeps the redeemed coupon but forgets who redeemed it');
select tests.ok((select staff_id is null from public.tags where tag_uid = '04DDDDDDDDDDDD'), '... and unassigns their tag');

rollback;
