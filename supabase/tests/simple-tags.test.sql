-- Simple tags (public.record_simple_stamp). Run with scripts/test-db.sh.

\set ON_ERROR_STOP on
set client_min_messages = notice;  -- show the ok lines

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a0c1', 'simple@example.test'),
  ('00000000-0000-0000-0000-00000000a0c2', 'simple-two@example.test');
insert into public.cafes (id, name, slug) values ('00000000-0000-0000-0000-0000000000c6', 'Sixth Cafe', 'sixth-cafe');
insert into public.tags (id, cafe_id, label, tag_uid, simple_token)
select v.id, c.id, v.label, v.uid, v.token
from public.cafes c,
  (values ('00000000-0000-0000-0000-00000000a0f1'::uuid, 'Counter', '04A0A0A0A0A0A0', 'simpleTokenAAAAAAAAAAAAAA'),
          ('00000000-0000-0000-0000-00000000a0f2'::uuid, 'Secure', '04A0A0A0A0A0A1', null)) v(id, label, uid, token)
where c.slug = 'coffee-pause-cyprus';
insert into public.tags (id, cafe_id, label, tag_uid, simple_token, active) values
  ('00000000-0000-0000-0000-00000000a0f3', (select id from public.cafes where slug = 'coffee-pause-cyprus'),
   'Lost', '04A0A0A0A0A0A2', 'simpleTokenBBBBBBBBBBBBBB', false),
  ('00000000-0000-0000-0000-00000000a0f4', '00000000-0000-0000-0000-0000000000c6',
   'Elsewhere', '04A0A0A0A0A0A3', 'simpleTokenCCCCCCCCCCCCCC', true);
update public.cafes set stamp_cooldown_seconds = 0 where slug = 'coffee-pause-cyprus';

create temporary table ids as select id as cafe from public.cafes where slug = 'coffee-pause-cyprus';
grant select on ids to service_role, authenticated;

set local role authenticated;
select tests.refused($$select * from public.record_simple_stamp((select cafe from ids),
  '00000000-0000-0000-0000-00000000a0c1', '00000000-0000-0000-0000-00000000a0f1')$$,
  'customers cannot call record_simple_stamp');
reset role;

set local role service_role;
select tests.ok((select result = 'stamped' and stamp_count = 1 from public.record_simple_stamp((select cafe from ids),
  '00000000-0000-0000-0000-00000000a0c1', '00000000-0000-0000-0000-00000000a0f1')),
  'a simple tag gives a stamp');
select tests.ok((select simple_day = (now() at time zone 'Europe/Nicosia')::date from public.stamps
                 where customer_id = '00000000-0000-0000-0000-00000000a0c1'),
  '... counted for today in Cyprus time');
select tests.ok((select last_tap_at is not null from public.tags where id = '00000000-0000-0000-0000-00000000a0f1'),
  '... and the tag''s last tap is saved');
select tests.ok((select result = 'daily_limit' and stamp_count = 1 and retry_after_seconds between 1 and 90000
                 from public.record_simple_stamp((select cafe from ids),
                   '00000000-0000-0000-0000-00000000a0c1', '00000000-0000-0000-0000-00000000a0f1')),
  'a second simple stamp the same day is refused, with the time until midnight');
select tests.ok((select result = 'stamped' from public.record_simple_stamp((select cafe from ids),
  '00000000-0000-0000-0000-00000000a0c2', '00000000-0000-0000-0000-00000000a0f1')),
  'another customer can still get today''s stamp from the same tag');
select tests.ok((select result = 'stamped' and stamp_count = 2 from public.record_stamp((select cafe from ids),
  '00000000-0000-0000-0000-00000000a0c1', '00000000-0000-0000-0000-00000000a0f2', 5)),
  'a secure tag tap is not limited by the daily simple stamp');
select tests.ok((select result = 'unknown_tag' from public.record_simple_stamp((select cafe from ids),
  '00000000-0000-0000-0000-00000000a0c1', '00000000-0000-0000-0000-00000000a0f2')),
  'a secure tag cannot be used as a simple tag');
select tests.ok((select result = 'inactive' from public.record_simple_stamp((select cafe from ids),
  '00000000-0000-0000-0000-00000000a0c1', '00000000-0000-0000-0000-00000000a0f3')),
  'a deactivated simple tag is refused');
select tests.ok((select result = 'unknown_tag' from public.record_simple_stamp((select cafe from ids),
  '00000000-0000-0000-0000-00000000a0c1', '00000000-0000-0000-0000-00000000a0f4')),
  'another cafe''s simple tag is refused');
select tests.fails($$update public.stamps set simple_day = (now() at time zone 'Europe/Nicosia')::date
  where customer_id = '00000000-0000-0000-0000-00000000a0c1' and simple_day is null$$,
  'the database itself refuses two simple stamps on one card on the same day');
select tests.fails($$update public.tags set simple_token = 'short' where id = '00000000-0000-0000-0000-00000000a0f2'$$,
  'a short simple token is refused');
reset role;

-- Yesterday's simple stamp doesn't block today's.
update public.stamps set simple_day = simple_day - 1, created_at = created_at - interval '1 day'
where customer_id = '00000000-0000-0000-0000-00000000a0c2';
set local role service_role;
select tests.ok((select result = 'stamped' from public.record_simple_stamp((select cafe from ids),
  '00000000-0000-0000-0000-00000000a0c2', '00000000-0000-0000-0000-00000000a0f1')),
  'the next day gives the next simple stamp');
reset role;

rollback;
