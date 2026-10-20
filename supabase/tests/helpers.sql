-- Assertion helpers shared by the *.test.sql files (loaded first by scripts/test-db.sh).
-- Every check raises an exception on failure; passing checks print "ok - ...".

create schema if not exists tests;

create or replace function tests.ok(passed boolean, description text)
returns void language plpgsql as $$
begin
  if passed is distinct from true then
    raise exception 'not ok - %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

-- Runs a statement and passes only if it is refused (permission or RLS error).
create or replace function tests.refused(statement text, description text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'not ok - % (statement was allowed)', description;
exception
  when insufficient_privilege then raise notice 'ok - %', description;
  when others then
    if sqlerrm like 'not ok - %' then raise; end if;
    -- RLS "new row violates row-level security policy" also counts as refused
    if sqlstate = '42501' then raise notice 'ok - %', description;
    else raise exception 'not ok - % (unexpected error: %)', description, sqlerrm;
    end if;
end;
$$;

-- Runs a statement and passes only if it fails with any error (e.g. a constraint).
create or replace function tests.fails(statement text, description text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'not ok - % (statement succeeded)', description;
exception
  when others then
    if sqlerrm like 'not ok - %' then raise; end if;
    raise notice 'ok - % (%)', description, sqlerrm;
end;
$$;

-- Act as a signed-in user (what Supabase does for each API request).
create or replace function tests.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;
