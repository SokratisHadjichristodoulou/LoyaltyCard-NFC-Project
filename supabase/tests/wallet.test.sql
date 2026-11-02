-- Google Wallet: themes, pass data and expiring coupons. Run with scripts/test-db.sh.

\set ON_ERROR_STOP on
set client_min_messages = notice;  -- show the ok lines

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000b0c1', 'wallet@example.test'),
  ('00000000-0000-0000-0000-00000000b0c2', 'wallet-two@example.test');
update public.profiles set display_name = 'Maria' where id = '00000000-0000-0000-0000-00000000b0c1';

create temporary table ids as select id as cafe from public.cafes where slug = 'coffee-pause-cyprus';
grant select on ids to service_role, authenticated, anon;

insert into public.cards (cafe_id, customer_id, stamp_count, google_wallet_object_id)
select cafe, '00000000-0000-0000-0000-00000000b0c1', 7, '3388000000000000000.card-test' from ids;
insert into public.cards (cafe_id, customer_id, stamp_count)
select cafe, '00000000-0000-0000-0000-00000000b0c2', 2 from ids;

insert into public.coupons (cafe_id, customer_id, code, issued_at, expires_at) select cafe, v.customer, v.code, v.issued, v.expires
from ids, (values
  ('00000000-0000-0000-0000-00000000b0c1'::uuid, 'CP-WLT1-LATE-AAAA-AAAA', now() - interval '1 day', now() + interval '60 days'),
  ('00000000-0000-0000-0000-00000000b0c1'::uuid, 'CP-WLT1-SOON-AAAA-AAAA', now() - interval '80 days', now() + interval '10 days'),
  ('00000000-0000-0000-0000-00000000b0c1'::uuid, 'CP-WLT1-PAST-AAAA-AAAA', now() - interval '100 days', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000b0c2'::uuid, 'CP-WLT2-PAST-AAAA-AAAA', now() - interval '100 days', now() - interval '2 hours')
) v(customer, code, issued, expires);

-- Themes ---------------------------------------------------------------------

set local role service_role;
insert into public.wallet_themes (cafe_id, name, background_color, hero_image, message_en, starts_on, ends_on)
select cafe, 'Christmas', '#7a1f1f', 'christmas', 'Merry Christmas', '2000-12-01', '2001-01-06' from ids;
select tests.ok(true, 'the server can add a theme, including one that crosses New Year');
select tests.fails($$insert into public.wallet_themes (cafe_id, name, background_color, hero_image, starts_on, ends_on)
  select cafe, 'Bad', 'red', 'christmas', '2000-01-01', '2000-01-02' from ids$$,
  'a colour must be #rrggbb');
select tests.fails($$insert into public.wallet_themes (cafe_id, name, background_color, hero_image, starts_on, ends_on)
  select cafe, 'Bad', '#aabbcc', 'http://example.com/a.png', '2000-01-01', '2000-01-02' from ids$$,
  'a banner address must be https');
select tests.fails($$insert into public.wallet_themes (cafe_id, name, background_color, hero_image, starts_on, ends_on, repeats_yearly)
  select cafe, 'Bad', '#aabbcc', 'easter', '2027-05-01', '2027-04-01', false from ids$$,
  'a one-off theme cannot end before it starts');
reset role;

set local role anon;
select tests.ok((select count(*) = 1 from public.wallet_themes), 'signed-out visitors can read the themes');
select tests.refused($$insert into public.wallet_themes (cafe_id, name, background_color, hero_image, starts_on, ends_on)
  select cafe, 'Mine', '#aabbcc', 'summer', '2000-06-01', '2000-08-31' from ids$$,
  'signed-out visitors cannot add a theme');
reset role;

select tests.as_user('00000000-0000-0000-0000-00000000b0c1');
set local role authenticated;
select tests.refused($$insert into public.wallet_themes (cafe_id, name, background_color, hero_image, starts_on, ends_on)
  select cafe, 'Mine', '#aabbcc', 'summer', '2000-06-01', '2000-08-31' from ids$$,
  'customers cannot add a theme');
select tests.refused($$update public.wallet_themes set name = 'Hacked'$$, 'customers cannot change a theme');
select tests.refused($$delete from public.wallet_themes$$, 'customers cannot delete a theme');
select tests.refused($$update public.cards set google_wallet_object_id = 'x'$$, 'customers cannot set their pass id');
select tests.refused($$select * from public.wallet_pass_data((select cafe from ids), '00000000-0000-0000-0000-00000000b0c1')$$,
  'customers cannot call wallet_pass_data');
select tests.refused($$select * from public.wallet_expire_coupons((select cafe from ids), 10)$$,
  'customers cannot call wallet_expire_coupons');
reset role;

-- Pass data -------------------------------------------------------------------

set local role service_role;
select tests.ok((select object_id = '3388000000000000000.card-test' and stamp_count = 7 and stamps_required = 10
                   and display_name = 'Maria' and coupon_code = 'CP-WLT1-SOON-AAAA-AAAA'
                 from public.wallet_pass_data((select cafe from ids), '00000000-0000-0000-0000-00000000b0c1')),
  'pass data: stamps, name and the usable coupon that expires first');
select tests.ok((select object_id is null and coupon_code is null
                 from public.wallet_pass_data((select cafe from ids), '00000000-0000-0000-0000-00000000b0c2')),
  'pass data: no pass yet, and an expired coupon is not shown');

-- Expiring coupons --------------------------------------------------------------

create temporary table first_run on commit drop as
  select * from public.wallet_expire_coupons((select cafe from ids), 1);
select tests.ok((select count(*) = 1 from first_run), 'expiring coupons: at most the limit per call');
select tests.ok((select customer_id = '00000000-0000-0000-0000-00000000b0c2' and not has_pass from first_run),
  '... oldest first, and says the customer has no pass');
select tests.ok((select customer_id = '00000000-0000-0000-0000-00000000b0c1' and has_pass
                 from public.wallet_expire_coupons((select cafe from ids), 10)),
  '... the next call marks the next one, whose customer has a pass');
select tests.ok((select count(*) = 0 from public.wallet_expire_coupons((select cafe from ids), 10)),
  '... and then there is nothing left');
select tests.ok((select status = 'expired' from public.coupons where code = 'CP-WLT1-PAST-AAAA-AAAA')
                and (select status = 'valid' from public.coupons where code = 'CP-WLT1-SOON-AAAA-AAAA'),
  'only coupons past their expiry are marked expired');
reset role;

rollback;
