-- Records which migrations have run, so the app can warn when the database is
-- behind the code (npm run db:check, /api/health, and a banner in /admin).
--
-- Every migration from this one on ends with:
--   insert into private.applied_migrations (version) values ('<its version>') on conflict do nothing;
-- (a unit test checks this). Re-runnable.

create table if not exists private.applied_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

revoke all on private.applied_migrations from public, anon, authenticated;
grant select on private.applied_migrations to service_role;

-- The earlier migrations didn't record themselves. Record each one whose
-- objects are actually there, so a skipped one still shows as missing.
insert into private.applied_migrations (version)
select version from (values
  ('20261021000100', to_regclass('public.coupons') is not null),
  ('20261021000200', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cards' and policyname = 'cards_read_own')),
  ('20261021000300', to_regprocedure('public.record_stamp(uuid,uuid,uuid,bigint)') is not null
                     or to_regprocedure('public.record_stamp(uuid,uuid,uuid)') is not null),
  ('20261021000400', to_regprocedure('public.redeem_coupon(text,uuid)') is not null),
  ('20261021000500', to_regprocedure('public.admin_stats(integer,text)') is not null),
  ('20261021000600', to_regprocedure('public.consume_tag_tap(text,bigint)') is not null)
) as earlier(version, present)
where present
on conflict do nothing;

-- For the server only (service role): the versions that have run.
create or replace function public.applied_migrations()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select version from private.applied_migrations order by version;
$$;

revoke all on function public.applied_migrations() from public, anon, authenticated;
grant execute on function public.applied_migrations() to service_role;

insert into private.applied_migrations (version) values ('20261021000700') on conflict do nothing;
