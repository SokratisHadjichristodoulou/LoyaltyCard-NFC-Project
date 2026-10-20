-- Migration tracking (private.applied_migrations). Run with scripts/test-db.sh.

\set ON_ERROR_STOP on
set client_min_messages = notice;  -- show the ok lines

begin;

set local role service_role;
select tests.ok((select count(*) = 7 from public.applied_migrations()), 'all 7 migrations are recorded');
select tests.ok((select bool_and(v ~ '^\d{14}$') from public.applied_migrations() v), 'versions are the 14-digit file prefixes');
reset role;

set local role authenticated;
select tests.refused($$select * from public.applied_migrations()$$, 'customers cannot read the migration list');
reset role;

-- A database where one earlier migration never ran: the tracker must not claim it did.
delete from private.applied_migrations where version = '20261021000500';
drop function public.admin_stats(integer, text);
\i supabase/migrations/20261021000700_migration_tracking.sql
select tests.ok((select count(*) = 0 from public.applied_migrations() v where v = '20261021000500'),
  're-running the tracker does not record a migration whose objects are missing');

rollback;
