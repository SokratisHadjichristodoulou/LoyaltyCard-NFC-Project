-- Simple tags: a tag that holds a fixed link with a random token
-- (https://card.…/t/<token>), written with any NFC app. Unlike a secure tag
-- (SUN, 20261021000600_tag_taps.sql) the link never changes, so it could be
-- saved and opened again away from the cafe. To limit that, a customer gets
-- at most one stamp per day (cafe's local time) from simple tags.
-- A tag is simple while simple_token is set; clearing it makes it secure again.
-- Re-runnable: guarded alters and create or replace.

alter table public.tags add column if not exists simple_token text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tags_simple_token_key') then
    alter table public.tags add constraint tags_simple_token_key unique (simple_token);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tags_simple_token_format') then
    alter table public.tags add constraint tags_simple_token_format
      check (simple_token is null or simple_token ~ '^[A-Za-z0-9_-]{20,64}$');
  end if;
end;
$$;

-- The day a simple-tag stamp counts for. One per card per day, enforced by
-- the database as well as by record_simple_stamp.
alter table public.stamps add column if not exists simple_day date;
create unique index if not exists stamps_one_simple_per_day on public.stamps (card_id, simple_day)
  where simple_day is not null;

create or replace function public.record_simple_stamp(p_cafe_id uuid, p_customer_id uuid, p_tag_id uuid)
returns table (
  result text,            -- record_stamp's results, or 'daily_limit' | 'unknown_tag' | 'inactive'
  stamp_count integer,
  stamps_required integer,
  coupon_code text,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_tag public.tags;
  v_card public.cards;
  v_today date := (now() at time zone 'Europe/Nicosia')::date;
  v_stamp record;
begin
  select * into v_tag from public.tags t where t.id = p_tag_id and t.cafe_id = p_cafe_id;
  if not found or v_tag.simple_token is null then
    return query select 'unknown_tag'::text, null::integer, null::integer, null::text, null::integer;
    return;
  end if;
  if not v_tag.active then
    return query select 'inactive'::text, null::integer, null::integer, null::text, null::integer;
    return;
  end if;

  update public.tags t set last_tap_at = now() where t.id = p_tag_id;

  -- Lock the card so two taps at once can't both pass the daily check.
  insert into public.cards (cafe_id, customer_id)
  values (p_cafe_id, p_customer_id)
  on conflict (cafe_id, customer_id) do nothing;
  select * into v_card from public.cards c
  where c.cafe_id = p_cafe_id and c.customer_id = p_customer_id
  for update;

  if exists (select 1 from public.stamps s where s.card_id = v_card.id and s.simple_day = v_today) then
    return query select 'daily_limit'::text, v_card.stamp_count,
      (select c.stamps_required from public.cafes c where c.id = p_cafe_id), null::text,
      ceil(extract(epoch from ((v_today + 1)::timestamp at time zone 'Europe/Nicosia') - now()))::integer;
    return;
  end if;

  select * into v_stamp from public.record_stamp(p_cafe_id, p_customer_id, p_tag_id, null);
  if v_stamp.result in ('stamped', 'coupon_issued') then
    -- The stamp record_stamp just added (same transaction, so same now()).
    update public.stamps s set simple_day = v_today
    where s.card_id = v_card.id and s.tag_id = p_tag_id and s.created_at = now() and s.simple_day is null;
  end if;

  return query select v_stamp.result, v_stamp.stamp_count, v_stamp.stamps_required, v_stamp.coupon_code,
    v_stamp.retry_after_seconds;
end;
$$;

revoke all on function public.record_simple_stamp(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_simple_stamp(uuid, uuid, uuid) to service_role;

insert into private.applied_migrations (version) values ('20261028000100') on conflict do nothing;
