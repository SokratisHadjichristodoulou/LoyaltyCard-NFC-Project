-- Redeeming coupons (public.redeem_coupon). Run with scripts/test-db.sh.

\set ON_ERROR_STOP on
set client_min_messages = notice;  -- show the ok lines

begin;

insert into public.cafes (id, name, slug) values ('00000000-0000-0000-0000-0000000000c4', 'Fourth Cafe', 'fourth-cafe');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007c1', 'kostas@example.test'),
  ('00000000-0000-0000-0000-0000000007b1', 'barista@example.test'),
  ('00000000-0000-0000-0000-0000000007b2', 'barista-elsewhere@example.test');

update public.profiles set role = 'staff', cafe_id = (select id from public.cafes where slug = 'coffee-pause-cyprus')
where id = '00000000-0000-0000-0000-0000000007b1';
update public.profiles set role = 'staff', cafe_id = '00000000-0000-0000-0000-0000000000c4'
where id = '00000000-0000-0000-0000-0000000007b2';

insert into public.cards (cafe_id, customer_id)
select id, '00000000-0000-0000-0000-0000000007c1' from public.cafes where slug = 'coffee-pause-cyprus';

insert into public.coupons (cafe_id, customer_id, code, issued_at, expires_at)
select id, '00000000-0000-0000-0000-0000000007c1', v.code, v.issued, v.expires
from public.cafes,
  (values ('CP-GOOD-AAAA-BBBB-CCCC', now() - interval '1 day', now() + interval '89 days'),
          ('CP-OLDD-AAAA-BBBB-CCCC', now() - interval '91 days', now() - interval '1 day')) v(code, issued, expires)
where slug = 'coffee-pause-cyprus';

-- ---------------------------------------------------------------------------
-- Only the server may call it, and only for real staff
-- ---------------------------------------------------------------------------

set local role authenticated;
select tests.as_user('00000000-0000-0000-0000-0000000007b1');
select tests.refused($$select * from public.redeem_coupon('CP-GOOD-AAAA-BBBB-CCCC', auth.uid())$$,
  'staff cannot call redeem_coupon directly (only through the server route)');
reset role;

set local role service_role;

select tests.ok((select result = 'not_allowed' from public.redeem_coupon('CP-GOOD-AAAA-BBBB-CCCC', '00000000-0000-0000-0000-0000000007c1')),
  'a customer id is refused even if the server passes it');
select tests.ok((select result = 'not_found' from public.redeem_coupon('CP-GOOD-AAAA-BBBB-CCCC', '00000000-0000-0000-0000-0000000007b2')),
  'staff of another cafe cannot find this cafe''s coupon');
select tests.ok((select result = 'not_found' from public.redeem_coupon('CP-NOPE-AAAA-BBBB-CCCC', '00000000-0000-0000-0000-0000000007b1')),
  'an unknown code is not found');

-- ---------------------------------------------------------------------------
-- Redeem once, and only once
-- ---------------------------------------------------------------------------

create temporary table first_try as select * from public.redeem_coupon(' cp-good-aaaa-bbbb-cccc ', '00000000-0000-0000-0000-0000000007b1');
select tests.ok((select result = 'redeemed' and redeemed_at is not null from first_try),
  'a valid coupon is redeemed (code is trimmed and case-insensitive)');
select tests.ok((select status = 'used' and redeemed_by = '00000000-0000-0000-0000-0000000007b1' from public.coupons where code = 'CP-GOOD-AAAA-BBBB-CCCC'),
  'the coupon is marked used, with who redeemed it');

create temporary table second_try as select * from public.redeem_coupon('CP-GOOD-AAAA-BBBB-CCCC', '00000000-0000-0000-0000-0000000007b1');
select tests.ok((select s.result = 'already_used' and s.redeemed_at = f.redeemed_at from second_try s, first_try f),
  'redeeming again says "already used" and when');

select tests.ok((select result = 'expired' from public.redeem_coupon('CP-OLDD-AAAA-BBBB-CCCC', '00000000-0000-0000-0000-0000000007b1')),
  'an out-of-date coupon cannot be redeemed');
select tests.ok((select status = 'expired' and redeemed_at is null from public.coupons where code = 'CP-OLDD-AAAA-BBBB-CCCC'),
  '... and is marked expired');

reset role;

-- The customer sees the redemption through RLS.
set local role authenticated;
select tests.as_user('00000000-0000-0000-0000-0000000007c1');
select tests.ok((select status = 'used' from public.coupons where code = 'CP-GOOD-AAAA-BBBB-CCCC'),
  'the customer sees their coupon as used');

rollback;
