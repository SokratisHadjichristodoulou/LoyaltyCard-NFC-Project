-- Apple Wallet: passes, device registrations and owed pushes. Run with scripts/test-db.sh.

\set ON_ERROR_STOP on
set client_min_messages = notice;  -- show the ok lines

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c0c1', 'apple@example.test'),
  ('00000000-0000-0000-0000-00000000c0c2', 'apple-two@example.test');

create temporary table ids as select id as cafe from public.cafes where slug = 'coffee-pause-cyprus';
grant select on ids to service_role, authenticated, anon;

insert into public.cards (id, cafe_id, customer_id)
select v.card, cafe, v.customer from ids, (values
  ('00000000-0000-0000-0000-00000000c0a1'::uuid, '00000000-0000-0000-0000-00000000c0c1'::uuid),
  ('00000000-0000-0000-0000-00000000c0a2'::uuid, '00000000-0000-0000-0000-00000000c0c2'::uuid)
) v(card, customer);

set local role service_role;
insert into public.apple_wallet_passes (serial_number, cafe_id, card_id, auth_token, updated_at)
select v.card, cafe, v.card, repeat('t', 40), now() - interval '1 hour' from ids, (values
  ('00000000-0000-0000-0000-00000000c0a1'::uuid), ('00000000-0000-0000-0000-00000000c0a2'::uuid)
) v(card);
select tests.ok(true, 'the server can create passes');
select tests.fails($$insert into public.apple_wallet_passes (serial_number, cafe_id, card_id, auth_token)
  select gen_random_uuid(), cafe, null, 'short' from ids$$, 'an authentication token must be long');
reset role;

-- Nobody else ------------------------------------------------------------------

select tests.as_user('00000000-0000-0000-0000-00000000c0c1');
set local role authenticated;
select tests.refused($$select * from public.apple_wallet_passes$$, 'customers cannot read Apple passes (tokens)');
select tests.refused($$select * from public.apple_wallet_registrations$$, 'customers cannot read device registrations');
select tests.refused($$select public.apple_wallet_register('dev', '00000000-0000-0000-0000-00000000c0a1', 'tok')$$,
  'customers cannot register devices');
select tests.refused($$select public.apple_wallet_touch_all((select cafe from ids))$$, 'customers cannot mark passes changed');
reset role;
set local role anon;
select tests.refused($$select * from public.apple_wallet_claim_pushes((select cafe from ids), null, 10)$$,
  'signed-out visitors cannot take push tokens');
reset role;

-- Registering and listing --------------------------------------------------------

set local role service_role;
select tests.ok(public.apple_wallet_register('phone-a', '00000000-0000-0000-0000-00000000c0a1', 'push-a') = 'created',
  'a phone registers for a pass');
select tests.ok(public.apple_wallet_register('phone-a', '00000000-0000-0000-0000-00000000c0a1', 'push-a2') = 'updated',
  '... registering again keeps one row and takes the new push token');
select tests.ok((select push_token = 'push-a2' from public.apple_wallet_registrations where device_library_id = 'phone-a'),
  '... (new token saved)');
select public.apple_wallet_register('phone-b', '00000000-0000-0000-0000-00000000c0a1', 'push-b');
select public.apple_wallet_register('phone-b', '00000000-0000-0000-0000-00000000c0a2', 'push-b2');

select tests.ok((select count(*) = 2 from public.apple_wallet_updated_serials('phone-b', null)),
  'a phone lists all its passes when it asks for everything');
select tests.ok((select count(*) = 0 from public.apple_wallet_updated_serials('phone-b', now() - interval '1 minute')),
  '... and none changed in the last minute');
select tests.ok((select count(*) = 0 from public.apple_wallet_claim_pushes((select cafe from ids), null, 10)),
  'a phone that just registered is not owed a push (it has the pass)');

-- A stamp changes one customer's pass -------------------------------------------

select tests.ok(public.apple_wallet_touch((select cafe from ids), '00000000-0000-0000-0000-00000000c0c1')
                = '00000000-0000-0000-0000-00000000c0a1',
  'marking a customer''s pass changed returns its serial number');
select tests.ok(public.apple_wallet_touch((select cafe from ids), '00000000-0000-0000-0000-00000000b0ff') is null,
  '... and nothing for a customer without an Apple pass');
select tests.ok((select array_agg(serial_number) = array['00000000-0000-0000-0000-00000000c0a1'::uuid]
                 from public.apple_wallet_updated_serials('phone-b', now() - interval '1 minute')),
  'the phone now lists only the changed pass');
create temporary table claimed on commit drop as
  select * from public.apple_wallet_claim_pushes((select cafe from ids), '00000000-0000-0000-0000-00000000c0a1', 10);
select tests.ok((select count(*) = 2 and bool_and(serial_number = '00000000-0000-0000-0000-00000000c0a1') from claimed),
  'both phones holding the changed pass are owed a push, and no others');
select tests.ok((select count(*) = 0 from public.apple_wallet_claim_pushes((select cafe from ids), null, 10)),
  '... and once claimed, nothing is pushed twice');

-- A new theme changes every pass --------------------------------------------------

select tests.ok(public.apple_wallet_touch_all((select cafe from ids)) = 2, 'a new theme marks every pass changed');
select tests.ok((select count(*) = 2 from public.apple_wallet_claim_pushes((select cafe from ids), null, 2)),
  '... and the pushes are claimed in batches of the given size');
select tests.ok((select count(*) = 1 from public.apple_wallet_claim_pushes((select cafe from ids), null, 10)),
  '... the next batch takes the rest');
select tests.ok(public.apple_wallet_pass_count((select cafe from ids)) = 2, 'the admin count is cards on at least one phone');
reset role;

-- Deleting the account empties the pass but keeps it reachable --------------------

delete from auth.users where id = '00000000-0000-0000-0000-00000000c0c1';
set local role service_role;
select tests.ok((select card_id is null and updated_at > now() - interval '1 second'
                 from public.apple_wallet_passes where serial_number = '00000000-0000-0000-0000-00000000c0a1'),
  'a deleted account leaves the pass without a card, marked changed');
select tests.ok((select count(*) = 2 from public.apple_wallet_claim_pushes((select cafe from ids),
                   '00000000-0000-0000-0000-00000000c0a1', 10)),
  '... so its phones are pushed the emptied pass');
select tests.ok(public.apple_wallet_pass_count((select cafe from ids)) = 1, '... and it no longer counts');

-- Expired coupons count Apple passes too ------------------------------------------------

insert into public.coupons (cafe_id, customer_id, code, issued_at, expires_at)
select cafe, '00000000-0000-0000-0000-00000000c0c2', 'CP-APPL-PAST-AAAA-AAAA', now() - interval '100 days', now() - interval '1 hour' from ids;
select tests.ok((select has_pass from public.wallet_expire_coupons((select cafe from ids), 10)
                 where customer_id = '00000000-0000-0000-0000-00000000c0c2'),
  'an expired coupon of a customer with only an Apple pass says they have a pass');
reset role;

rollback;
