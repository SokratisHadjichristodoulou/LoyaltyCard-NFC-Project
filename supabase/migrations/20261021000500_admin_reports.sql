-- Read-only reports for the admin dashboard. Each function returns data only
-- for the caller's own cafe, and only when the caller is an admin there;
-- anyone else gets nothing. Customer emails live in auth.users, which the API
-- cannot read directly, hence security definer.
-- Writes (tags, cafe settings) stay server-side with the service role.
-- Re-runnable: create or replace.

-- The admin's cafe, or null when the caller is not an admin.
create or replace function private.admin_cafe_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cafe_id from public.profiles where id = (select auth.uid()) and role = 'admin';
$$;

revoke all on function private.admin_cafe_id() from public, anon;
grant execute on function private.admin_cafe_id() to authenticated;

-- One row per customer with a card at the admin's cafe.
create or replace function public.admin_customers()
returns table (
  customer_id uuid,
  email text,
  display_name text,
  stamp_count integer,
  stamps_total integer,
  coupons_valid integer,
  coupons_used integer,
  last_stamp_at timestamptz,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, u.email::text, p.display_name, c.stamp_count,
    (select count(*) from public.stamps s where s.card_id = c.id)::integer,
    (select count(*) from public.coupons k
      where k.customer_id = p.id and k.cafe_id = c.cafe_id and k.status = 'valid' and k.expires_at > now())::integer,
    (select count(*) from public.coupons k
      where k.customer_id = p.id and k.cafe_id = c.cafe_id and k.status = 'used')::integer,
    (select max(s.created_at) from public.stamps s where s.card_id = c.id),
    p.created_at
  from public.cards c
  join public.profiles p on p.id = c.customer_id
  join auth.users u on u.id = p.id
  where c.cafe_id = private.admin_cafe_id()
  order by 8 desc nulls last, p.created_at desc;
$$;

-- Headline numbers plus stamps and redemptions per day (cafe's local time).
create or replace function public.admin_stats(p_days integer default 30, p_tz text default 'Europe/Nicosia')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cafe as (select private.admin_cafe_id() as id),
  days as (
    select generate_series(
      (now() at time zone p_tz)::date - (least(greatest(p_days, 1), 366) - 1),
      (now() at time zone p_tz)::date,
      interval '1 day')::date as day
  )
  select case when (select id from cafe) is null then null else jsonb_build_object(
    'customers', (select count(*) from public.cards where cafe_id = (select id from cafe)),
    'stamps_total', (select count(*) from public.stamps where cafe_id = (select id from cafe)),
    'stamps_today', (select count(*) from public.stamps where cafe_id = (select id from cafe)
                      and (created_at at time zone p_tz)::date = (now() at time zone p_tz)::date),
    'stamps_7d', (select count(*) from public.stamps where cafe_id = (select id from cafe)
                   and created_at > now() - interval '7 days'),
    'coupons_issued', (select count(*) from public.coupons where cafe_id = (select id from cafe)),
    'coupons_redeemed', (select count(*) from public.coupons where cafe_id = (select id from cafe) and status = 'used'),
    'coupons_valid', (select count(*) from public.coupons where cafe_id = (select id from cafe)
                       and status = 'valid' and expires_at > now()),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'day', d.day,
                'stamps', (select count(*) from public.stamps s where s.cafe_id = (select id from cafe)
                            and (s.created_at at time zone p_tz)::date = d.day),
                'redeemed', (select count(*) from public.coupons k where k.cafe_id = (select id from cafe)
                              and (k.redeemed_at at time zone p_tz)::date = d.day)
              ) order by d.day), '[]'::jsonb) from days d)
  ) end;
$$;

-- Latest events: stamps, coupons issued, coupons redeemed.
create or replace function public.admin_activity(p_limit integer default 20)
returns table (kind text, at timestamptz, email text, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select 'stamp'::text, s.created_at, u.email::text, t.label
    from public.stamps s
    join auth.users u on u.id = s.customer_id
    left join public.tags t on t.id = s.tag_id
    where s.cafe_id = private.admin_cafe_id()
    union all
    select 'coupon_issued', k.issued_at, u.email::text, k.code
    from public.coupons k join auth.users u on u.id = k.customer_id
    where k.cafe_id = private.admin_cafe_id()
    union all
    select 'redeemed', k.redeemed_at, u.email::text, k.code
    from public.coupons k join auth.users u on u.id = k.customer_id
    where k.cafe_id = private.admin_cafe_id() and k.redeemed_at is not null
  ) events
  order by 2 desc
  limit least(greatest(p_limit, 1), 500);
$$;

-- Stamp log for the CSV export.
create or replace function public.admin_stamp_log(p_since timestamptz default now() - interval '90 days')
returns table (stamped_at timestamptz, email text, display_name text, tag_label text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.created_at, u.email::text, p.display_name, t.label
  from public.stamps s
  join public.profiles p on p.id = s.customer_id
  join auth.users u on u.id = s.customer_id
  left join public.tags t on t.id = s.tag_id
  where s.cafe_id = private.admin_cafe_id() and s.created_at >= p_since
  order by s.created_at desc;
$$;

revoke all on function public.admin_customers() from public, anon;
revoke all on function public.admin_stats(integer, text) from public, anon;
revoke all on function public.admin_activity(integer) from public, anon;
revoke all on function public.admin_stamp_log(timestamptz) from public, anon;
grant execute on function public.admin_customers() to authenticated;
grant execute on function public.admin_stats(integer, text) to authenticated;
grant execute on function public.admin_activity(integer) to authenticated;
grant execute on function public.admin_stamp_log(timestamptz) to authenticated;
