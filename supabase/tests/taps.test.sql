-- NFC tap counters (public.consume_tag_tap). Run with scripts/test-db.sh.

\set ON_ERROR_STOP on
set client_min_messages = notice;  -- show the ok lines

begin;

insert into public.tags (cafe_id, label, tag_uid, last_counter)
select id, 'Counter', '04AABBCCDDEEFF', 5 from public.cafes where slug = 'coffee-pause-cyprus';
insert into public.tags (cafe_id, label, tag_uid, active)
select id, 'Lost', '04111111111111', false from public.cafes where slug = 'coffee-pause-cyprus';

set local role authenticated;
select tests.refused($$select * from public.consume_tag_tap('04AABBCCDDEEFF', 6)$$, 'customers cannot record taps');
reset role;

set local role service_role;
select tests.ok((select result = 'ok' and tag_id is not null and cafe_id is not null from public.consume_tag_tap('04aabbccddeeff', 6)),
  'a higher counter is accepted (UID case does not matter)');
select tests.ok((select last_counter = 6 and last_tap_at is not null from public.tags where tag_uid = '04AABBCCDDEEFF'),
  'the counter and tap time are saved');
select tests.ok((select result = 'replayed' from public.consume_tag_tap('04AABBCCDDEEFF', 6)), 'the same counter again is a replay');
select tests.ok((select result = 'replayed' from public.consume_tag_tap('04AABBCCDDEEFF', 3)), 'an older counter is a replay');
select tests.ok((select last_counter = 6 from public.tags where tag_uid = '04AABBCCDDEEFF'), 'a replay does not change the saved counter');
select tests.ok((select result = 'ok' from public.consume_tag_tap('04AABBCCDDEEFF', 40)), 'counters may skip ahead (taps without a stamp)');
select tests.ok((select result = 'inactive' from public.consume_tag_tap('04111111111111', 1)), 'a deactivated tag is refused');
select tests.ok((select result = 'unknown_tag' from public.consume_tag_tap('04999999999999', 1)), 'an unregistered tag is refused');
reset role;

rollback;

-- ---------------------------------------------------------------------------
-- One stamp per tap
-- ---------------------------------------------------------------------------

begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000009c1', 'tapper@example.test');
insert into public.tags (id, cafe_id, label, tag_uid)
select '00000000-0000-0000-0000-0000000009f1', id, 'Bar', '04CCCCCCCCCCCC' from public.cafes where slug = 'coffee-pause-cyprus';
update public.cafes set stamp_cooldown_seconds = 0 where slug = 'coffee-pause-cyprus';

set local role service_role;
select tests.ok((select result = 'stamped' from public.record_stamp(
  (select id from public.cafes where slug = 'coffee-pause-cyprus'), '00000000-0000-0000-0000-0000000009c1',
  '00000000-0000-0000-0000-0000000009f1', 77)), 'a tap gives a stamp and records its counter');
select tests.ok((select result = 'duplicate' and stamp_count = 1 from public.record_stamp(
  (select id from public.cafes where slug = 'coffee-pause-cyprus'), '00000000-0000-0000-0000-0000000009c1',
  '00000000-0000-0000-0000-0000000009f1', 77)), 'the same tap cannot give a second stamp');
select tests.ok((select result = 'stamped' and stamp_count = 2 from public.record_stamp(
  (select id from public.cafes where slug = 'coffee-pause-cyprus'), '00000000-0000-0000-0000-0000000009c1',
  '00000000-0000-0000-0000-0000000009f1', 78)), 'the next tap gives the next stamp');
select tests.fails($$insert into public.stamps (cafe_id, card_id, customer_id, tag_id, tag_counter)
  select cafe_id, card_id, customer_id, tag_id, tag_counter from public.stamps where tag_counter = 77$$,
  'the database itself refuses a second stamp for the same tap');
select tests.ok((select result = 'stamped' from public.record_stamp(
  (select id from public.cafes where slug = 'coffee-pause-cyprus'), '00000000-0000-0000-0000-0000000009c1')),
  'stamps without a tag (dev test button) still work');
reset role;

rollback;
